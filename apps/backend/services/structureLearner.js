const StructureEvent      = require('../models/StructureEvent')
const CanonicalNode       = require('../models/CanonicalNode')
const UserSectionProfile  = require('../models/UserSectionProfile')
const GlobalSectionStats  = require('../models/GlobalSectionStats')

/**
 * structureLearner
 *
 * Nightly learning job. Reads unprocessed StructureEvent records and:
 *
 *   1. Updates CanonicalNode.predictionWeight (global, all users)
 *   2. Updates UserSectionProfile usage/removal counts (per user)
 *   3. Updates CanonicalNode.predictionWeight for items too (item accept/remove)
 *   4. Synchronises GlobalSectionStats.sectionFrequency with acceptance rates
 *      so the global frequency signal stays in sync with predictionWeight (Gap 4)
 *
 * Idempotent — processes only events where processed=false.
 */
async function run() {
  console.log('[structureLearner] Starting learning run...')
  const startTime = Date.now()

  const events = await StructureEvent.find({
    processed: false,
    eventType: {
      $in: [
        'section_accepted', 'section_removed', 'section_added_manual',
        'item_added', 'item_removed', 'item_added_manual'
      ]
    }
  }).lean()

  if (events.length === 0) {
    console.log('[structureLearner] No unprocessed events. Done.')
    return { eventsProcessed: 0, sectionsUpdated: 0, itemsUpdated: 0, usersUpdated: 0 }
  }

  console.log(`[structureLearner] Processing ${events.length} events...`)

  // Group by canonicalRef for global updates
  const sectionGlobal = {}  // ref → { suggested, accepted, removed, projectType }
  const itemGlobal    = {}  // ref → { suggested, accepted, removed }
  const userStats     = {}  // userId:ref → { ... }

  for (const event of events) {
    const ref = event.canonicalRef
    if (!ref) continue
    const pt = event.context?.projectType || null

    const isSectionEvent = ['section_accepted', 'section_removed', 'section_added_manual'].includes(event.eventType)
    const isItemEvent    = ['item_added', 'item_removed', 'item_added_manual'].includes(event.eventType)

    // ── Global section stats ──────────────────────────────────────────────
    if (isSectionEvent) {
      if (!sectionGlobal[ref]) sectionGlobal[ref] = { suggested: 0, accepted: 0, removed: 0, projectType: pt }
      if (event.eventType === 'section_accepted') { sectionGlobal[ref].suggested++; sectionGlobal[ref].accepted++ }
      if (event.eventType === 'section_removed')  { sectionGlobal[ref].suggested++; sectionGlobal[ref].removed++ }
    }

    // ── Global item stats (for item predictionWeight) ─────────────────────
    if (isItemEvent) {
      if (!itemGlobal[ref]) itemGlobal[ref] = { suggested: 0, accepted: 0, removed: 0 }
      if (event.eventType === 'item_added')   { itemGlobal[ref].suggested++; itemGlobal[ref].accepted++ }
      if (event.eventType === 'item_removed') { itemGlobal[ref].suggested++; itemGlobal[ref].removed++ }
    }

    // ── Per-user section stats ────────────────────────────────────────────
    if (isSectionEvent) {
      const key = `${event.userId}:${ref}`
      if (!userStats[key]) {
        userStats[key] = { userId: event.userId, canonicalRef: ref, projectType: pt, suggested: 0, accepted: 0, removed: 0 }
      }
      if (event.eventType === 'section_accepted') { userStats[key].suggested++; userStats[key].accepted++ }
      if (event.eventType === 'section_removed')  { userStats[key].suggested++; userStats[key].removed++ }
    }
  }

  // ── 1+2. Update CanonicalNode.predictionWeight — bulk fetch, bulk write ─────
  // Issue 3 fix: replaced N+1 findOne per ref with a single bulk fetch + bulkWrite.
  const allRefs   = [...Object.keys(sectionGlobal), ...Object.keys(itemGlobal)]
  const nodesList = await CanonicalNode.find({ canonicalId: { $in: allRefs } }).lean()
  const nodeMap   = new Map(nodesList.map(n => [n.canonicalId, n]))

  const bulkOps = []
  let sectionsUpdated = 0
  let itemsUpdated    = 0

  for (const [ref, stats] of Object.entries(sectionGlobal)) {
    if (stats.suggested === 0) continue
    const node = nodeMap.get(ref)
    if (!node) continue
    const adjustment = ((stats.accepted - stats.removed) / stats.suggested) * 0.1
    const newWeight  = Math.max(0.1, Math.min(2.0, (node.predictionWeight ?? 1.0) + adjustment))
    bulkOps.push({
      updateOne: {
        filter: { canonicalId: ref },
        update: { $set: { predictionWeight: parseFloat(newWeight.toFixed(4)) } }
      }
    })
    sectionsUpdated++
  }

  for (const [ref, stats] of Object.entries(itemGlobal)) {
    if (stats.suggested === 0) continue
    const node = nodeMap.get(ref)
    if (!node) continue
    const adjustment = ((stats.accepted - stats.removed) / stats.suggested) * 0.1
    const newWeight  = Math.max(0.1, Math.min(2.0, (node.predictionWeight ?? 1.0) + adjustment))
    bulkOps.push({
      updateOne: {
        filter: { canonicalId: ref },
        update: { $set: { predictionWeight: parseFloat(newWeight.toFixed(4)) } }
      }
    })
    itemsUpdated++
  }

  if (bulkOps.length > 0) {
    await CanonicalNode.bulkWrite(bulkOps, { ordered: false })
  }

  // ── 3. Update UserSectionProfile counts ───────────────────────────────────
  let usersUpdated = 0
  for (const stats of Object.values(userStats)) {
    if (stats.suggested === 0) continue

    await UserSectionProfile.findOneAndUpdate(
      { userId: stats.userId, canonicalRef: stats.canonicalRef, projectType: stats.projectType },
      {
        $inc: { usageCount: stats.accepted, removalCount: stats.removed },
        $set: { lastUsed: new Date() }
      },
      { upsert: true }
    )
    usersUpdated++
  }

  // ── 4. Sync GlobalSectionStats.sectionFrequency from acceptance rates (Gap 4) ──
  // Group section events by projectType to update the right stats document
  const statsByProjectType = {}
  for (const [ref, stats] of Object.entries(sectionGlobal)) {
    const pt = stats.projectType
    if (!pt) continue
    if (!statsByProjectType[pt]) statsByProjectType[pt] = {}
    statsByProjectType[pt][ref] = stats
  }

  for (const [pt, refs] of Object.entries(statsByProjectType)) {
    const gss = await GlobalSectionStats.findOne({ projectType: pt })
    if (!gss) continue

    const sf = gss.sectionFrequency
    for (const [ref, stats] of Object.entries(refs)) {
      if (stats.suggested === 0) continue
      const acceptRate = stats.accepted / stats.suggested
      const entry = (sf instanceof Map ? sf.get(ref) : sf[ref]) || { count: 0, frequency: 0 }
      // Blend existing frequency with observed acceptance rate
      entry.frequency = parseFloat(
        (entry.frequency * 0.8 + acceptRate * 0.2).toFixed(4)
      )
      if (sf instanceof Map) sf.set(ref, entry)
      else sf[ref] = entry
    }

    gss.markModified('sectionFrequency')
    gss.lastUpdated = new Date()
    await gss.save()
  }

  // Mark all events processed
  const eventIds = events.map(e => e._id)
  await StructureEvent.updateMany(
    { _id: { $in: eventIds } },
    { $set: { processed: true } }
  )

  const elapsed = Date.now() - startTime
  const summary = { eventsProcessed: events.length, sectionsUpdated, itemsUpdated, usersUpdated, elapsedMs: elapsed }
  console.log(`[structureLearner] Done in ${elapsed}ms.`, summary)
  return summary
}

module.exports = { run }
