const StructureEvent      = require('../models/StructureEvent')
const { extractStructureLearning } = require('@atomics/estimate-engine')
const UserSectionProfile  = require('../models/UserSectionProfile')
const GlobalSectionStats  = require('../models/GlobalSectionStats')

/**
 * structureEventProcessor
 *
 * Called when an estimate is locked. Does four things:
 *
 *   1. SECTION DIFF: Compares AI-suggested sections against final locked sections.
 *      Writes section_accepted / section_removed / section_added_manual events.
 *
 *   2. ITEM DIFF: For each section kept in the final estimate, compares
 *      AI-predicted items against final items. Writes item_accepted /
 *      item_removed / item_added_manual events. (Gap 3)
 *
 *   3. UserSectionProfile: Updates per-user usage/removal counts, avgBudgetShare,
 *      itemUsage, and itemRemovalCount.
 *
 *   4. GlobalSectionStats: Increments sectionFrequency and itemFrequencyBySection
 *      from this real estimate — so global stats improve from user data, not
 *      just from the Scribd seed. (Gap 2)
 *
 * All writes are fire-and-forget from lockEstimate — never block the response.
 */
async function process(estimate, version, userId, projectContext) {
  try {
    const estimateId = estimate._id.toString()
    const projectId  = estimate.projectId.toString()
    const { projectType, tier, city, sqft, rooms, roomSubtype, budget } = projectContext

    // ── Fetch AI-suggested section events for this estimate ────────────────
    const aiSectionEvents = await StructureEvent.find({
      estimateId,
      wasAiSuggested: true,
      userAccepted:   null,
      eventType:      { $in: ['section_added', 'estimate_generated'] }
    }).lean()

    const aiSuggestedRefs = new Set(aiSectionEvents.map(e => e.canonicalRef).filter(Boolean))

    const finalCategories = version.categories || []
    const finalRefs       = new Set(finalCategories.map(c => c.canonicalRef).filter(Boolean))

    const eventContext = { projectType, tier, city, sqft, rooms, roomSubtype, budget }
    const newEvents    = []

    // ── 1. Section diff ────────────────────────────────────────────────────
    for (const ref of aiSuggestedRefs) {
      newEvents.push({
        projectId, estimateId, userId,
        eventType:      finalRefs.has(ref) ? 'section_accepted' : 'section_removed',
        canonicalRef:   ref,
        context:        eventContext,
        wasAiSuggested: true,
        userAccepted:   finalRefs.has(ref)
      })
    }
    for (const ref of finalRefs) {
      if (!aiSuggestedRefs.has(ref)) {
        newEvents.push({
          projectId, estimateId, userId,
          eventType:      'section_added_manual',
          canonicalRef:   ref,
          context:        eventContext,
          wasAiSuggested: false,
          userAccepted:   true
        })
      }
    }

    // ── 2. Item diff — per section ─────────────────────────────────────────
    // Build a map of AI-predicted items per section from the version categories
    // The first EstimateVersion (v1) holds the AI-generated items.
    // We compare those against the locked version's items.
    const aiItemsBySection = await _getAiPredictedItems(estimateId, estimate._id)

    for (const finalCat of finalCategories) {
      const sectionRef = finalCat.canonicalRef
      if (!sectionRef) continue

      const aiItems   = aiItemsBySection[sectionRef] || new Set()
      const finalItems = new Set(
        (finalCat.items || []).map(i => i.canonicalRef).filter(Boolean)
      )

      for (const itemRef of aiItems) {
        newEvents.push({
          projectId, estimateId, userId,
          eventType:      finalItems.has(itemRef) ? 'item_added' : 'item_removed',
          canonicalRef:   itemRef,
          context:        { ...eventContext, sectionRef },
          wasAiSuggested: true,
          userAccepted:   finalItems.has(itemRef)
        })
      }

      // Items the designer added that weren't AI-predicted
      for (const itemRef of finalItems) {
        if (!aiItems.has(itemRef)) {
          newEvents.push({
            projectId, estimateId, userId,
            eventType:      'item_added_manual',
            canonicalRef:   itemRef,
            context:        { ...eventContext, sectionRef },
            wasAiSuggested: false,
            userAccepted:   true
          })
        }
      }
    }

    // Write all events in one batch
    if (newEvents.length > 0) {
      await StructureEvent.insertMany(newEvents)
    }

    // Mark original AI section events as processed
    if (aiSectionEvents.length > 0) {
      await StructureEvent.updateMany(
        { _id: { $in: aiSectionEvents.map(e => e._id) } },
        { $set: { processed: true } }
      )
    }

    // ── 3. Update UserSectionProfile ──────────────────────────────────────
    await _updateUserSectionProfile(
      userId, projectType, finalCategories, aiSuggestedRefs, aiItemsBySection, projectContext
    )

    // ── 4. Update GlobalSectionStats from real estimate data (Gap 2) ──────
    await _updateGlobalSectionStats(finalCategories, projectType)

    console.log(`[structureEventProcessor] estimate=${estimateId} sectionEvents=${
      newEvents.filter(e => e.eventType.startsWith('section')).length
    } itemEvents=${
      newEvents.filter(e => e.eventType.startsWith('item')).length
    }`)

  } catch (err) {
    console.error('[structureEventProcessor] Error (non-critical):', err.message)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Retrieves the AI-predicted items for each section.
 * Uses version 1 (always the AI-generated initial estimate) as the source of truth
 * for what items were originally predicted. Falls back to current version categories
 * if no v1 is available (e.g. manually created estimates).
 */
async function _getAiPredictedItems(estimateId, estimateObjectId) {
  const EstimateVersion = require('../models/finance/EstimateVersion')

  const v1 = await EstimateVersion.findOne({
    estimateId: estimateObjectId,
    versionNumber: 1
  }).lean()

  const categories = v1 ? (v1.categories || []) : []
  const result = {}

  for (const cat of categories) {
    if (!cat.canonicalRef) continue
    result[cat.canonicalRef] = new Set(
      (cat.items || []).map(i => i.canonicalRef).filter(Boolean)
    )
  }

  return result
}

/**
 * Updates UserSectionProfile for all final sections and items.
 * Tracks: usageCount, removalCount, avgBudgetShare, itemUsage, itemRemovalCount.
 */
async function _updateUserSectionProfile(
  userId, projectType, finalCategories, aiSuggestedRefs, aiItemsBySection, projectContext
) {
  const totalSell = finalCategories.reduce(
    (s, cat) => s + (cat.computedTotals?.totalSell || 0), 0
  )

  for (const cat of finalCategories) {
    if (!cat.canonicalRef) continue

    const sectionRef  = cat.canonicalRef
    const sectionSell = cat.computedTotals?.totalSell || 0
    const budgetShare = totalSell > 0 ? sectionSell / totalSell : null

    const finalItemRefs = new Set(
      (cat.items || []).map(i => i.canonicalRef).filter(Boolean)
    )
    const aiItemRefs = aiItemsBySection[sectionRef] || new Set()

    const existing = await UserSectionProfile.findOne({
      userId, canonicalRef: sectionRef, projectType
    })

    if (existing) {
      existing.usageCount += 1

      if (budgetShare !== null) {
        const n = existing.usageCount
        existing.avgBudgetShare = existing.avgBudgetShare
          ? ((existing.avgBudgetShare * (n - 1)) + budgetShare) / n
          : budgetShare
      }

      // Increment item usage counts
      for (const itemRef of finalItemRefs) {
        existing.itemUsage.set(
          itemRef,
          (existing.itemUsage.get(itemRef) || 0) + 1
        )
      }

      // Increment item removal counts for AI items that were removed
      for (const itemRef of aiItemRefs) {
        if (!finalItemRefs.has(itemRef)) {
          existing.itemRemovalCount.set(
            itemRef,
            (existing.itemRemovalCount.get(itemRef) || 0) + 1
          )
        }
      }

      existing.lastUsed = new Date()
      existing.markModified('itemUsage')
      existing.markModified('itemRemovalCount')
      await existing.save()
    } else {
      const itemUsageInit         = {}
      const itemRemovalCountInit  = {}
      for (const itemRef of finalItemRefs) itemUsageInit[itemRef] = 1
      for (const itemRef of aiItemRefs) {
        if (!finalItemRefs.has(itemRef)) itemRemovalCountInit[itemRef] = 1
      }

      await UserSectionProfile.create({
        userId,
        canonicalRef:     sectionRef,
        projectType,
        usageCount:       1,
        removalCount:     0,
        avgBudgetShare:   budgetShare,
        itemUsage:        new Map(Object.entries(itemUsageInit)),
        itemRemovalCount: new Map(Object.entries(itemRemovalCountInit)),
        lastUsed:         new Date()
      })
    }
  }

  // Increment removalCount for AI sections the designer removed
  for (const ref of aiSuggestedRefs) {
    if (!finalCategories.some(cat => cat.canonicalRef === ref)) {
      await UserSectionProfile.findOneAndUpdate(
        { userId, canonicalRef: ref, projectType },
        {
          $inc:      { removalCount: 1 },
          $setOnInsert: { usageCount: 0, lastUsed: new Date() }
        },
        { upsert: true }
      )
    }
  }
}

/**
 * Gap 2 fix: Updates GlobalSectionStats from a real locked estimate.
 * Increments sectionFrequency and itemFrequencyBySection counts,
 * then recomputes frequencies from cumulative counts.
 */
async function _updateGlobalSectionStats(finalCategories, projectType) {
  try {
    const stats = await GlobalSectionStats.findOne({ projectType })
    if (!stats) return

    const sf  = stats.sectionFrequency
    const ibf = stats.itemFrequencyBySection

    for (const cat of finalCategories) {
      if (!cat.canonicalRef) continue
      const cid = cat.canonicalRef

      // Increment section count
      const sfEntry = (sf instanceof Map ? sf.get(cid) : sf[cid]) || { count: 0, frequency: 0 }
      sfEntry.count += 1
      if (sf instanceof Map) sf.set(cid, sfEntry)
      else sf[cid] = sfEntry

      // Increment item counts within section
      if (!ibf) continue
      let sectionItemMap = (ibf instanceof Map ? ibf.get(cid) : ibf[cid])
      if (!sectionItemMap) {
        sectionItemMap = {}
        if (ibf instanceof Map) ibf.set(cid, sectionItemMap)
        else ibf[cid] = sectionItemMap
      }

      for (const item of (cat.items || [])) {
        if (!item.canonicalRef) continue
        const iEntry = sectionItemMap[item.canonicalRef] || { count: 0, frequency: 0 }
        iEntry.count += 1
        sectionItemMap[item.canonicalRef] = iEntry
      }
    }

    // Recompute frequencies from counts
    stats.sampleCount += 1
    const totalSamples = stats.sampleCount

    if (sf instanceof Map) {
      for (const [cid, entry] of sf) {
        entry.frequency = parseFloat((entry.count / totalSamples).toFixed(4))
        sf.set(cid, entry)
      }
    } else {
      for (const cid of Object.keys(sf)) {
        sf[cid].frequency = parseFloat((sf[cid].count / totalSamples).toFixed(4))
      }
    }

    // Recompute item frequencies within each section
    if (ibf) {
      const ibfObj = ibf instanceof Map ? Object.fromEntries(ibf) : ibf
      for (const sectionId of Object.keys(ibfObj)) {
        const sectionItemMap = ibfObj[sectionId]
        for (const itemId of Object.keys(sectionItemMap)) {
          const entry = sectionItemMap[itemId]
          entry.frequency = parseFloat((entry.count / totalSamples).toFixed(4))
        }
        if (ibf instanceof Map) ibf.set(sectionId, sectionItemMap)
        else ibf[sectionId] = sectionItemMap
      }
    }

    stats.lastUpdated = new Date()
    stats.source      = 'mixed'
    stats.markModified('sectionFrequency')
    stats.markModified('itemFrequencyBySection')
    await stats.save()
  } catch (err) {
    console.error('[structureEventProcessor] GlobalSectionStats update failed:', err.message)
  }
}

module.exports = { process, _updateUserSectionProfile, _updateGlobalSectionStats }
