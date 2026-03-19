const Estimate               = require('../../models/finance/Estimate')
const EstimateVersion        = require('../../models/finance/EstimateVersion')
const UserRateProfile        = require('../../models/UserRateProfile')
const UserSectionProfile     = require('../../models/UserSectionProfile')
const UserQuantityProfile    = require('../../models/UserQuantityProfile')
const StructureEvent         = require('../../models/StructureEvent')
const CanonicalNode          = require('../../models/CanonicalNode')
const GlobalSectionStats     = require('../../models/GlobalSectionStats')
const { uploadToR2 }         = require('../../utils/uploadToR2')
const { recalculateCategories } = require('../../utils/calcHelpers')
const { buildEngine }        = require('@atomics/estimate-engine')
const CanonicalItem          = require('../../models/CanonicalItem')
const { generateId }         = require('../../utils/idGenerator')
const { process: processEvents } = require('../../services/structureEventProcessor')
const structureLearner       = require('../../services/structureLearner')

// Lazy-require to avoid circular dependency (finance controller imports this file)
function getFinanceRecalc() {
  return require('./projectFinanceController').recalculateFinanceForProject
}

// ─── CREATE ESTIMATE (manual) ────────────────────────────────────────────────

async function createEstimate(req, res, next) {
  try {
    const { projectId }                 = req.params
    const { estimateName, initialData } = req.body
    const userId = req.user.id

    if (!estimateName) {
      return res.status(400).json({ error: 'estimateName is required' })
    }

    const estimate = await Estimate.create({
      projectId,
      estimateName,
      createdBy:         userId,
      generatedByEngine: false
    })

    const rawCategories = (initialData?.categories || [])
    const { categories, computedTotals } = recalculateCategories(rawCategories)

    await EstimateVersion.create({
      estimateId:    estimate._id,
      versionNumber: 1,
      summary:       'Initial version',
      categories,
      cellFormatting: initialData?.cellFormatting || [],
      computedTotals,
      projectContext: initialData?.projectContext || {},
      createdBy:     userId
    })

    estimate.computedTotals = computedTotals
    await estimate.save()

    getFinanceRecalc()(projectId).catch(e =>
      console.error('Finance sync (non-critical):', e.message)
    )

    res.status(201).json({ estimate: estimate.toObject() })
  } catch (err) {
    next(err)
  }
}

// ─── GET ESTIMATE + ACTIVE VERSION ───────────────────────────────────────────

async function getEstimateById(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
      .populate('createdBy', 'name email').lean()

    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    const activeVersion = await EstimateVersion.findOne({
      estimateId:    estimate._id,
      versionNumber: estimate.currentVersion
    }).populate('createdBy', 'name email').lean()

    res.json({
      estimate,
      activeVersion: activeVersion ? _ser(activeVersion) : null
    })
  } catch (err) {
    next(err)
  }
}

// ─── SAVE NEW VERSION ─────────────────────────────────────────────────────────

async function saveEstimateVersion(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    if (estimate.status === 'Locked') {
      return res.status(400).json({ error: 'Estimate is locked — unlock before saving' })
    }

    const nextVersion = estimate.currentVersion + 1
    const userId      = req.user.id

    const { categories, computedTotals } = recalculateCategories(req.body.categories || [])

    await EstimateVersion.create({
      estimateId:        estimate._id,
      versionNumber:     nextVersion,
      summary:           req.body.summary || `Version ${nextVersion}`,
      categories,
      cellFormatting:    req.body.cellFormatting    || [],
      computedTotals,
      projectContext:    req.body.projectContext    || {},
      financialDefaults: req.body.financialDefaults || {},
      createdBy:         userId
    })

    estimate.currentVersion = nextVersion
    estimate.computedTotals = computedTotals
    await estimate.save()

    getFinanceRecalc()(estimate.projectId).catch(() => {})
    // NOTE: rate learning intentionally removed from here.
    // It now fires only when the estimate is locked, ensuring we only
    // learn from finalized pricing — not from intermediate draft saves.

    const versions = await _versionMeta(estimate._id, nextVersion)
    res.json({ estimate: estimate.toObject(), versions })
  } catch (err) {
    next(err)
  }
}

// ─── GET SINGLE VERSION ───────────────────────────────────────────────────────

async function getSingleEstimateVersion(req, res, next) {
  try {
    const version = await EstimateVersion.findOne({
      _id:        req.params.versionId,
      estimateId: req.params.estimateId
    }).populate('createdBy', 'name email').lean()

    if (!version) return res.status(404).json({ error: 'Version not found' })
    res.json(_ser(version))
  } catch (err) {
    next(err)
  }
}

// ─── LIST VERSIONS ────────────────────────────────────────────────────────────

async function getEstimateVersions(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    res.json(await _versionMeta(estimate._id, estimate.currentVersion))
  } catch (err) {
    next(err)
  }
}

// ─── LOCK / UNLOCK ────────────────────────────────────────────────────────────

async function lockEstimate(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    estimate.status = 'Locked'
    await estimate.save()
    getFinanceRecalc()(estimate.projectId).catch(() => {})

    const version = await EstimateVersion.findOne({
      estimateId:    estimate._id,
      versionNumber: estimate.currentVersion
    }).lean()

    if (version) {
      const userId         = req.user.id
      const projectContext = version.projectContext || {}

      // Fire-and-forget: diff AI vs final, write events, update profiles + GlobalSectionStats
      processEvents(estimate.toObject(), version, userId, projectContext)
        .catch(e => console.error('[lockEstimate] structureEventProcessor error:', e.message))

      // Fire-and-forget: EMA-update UserRateProfile from finalized rates
      _learnRates(version.categories || [], userId, projectContext)
        .catch(e => console.error('[lockEstimate] _learnRates error:', e.message))

      // Fire-and-forget: EMA-update UserQuantityProfile from finalized quantities (Gap 6)
      _learnQuantities(version.categories || [], userId, projectContext)
        .catch(e => console.error('[lockEstimate] _learnQuantities error:', e.message))
    }

    res.json({ success: true, estimate: estimate.toObject() })
  } catch (err) { next(err) }
}

async function unlockEstimate(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    if (estimate.status !== 'Locked') {
      return res.status(400).json({ error: 'Estimate is not locked' })
    }

    estimate.status = 'Draft'
    await estimate.save()
    getFinanceRecalc()(estimate.projectId).catch(() => {})

    // Gap 5 fix: reset the AI-suggested section events so that if the designer
    // re-locks after making changes, structureEventProcessor can diff correctly.
    // Without this, a second lock would find no unprocessed AI events and
    // silently skip writing the finalization learning events.
    StructureEvent.updateMany(
      {
        estimateId:     estimate._id.toString(),
        wasAiSuggested: true,
        processed:      true
      },
      { $set: { processed: false, userAccepted: null } }
    ).catch(e => console.error('[unlockEstimate] event reset error (non-critical):', e.message))

    res.json({ success: true, estimate: estimate.toObject() })
  } catch (err) { next(err) }
}

// ─── UPLOAD ITEM IMAGE ────────────────────────────────────────────────────────

async function uploadEstimateItemImage(req, res, next) {
  try {
    const { estimateId, itemId } = req.params
    const { columnId }           = req.body

    if (!req.file) return res.status(400).json({ error: 'No image uploaded' })
    if (!columnId) return res.status(400).json({ error: 'columnId is required' })

    const estimate = await Estimate.findById(estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    const version = await EstimateVersion.findOne({
      estimateId:    estimate._id,
      versionNumber: estimate.currentVersion
    })
    if (!version) return res.status(404).json({ error: 'Active version not found' })

    const imageUrl = await uploadToR2({
      buffer:       req.file.buffer,
      mimetype:     req.file.mimetype,
      originalName: req.file.originalname,
      folder:       'estimates'
    })

    let updated = false
    const walk  = (items) => {
      items.forEach(item => {
        if (item._id === itemId) {
          const v = item.values instanceof Map ? item.values : new Map(Object.entries(item.values || {}))
          v.set(columnId, imageUrl)
          item.values = v
          updated = true
        }
        if (item.children?.length) walk(item.children)
      })
    }
    version.categories.forEach(cat => walk(cat.items))

    if (!updated) return res.status(404).json({ error: 'Item not found' })

    version.markModified('categories')
    await version.save()

    res.json({ imageUrl })
  } catch (err) { next(err) }
}

// ─── UPDATE META ──────────────────────────────────────────────────────────────

async function updateEstimateMeta(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })
    if (estimate.status === 'Locked') return res.status(400).json({ error: 'Estimate is locked' })

    if (req.body.estimateName !== undefined) estimate.estimateName = req.body.estimateName
    await estimate.save()
    res.json({ success: true, estimate: estimate.toObject() })
  } catch (err) { next(err) }
}

// ─── LIST FOR PROJECT ─────────────────────────────────────────────────────────

async function listProjectEstimates(req, res, next) {
  try {
    const estimates = await Estimate.find({ projectId: req.params.projectId })
      .populate('createdBy', 'name email').sort({ createdAt: -1 }).lean()
    res.json({ success: true, estimates })
  } catch (err) { next(err) }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

async function deleteEstimate(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    await EstimateVersion.deleteMany({ estimateId: estimate._id })
    await estimate.deleteOne()
    getFinanceRecalc()(estimate.projectId).catch(() => {})

    res.json({ success: true })
  } catch (err) { next(err) }
}

// ─── LEVEL 2 — Item Prediction for confirmed sections ────────────────────────
// Called after user confirms their L1 section list.
// Returns per-section item lists with allocated budgets.

async function getLevel2Items(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })

    const version = await EstimateVersion.findOne({
      estimateId:    estimate._id,
      versionNumber: estimate.currentVersion
    }).lean()
    if (!version) return res.status(404).json({ error: 'Active version not found' })

    const userId         = req.user.id
    const projectContext = version.projectContext || {}
    const { projectType, tier, sqft, rooms, roomSubtype, city, budget } = projectContext

    // Confirmed sections from request body (canonicalRefs the user kept/added)
    const confirmedRefs = req.body.confirmedSections
    if (!Array.isArray(confirmedRefs) || confirmedRefs.length === 0) {
      return res.status(400).json({ error: 'confirmedSections array is required' })
    }

    const [sectionStats, rawUserRates, canonicalNodes, rawUserSectionProfiles, rawUserQuantityProfiles] = await Promise.all([
      GlobalSectionStats.findOne({ projectType }).lean(),
      UserRateProfile.find({ userId: userId.toString() }).lean(),
      CanonicalNode.find({
        projectTypes: projectType,
        status: 'active',
        level: { $in: [2, 3] }
      }).lean(),
      UserSectionProfile.find({ userId: userId.toString(), projectType }).lean(),
      UserQuantityProfile.find({ userId: userId.toString() }).lean()
    ])

    // City-keyed rate map for Gap 7 (city-specific UserHistoryStrategy lookup)
    const userRates = new Map()
    for (const p of rawUserRates) {
      userRates.set(`${p.canonicalRef}::${p.tier}`, p)
      if (!userRates.has(p.canonicalRef)) userRates.set(p.canonicalRef, p)
      if (p.city) userRates.set(`${p.canonicalRef}::${p.tier}::${p.city}`, p)
    }

    const userSectionProfile = {}
    for (const p of rawUserSectionProfiles) {
      userSectionProfile[p.canonicalRef] = p
    }

    const userQuantityProfile = {}
    for (const p of rawUserQuantityProfiles) {
      userQuantityProfile[p.canonicalRef] = p
    }

    const parentMap = new Map()
    for (const node of canonicalNodes) {
      if (node.level === 3 && node.parentId) parentMap.set(node.canonicalId, node.parentId)
    }

    const input = {
      projectType, budget, sqft, rooms, roomSubtype, tier, city,
      userId: userId.toString()
    }

    // Fetch CanonicalItem map for DemoRateStrategy + quantityEstimator
    const rawCanonicalItems = await CanonicalItem.find({ status: 'active' }).lean()
    const canonicalItemMap  = new Map()
    for (const item of rawCanonicalItems) canonicalItemMap.set(item.canonicalId, item)

    const dbData = { sectionStats, userRates, canonicalNodes, parentMap, userSectionProfile, userQuantityProfile, city, canonicalItemMap }

    // Build engine and run level-2 prediction for confirmed sections only
    const engine    = buildEngine(dbData)
    const allResult = engine.predict(input, dbData, generateId)

    // Filter to only the confirmed sections
    const confirmedSet  = new Set(confirmedRefs)
    const filteredCats  = (allResult.categories || []).filter(
      cat => confirmedSet.has(cat.canonicalRef)
    )

    // Add estimated cost per item = allocatedBudget / itemCount (rough placeholder)
    const sectionsWithEstimates = filteredCats.map(cat => {
      const allocatedBudget = allResult.categories.find(
        c => c.canonicalRef === cat.canonicalRef
      )?._allocatedBudget || 0
      const itemCount = cat.items.length || 1
      const itemEstimate = Math.round(allocatedBudget / itemCount)

      return {
        ...cat,
        allocatedBudget,
        items: cat.items.map(item => ({
          ...item,
          estimatedCost: itemEstimate
        }))
      }
    })

    res.json({
      success:   true,
      sections:  sectionsWithEstimates,
      budgetSummary: {
        totalBudget:      budget,
        totalAllocated:   filteredCats.reduce((s, c) => s + (c._allocatedBudget || 0), 0),
        currentEstimate:  allResult.computedTotals?.totalSell || 0
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── LEVEL 3 — Full BOQ Generation from confirmed items ──────────────────────
// Called after user confirms their L2 item list.
// Runs full quantityEstimator + rate prediction + calculator pipeline.

async function generateLevel3Estimate(req, res, next) {
  try {
    const estimate = await Estimate.findById(req.params.estimateId)
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' })
    if (estimate.status === 'Locked') {
      return res.status(400).json({ error: 'Estimate is locked — unlock before regenerating' })
    }

    const userId         = req.user.id
    const currentVersion = await EstimateVersion.findOne({
      estimateId: estimate._id, versionNumber: estimate.currentVersion
    }).lean()
    if (!currentVersion) return res.status(404).json({ error: 'Active version not found' })

    const projectContext = currentVersion.projectContext || {}
    const { projectType, tier, sqft, rooms, roomSubtype, city, budget } = projectContext

    // Confirmed items per section from request body
    // { sectionCanonicalRef: [itemCanonicalRef, ...], ... }
    const confirmedItems = req.body.confirmedItems || {}

    const [sectionStats, rawUserRates, canonicalNodes, rawUserSectionProfiles, rawUserQuantityProfiles] = await Promise.all([
      GlobalSectionStats.findOne({ projectType }).lean(),
      UserRateProfile.find({ userId: userId.toString() }).lean(),
      CanonicalNode.find({
        projectTypes: projectType,
        status: 'active',
        level: { $in: [2, 3] }
      }).lean(),
      UserSectionProfile.find({ userId: userId.toString(), projectType }).lean(),
      UserQuantityProfile.find({ userId: userId.toString() }).lean()
    ])

    // City-keyed rate map for Gap 7 (city-specific UserHistoryStrategy lookup)
    const userRates = new Map()
    for (const p of rawUserRates) {
      userRates.set(`${p.canonicalRef}::${p.tier}`, p)
      if (!userRates.has(p.canonicalRef)) userRates.set(p.canonicalRef, p)
      if (p.city) userRates.set(`${p.canonicalRef}::${p.tier}::${p.city}`, p)
    }

    const userSectionProfile = {}
    for (const p of rawUserSectionProfiles) {
      userSectionProfile[p.canonicalRef] = p
    }

    const userQuantityProfile = {}
    for (const p of rawUserQuantityProfiles) {
      userQuantityProfile[p.canonicalRef] = p
    }

    const parentMap = new Map()
    for (const node of canonicalNodes) {
      if (node.level === 3 && node.parentId) parentMap.set(node.canonicalId, node.parentId)
    }

    const input = {
      projectType, budget, sqft, rooms, roomSubtype, tier, city,
      userId: userId.toString()
    }

    // Fetch CanonicalItem map for DemoRateStrategy + quantityEstimator
    const rawCanonicalItemsL3 = await CanonicalItem.find({ status: 'active' }).lean()
    const canonicalItemMapL3  = new Map()
    for (const item of rawCanonicalItemsL3) canonicalItemMapL3.set(item.canonicalId, item)

    const dbData = { sectionStats, userRates, canonicalNodes, parentMap, userSectionProfile, userQuantityProfile, city, canonicalItemMap: canonicalItemMapL3 }

    // Run full engine prediction (includes quantityEstimator + calculator)
    const engine = buildEngine(dbData)
    const result = engine.predict(input, dbData, generateId)

    // Filter categories to only confirmed sections/items
    let filteredCategories = result.categories || []
    if (Object.keys(confirmedItems).length > 0) {
      filteredCategories = filteredCategories
        .filter(cat => confirmedItems[cat.canonicalRef] !== undefined)
        .map(cat => {
          const allowedItems = confirmedItems[cat.canonicalRef]
          if (!Array.isArray(allowedItems)) return cat
          return {
            ...cat,
            items: cat.items.filter(
              item => allowedItems.includes(item.canonicalRef)
            )
          }
        })
    }

    // Save as a new version
    const nextVersion = estimate.currentVersion + 1
    const { aggregateCategory: aggCat, aggregateProject: aggProj } =
      require('@atomics/estimate-engine')

    // Recompute totals for filtered categories
    for (const cat of filteredCategories) {
      cat.computedTotals = aggCat(cat.items)
    }
    const projectTotals = aggProj(filteredCategories, budget)

    await EstimateVersion.create({
      estimateId:     estimate._id,
      versionNumber:  nextVersion,
      summary:        `Level 3 — full BOQ (v${nextVersion})`,
      categories:     filteredCategories,
      cellFormatting: [],
      computedTotals: projectTotals.computedTotals,
      projectContext,
      financialDefaults: currentVersion.financialDefaults || {},
      generationMeta: {
        ...result.generationMeta,
        budgetDeviationPercent: projectTotals.budgetDeviationPercent
      },
      createdBy: userId
    })

    estimate.currentVersion = nextVersion
    estimate.computedTotals = projectTotals.computedTotals
    await estimate.save()

    getFinanceRecalc()(estimate.projectId).catch(() => {})

    res.json({
      success:        true,
      estimateId:     estimate._id,
      versionNumber:  nextVersion,
      computedTotals: projectTotals.computedTotals,
      budgetDeviation: projectTotals.budgetDeviationPercent,
      categories:     filteredCategories
    })
  } catch (err) {
    next(err)
  }
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _versionMeta(estimateId, currentVersion) {
  const versions = await EstimateVersion.find({ estimateId })
    .populate('createdBy', 'name email').sort({ versionNumber: -1 }).lean()

  return versions.map(v => ({
    _id:       v._id,
    version:   v.versionNumber,
    isActive:  v.versionNumber === currentVersion,
    createdAt: v.createdAt,
    createdBy: v.createdBy,
    summary:   v.summary || `Version ${v.versionNumber}`
  }))
}

function _ser(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => {
    if (v instanceof Map) return Object.fromEntries(v)
    return v
  }))
}

/**
 * Learn rates from finalized estimate categories.
 * Now delegates computation to engine's pure extractRateLearning().
 * The backend is a thin DB adapter — no learning logic lives here.
 */
async function _learnRates(categories, userId, projectContext) {
  const EMA_ALPHA        = 0.2
  const WEAK_EMA_ALPHA   = 0.1   // lower weight for scribd_ratio sources
  const DEMO_WEAK_ALPHA  = 0.08  // very weak signal for accepted-without-edit demo rates

  const deltas = extractRateLearning(categories, projectContext)

  for (const d of deltas) {
    const alpha = d.isWeak ? WEAK_EMA_ALPHA : EMA_ALPHA
    await _upsertRateProfile(userId, d.canonicalRef, d.projectType, d.tier, d.city, d.materialRate, d.laborRate, alpha)
  }

  // Weak learning signal: demo_seed items the designer accepted without modification.
  // If the same item has been locked 3+ times without the designer changing the rate,
  // we treat this as implicit confirmation and write a weak initial signal.
  const { tier, city, projectType } = projectContext
  for (const cat of categories) {
    for (const item of (cat.items || [])) {
      if (!item.canonicalRef) continue
      const rateSource = item.rateSource || 'unrated'
      if (rateSource !== 'demo_seed') continue

      const vals = item.values instanceof Map
        ? Object.fromEntries(item.values) : (item.values || {})
      const mr = parseFloat(vals.materialRate ?? 0) || null
      const lr = parseFloat(vals.laborRate ?? 0)    || null
      if (!mr && !lr) continue

      // Check how many times this item has been locked at demo rate for this user
      const existing = await UserRateProfile.findOne({ userId, canonicalRef: item.canonicalRef, tier: tier || null })
      const priorSamples = existing?.sampleCount || 0

      // Only promote after 3 consecutive acceptances (3 = DEMO_WEAK_THRESHOLD)
      if (priorSamples >= 2) {
        // Write a very weak signal — low enough not to skew if just coincidence
        await _upsertRateProfile(userId, item.canonicalRef, projectType, tier, null, mr, lr, DEMO_WEAK_ALPHA)
        if (city) {
          await _upsertRateProfile(userId, item.canonicalRef, projectType, tier, city, mr, lr, DEMO_WEAK_ALPHA)
        }
      }
    }
  }
}

async function _upsertRateProfile(userId, canonicalRef, projectType, tier, city, mr, lr, alpha) {
  const query = { userId, canonicalRef, tier: tier || null }
  if (city) query.city = city

  const existing = await UserRateProfile.findOne(query)

  if (existing) {
    if (mr) {
      const old = existing.materialRate ? parseFloat(existing.materialRate.toString()) : mr
      existing.materialRate = old * (1 - alpha) + mr * alpha
    }
    if (lr) {
      const old = existing.laborRate ? parseFloat(existing.laborRate.toString()) : lr
      existing.laborRate = old * (1 - alpha) + lr * alpha
    }
    existing.sampleCount += 1
    existing.lastUsed    = new Date()
    await existing.save()
  } else {
    await UserRateProfile.create({
      userId, canonicalRef,
      projectType: projectType || null,
      tier:        tier        || null,
      city:        city        || null,
      materialRate: mr, laborRate: lr, sampleCount: 1
    })
  }
}

/**
 * Learn quantity ratios from finalized estimate categories.
 * Delegates computation to engine's pure extractQuantityLearning().
 */
async function _learnQuantities(categories, userId, projectContext) {
  const EMA_ALPHA = 0.2
  const { tier, projectType } = projectContext

  const deltas = extractQuantityLearning(categories, projectContext)

  for (const d of deltas) {
    const existing = await UserQuantityProfile.findOne({
      userId, canonicalRef: d.canonicalRef, tier: tier || null
    })

    if (existing) {
      if (d.isFixed) {
        const old = existing.fixedQuantity || d.fixedQuantity
        existing.fixedQuantity = Math.round(old * (1 - EMA_ALPHA) + d.fixedQuantity * EMA_ALPHA)
        existing.isFixed = true
      } else {
        const oldRatio = existing.quantityRatio || d.quantityRatio
        existing.quantityRatio = parseFloat(
          (oldRatio * (1 - EMA_ALPHA) + d.quantityRatio * EMA_ALPHA).toFixed(6)
        )
        existing.isFixed = false
      }
      existing.sampleCount += 1
      existing.lastUsed     = new Date()
      await existing.save()
    } else {
      await UserQuantityProfile.create({
        userId,
        canonicalRef:  d.canonicalRef,
        projectType:   projectType || null,
        tier:          d.tier,
        quantityRatio: d.quantityRatio,
        isFixed:       d.isFixed,
        fixedQuantity: d.fixedQuantity,
        sampleCount:   1
      })
    }
  }
}

module.exports = {
  createEstimate,
  getEstimateById,
  saveEstimateVersion,
  getSingleEstimateVersion,
  getEstimateVersions,
  lockEstimate,
  unlockEstimate,
  uploadEstimateItemImage,
  updateEstimateMeta,
  listProjectEstimates,
  deleteEstimate,
  getLevel2Items,
  generateLevel3Estimate
}
