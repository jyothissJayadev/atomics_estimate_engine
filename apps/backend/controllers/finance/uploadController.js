const Anthropic          = require('@anthropic/sdk')
const { resolveCanonical } = require('../../utils/canonicalResolver')
const UserRateProfile    = require('../../models/UserRateProfile')
const UserSectionProfile = require('../../models/UserSectionProfile')
const UserQuantityProfile = require('../../models/UserQuantityProfile')
const GlobalSectionStats  = require('../../models/GlobalSectionStats')
const { inferTier }      = require('../../config/constants')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Upload + Parse ───────────────────────────────────────────────────────────

/**
 * POST /api/upload/estimate
 * Takes raw estimate text, extracts structure + rates, updates user profile.
 */
async function uploadUserEstimate(req, res, next) {
  try {
    const { rawText, projectType, city } = req.body
    const userId = req.user.id

    if (!rawText || !projectType) {
      return res.status(400).json({
        success: false,
        error:   'rawText and projectType are required'
      })
    }

    // Step 1 — Extract structure from raw text using LLM
    const extracted = await extractEstimateStructure(rawText, projectType)

    if (!extracted || !extracted.sections) {
      return res.status(422).json({
        success: false,
        error:   'Could not parse estimate structure from text'
      })
    }

    // Override city if provided
    if (city) extracted.city = city

    // Infer tier if not in extracted data
    if (!extracted.tier && extracted.totalCost && extracted.sqft) {
      extracted.tier = inferTier(extracted.totalCost, extracted.sqft)
    }

    // Step 2 — Resolve any unresolved canonical refs
    extracted.sections = await resolveUnknownItems(extracted.sections)

    // Step 3 — Learn rates (EMA) + city-keyed entries for Gap 7
    const { learnedCount, skippedCount } = await learnRatesFromEstimate(extracted, userId)

    // Step 3b — Bootstrap UserSectionProfile from this uploaded estimate
    updateUserSectionProfileFromUpload(extracted, userId)
      .catch(err => console.error('UserSectionProfile update failed (non-critical):', err.message))

    // Step 3c — Bootstrap UserQuantityProfile from this uploaded estimate (Gap 6)
    learnQuantitiesFromUpload(extracted, userId)
      .catch(err => console.error('UserQuantityProfile update failed (non-critical):', err.message))

    // Step 4 — Update GlobalSectionStats with section occurrence counts
    updateSectionStats(extracted, projectType).catch(err =>
      console.error('Stats update failed (non-critical):', err.message)
    )

    res.json({
      success:         true,
      message:         'Estimate processed successfully',
      projectType:     extracted.projectType || projectType,
      tier:            extracted.tier,
      sectionsFound:   extracted.sections.length,
      itemsProcessed:  extracted.sections.reduce((n, s) => n + (s.items?.length || 0), 0),
      ratesLearned:    learnedCount,
      skipped:         skippedCount,
      unresolvedItems: collectUnresolved(extracted.sections)
    })

  } catch (err) {
    next(err)
  }
}

// ─── LLM Extraction ───────────────────────────────────────────────────────────

async function extractEstimateStructure(rawText, projectType) {
  const prompt = buildExtractionPrompt(rawText, projectType)

  const message = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }]
  })

  const content = message.content[0]?.text || ''

  // Strip any markdown fences if LLM added them
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('LLM returned unparseable JSON:', cleaned.substring(0, 200))
    throw new Error('LLM extraction failed — could not parse response as JSON')
  }
}

function buildExtractionPrompt(rawText, projectType) {
  return `You are extracting structured data from an Indian interior design estimate.

PROJECT TYPE: ${projectType}

TASK: Parse the estimate below and return a JSON object with this exact structure.
Return ONLY valid JSON. No markdown, no explanation, no code fences.

{
  "projectType": "${projectType}",
  "tier": "budget|balanced|premium|unknown",
  "city": "city name or null",
  "sqft": number or null,
  "totalCost": total project cost as number or null,
  "sections": [
    {
      "rawName": "section name exactly as written",
      "canonicalId": "best matching canonical ID or null",
      "canonicalStatus": "resolved|unresolved",
      "sectionCost": total cost of this section as number or null,
      "sectionRatio": section cost / total cost as decimal or null,
      "items": [
        {
          "rawName": "item name exactly as written",
          "canonicalId": "best matching canonical ID or null",
          "canonicalStatus": "resolved|unresolved",
          "unit": "sqft|rft|nos|lumpsum or null",
          "quantity": number or null,
          "materialRate": material cost per unit as number or null,
          "laborRate": labour cost per unit as number or null,
          "rateType": "split|combined|labour_only|unknown",
          "totalItemCost": number or null
        }
      ]
    }
  ]
}

TIER RULES:
- budget = below ₹800/sqft total cost
- balanced = ₹800-₹1400/sqft
- premium = above ₹1400/sqft

CANONICAL ID EXAMPLES for ${projectType}:
Kitchen section → apt_modular_kitchen
Carcass plywood → kit_carcass_ply
Laminate shutter → kit_shutter_laminate
Wardrobe → apt_master_wardrobe
False ceiling → apt_false_ceiling
TV unit → apt_tv_unit

If you cannot determine a canonical ID with reasonable confidence, set canonicalId to null and canonicalStatus to "unresolved".

RAW ESTIMATE TEXT:
${rawText}`
}

// ─── Canonical Resolution ─────────────────────────────────────────────────────

async function resolveUnknownItems(sections) {
  const unresolved = []
  for (const section of sections) {
    for (const item of (section.items || [])) {
      if (!item.canonicalId || item.canonicalStatus === 'unresolved') {
        unresolved.push(item)
      }
    }
  }

  if (unresolved.length === 0) return sections

  // Batch resolve using alias matching
  for (const item of unresolved) {
    const resolved = await resolveCanonical(item.rawName, null)
    if (resolved.canonicalId) {
      item.canonicalId     = resolved.canonicalId
      item.canonicalStatus = resolved.status
      item.canonicalScore  = resolved.score
    }
  }

  return sections
}

// ─── Rate Learning (EMA) ──────────────────────────────────────────────────────

/**
 * Learn rates from an uploaded past estimate.
 * Uses Exponential Moving Average so recent data weighs more than old data.
 * Formula: newRate = oldRate × 0.8 + incomingRate × 0.2
 */
async function learnRatesFromEstimate(extracted, userId) {
  let learnedCount = 0
  let skippedCount = 0
  const EMA_ALPHA  = 0.2   // weight for new observation

  const { tier, city, projectType } = extracted

  for (const section of (extracted.sections || [])) {
    for (const item of (section.items || [])) {
      if (!item.canonicalId || item.canonicalStatus === 'unresolved') {
        skippedCount++
        continue
      }
      if (item.materialRate === null && item.laborRate === null) {
        skippedCount++
        continue
      }

      const existing = await UserRateProfile.findOne({
        userId,
        canonicalRef: item.canonicalId,
        tier: tier || null
      })

      if (existing) {
        if (item.materialRate !== null) {
          const old = existing.materialRate
            ? parseFloat(existing.materialRate.toString())
            : item.materialRate
          existing.materialRate = old * (1 - EMA_ALPHA) + item.materialRate * EMA_ALPHA
        }
        if (item.laborRate !== null && item.rateType !== 'combined') {
          const old = existing.laborRate
            ? parseFloat(existing.laborRate.toString())
            : item.laborRate
          existing.laborRate = old * (1 - EMA_ALPHA) + item.laborRate * EMA_ALPHA
        }
        existing.sampleCount = existing.sampleCount + 1
        existing.lastUsed    = new Date()
        await existing.save()
      } else {
        await UserRateProfile.create({
          userId,
          canonicalRef:  item.canonicalId,
          projectType:   projectType || null,
          tier:          tier || null,
          city:          city || null,
          materialRate:  item.materialRate,
          laborRate:     item.rateType === 'combined' ? null : item.laborRate,
          unit:          item.unit || null,
          sampleCount:   1
        })
      }

      // Gap 7: also create/update city-specific rate entry when city is known
      if (city && (item.materialRate !== null || item.laborRate !== null)) {
        const cityExisting = await UserRateProfile.findOne({
          userId, canonicalRef: item.canonicalId, tier: tier || null, city
        })
        if (cityExisting) {
          if (item.materialRate !== null) {
            const old = cityExisting.materialRate
              ? parseFloat(cityExisting.materialRate.toString())
              : item.materialRate
            cityExisting.materialRate = old * (1 - EMA_ALPHA) + item.materialRate * EMA_ALPHA
          }
          if (item.laborRate !== null && item.rateType !== 'combined') {
            const old = cityExisting.laborRate
              ? parseFloat(cityExisting.laborRate.toString())
              : item.laborRate
            cityExisting.laborRate = old * (1 - EMA_ALPHA) + item.laborRate * EMA_ALPHA
          }
          cityExisting.sampleCount += 1
          cityExisting.lastUsed = new Date()
          await cityExisting.save()
        } else {
          await UserRateProfile.create({
            userId,
            canonicalRef: item.canonicalId,
            projectType:  projectType || null,
            tier:         tier        || null,
            city,
            materialRate: item.materialRate,
            laborRate:    item.rateType === 'combined' ? null : item.laborRate,
            unit:         item.unit || null,
            sampleCount:  1
          })
        }
      }

      learnedCount++
    }
  }

  return { learnedCount, skippedCount }
}

// ─── Bootstrap UserSectionProfile from uploaded estimate ─────────────────────

async function updateUserSectionProfileFromUpload(extracted, userId) {
  const { projectType } = extracted

  for (const section of (extracted.sections || [])) {
    if (!section.canonicalId || section.canonicalStatus === 'unresolved') continue

    // Build item usage map from this section's items
    const itemUsageUpdate = {}
    for (const item of (section.items || [])) {
      if (item.canonicalId && item.canonicalStatus !== 'unresolved') {
        itemUsageUpdate[item.canonicalId] = (itemUsageUpdate[item.canonicalId] || 0) + 1
      }
    }

    const sectionRatio = section.sectionRatio || null

    const existing = await UserSectionProfile.findOne({
      userId,
      canonicalRef: section.canonicalId,
      projectType:  projectType || null
    })

    if (existing) {
      existing.usageCount += 1

      if (sectionRatio !== null) {
        const n = existing.usageCount
        existing.avgBudgetShare = existing.avgBudgetShare
          ? ((existing.avgBudgetShare * (n - 1)) + sectionRatio) / n
          : sectionRatio
      }

      for (const [itemRef, count] of Object.entries(itemUsageUpdate)) {
        const current = existing.itemUsage.get(itemRef) || 0
        existing.itemUsage.set(itemRef, current + count)
      }

      existing.lastUsed = new Date()
      existing.markModified('itemUsage')
      await existing.save()
    } else {
      await UserSectionProfile.create({
        userId,
        canonicalRef:   section.canonicalId,
        projectType:    projectType || null,
        usageCount:     1,
        removalCount:   0,
        avgBudgetShare: sectionRatio,
        itemUsage:      new Map(Object.entries(itemUsageUpdate)),
        lastUsed:       new Date()
      })
    }
  }
}

// ─── Stats Update ─────────────────────────────────────────────────────────────

async function updateSectionStats(extracted, projectType) {
  const stats = await GlobalSectionStats.findOne({ projectType })
  if (!stats) return

  // Helper: works whether the field is a Mongoose Map or plain object
  const mapGet = (field, key) => {
    if (field instanceof Map) return field.get(key)
    return field ? field[key] : undefined
  }
  const mapSet = (field, key, value) => {
    if (field instanceof Map) field.set(key, value)
    else field[key] = value
  }

  for (const section of (extracted.sections || [])) {
    if (!section.canonicalId || section.canonicalStatus === 'unresolved') continue

    const cid  = section.canonicalId
    const freq = mapGet(stats.sectionFrequency, cid) || { count: 0, frequency: 0 }
    freq.count += 1
    mapSet(stats.sectionFrequency, cid, freq)

    if (section.sectionRatio && extracted.totalCost) {
      const existing = mapGet(stats.sectionBudgetRatio, cid) || { mean: 0, min: 1, max: 0, samples: 0 }
      const n        = existing.samples
      existing.mean  = ((existing.mean * n) + section.sectionRatio) / (n + 1)
      existing.min   = Math.min(existing.min, section.sectionRatio)
      existing.max   = Math.max(existing.max, section.sectionRatio)
      existing.samples = n + 1
      mapSet(stats.sectionBudgetRatio, cid, existing)
    }
  }

  stats.sampleCount += 1
  stats.lastUpdated  = new Date()
  stats.source       = 'mixed'

  // Mark nested maps as modified so Mongoose saves them
  stats.markModified('sectionFrequency')
  stats.markModified('sectionBudgetRatio')

  await stats.save()
}

function collectUnresolved(sections) {
  const result = []
  for (const section of sections) {
    if (section.canonicalStatus === 'unresolved') {
      result.push({ type: 'section', rawName: section.rawName })
    }
    for (const item of (section.items || [])) {
      if (item.canonicalStatus === 'unresolved') {
        result.push({ type: 'item', rawName: item.rawName, section: section.rawName })
      }
    }
  }
  return result
}

// ─── Bootstrap UserQuantityProfile from uploaded estimate (Gap 6) ────────────

async function learnQuantitiesFromUpload(extracted, userId) {
  const { tier, projectType, sqft } = extracted
  if (!sqft || sqft <= 0) return

  const EMA_ALPHA = 0.2

  for (const section of (extracted.sections || [])) {
    for (const item of (section.items || [])) {
      if (!item.canonicalId || item.canonicalStatus === 'unresolved') continue
      if (!item.quantity || item.quantity <= 0) continue

      const unit    = item.unit || ''
      if (unit === 'rft') continue  // rft can't be expressed as qty/sqft ratio
      const isFixed = unit === 'lumpsum' || unit === 'nos'

      const existing = await UserQuantityProfile.findOne({
        userId, canonicalRef: item.canonicalId, tier: tier || null
      })

      if (existing) {
        if (isFixed) {
          const old = existing.fixedQuantity || item.quantity
          existing.fixedQuantity = Math.round(old * (1 - EMA_ALPHA) + item.quantity * EMA_ALPHA)
          existing.isFixed = true
        } else {
          const ratio    = item.quantity / sqft
          const oldRatio = existing.quantityRatio || ratio
          existing.quantityRatio = parseFloat(
            (oldRatio * (1 - EMA_ALPHA) + ratio * EMA_ALPHA).toFixed(6)
          )
        }
        existing.sampleCount += 1
        existing.lastUsed     = new Date()
        await existing.save()
      } else {
        await UserQuantityProfile.create({
          userId,
          canonicalRef:  item.canonicalId,
          projectType:   projectType || null,
          tier:          tier        || null,
          quantityRatio: isFixed ? null : parseFloat((item.quantity / sqft).toFixed(6)),
          isFixed,
          fixedQuantity: isFixed ? item.quantity : null,
          sampleCount:   1
        })
      }
    }
  }
}

module.exports = { uploadUserEstimate }
