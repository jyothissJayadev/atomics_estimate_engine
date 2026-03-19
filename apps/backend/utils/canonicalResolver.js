const CanonicalItem = require('../models/CanonicalItem')

/**
 * canonicalResolver
 *
 * Resolves a raw string from an uploaded estimate to a CanonicalItem entry.
 *
 * Reads from CanonicalItem (the permanent product dictionary) — NOT CanonicalNode.
 * This ensures resolution works correctly on day one before any estimates are locked,
 * because CanonicalItem is seeded once with the full catalogue including all aliases.
 *
 * Once resolved, the canonicalId is stored on the item in the uploaded estimate data
 * and flows into CanonicalNode via the learning pipeline (UserRateProfile,
 * GlobalSectionStats, structureEventProcessor) when the estimate is locked.
 *
 * Resolution steps (in order):
 *   1. Exact alias match         (score 1.0)
 *   2. Label partial match       (score 0.82)
 *   3. Token overlap             (score 0.50–0.99)
 *   4. Unresolved                (score null)
 */
async function resolveCanonical(rawName, parentCanonicalId, options = {}) {
  if (!rawName || typeof rawName !== 'string') {
    return { canonicalId: null, label: null, status: 'unresolved', score: null }
  }

  const searchStr = rawName.toLowerCase().trim()
  const levels    = options.levels || [2, 3]

  const baseQuery = { status: 'active', level: { $in: levels } }
  if (parentCanonicalId) baseQuery.parentId = parentCanonicalId

  // ── Step 1: Exact alias match ─────────────────────────────────────────────
  const exact = await CanonicalItem.findOne({
    ...baseQuery,
    aliases: { $elemMatch: { $regex: new RegExp(`^${escapeRegex(searchStr)}$`, 'i') } }
  }).lean()

  if (exact) {
    return { canonicalId: exact.canonicalId, label: exact.label, status: 'resolved', score: 1.0 }
  }

  // ── Step 2: Label partial match ───────────────────────────────────────────
  const partial = await CanonicalItem.findOne({
    ...baseQuery,
    label: { $regex: new RegExp(escapeRegex(searchStr), 'i') }
  }).lean()

  if (partial) {
    return { canonicalId: partial.canonicalId, label: partial.label, status: 'resolved', score: 0.82 }
  }

  // ── Step 3: Token overlap ─────────────────────────────────────────────────
  const tokens = searchStr
    .split(/[\s,\/\-_]+/)
    .filter(t => t.length > 2)
    .map(t => escapeRegex(t))

  if (tokens.length > 0) {
    const tokenRegex = new RegExp(tokens.join('|'), 'i')

    const candidates = await CanonicalItem.find({
      ...baseQuery,
      $or: [
        { label:   { $regex: tokenRegex } },
        { aliases: { $elemMatch: { $regex: tokenRegex } } }
      ]
    }).lean()

    if (candidates.length > 0) {
      const inputTokens = searchStr.split(/[\s,\/\-_]+/).filter(t => t.length > 2)

      const scored = candidates.map(c => ({
        node:  c,
        score: tokenOverlapScore(inputTokens, c.label, c.aliases)
      })).sort((a, b) => b.score - a.score)

      const best = scored[0]

      if (best.score >= 0.75) {
        return { canonicalId: best.node.canonicalId, label: best.node.label, status: 'resolved',       score: parseFloat(best.score.toFixed(3)) }
      }
      if (best.score >= 0.40) {
        return { canonicalId: best.node.canonicalId, label: best.node.label, status: 'pending_review', score: parseFloat(best.score.toFixed(3)) }
      }
    }
  }

  // ── Step 4: Unresolved ────────────────────────────────────────────────────
  return { canonicalId: null, label: null, status: 'unresolved', score: null }
}

/**
 * Resolves a full estimate section array in one pass.
 */
async function resolveSections(sections) {
  const resolved = []
  for (const section of sections) {
    if (section.canonicalId && section.canonicalStatus === 'resolved') {
      resolved.push(section)
      continue
    }
    const r = await resolveCanonical(section.rawName, null, { levels: [2] })
    resolved.push({
      ...section,
      canonicalId:     r.canonicalId     || section.canonicalId,
      canonicalStatus: r.canonicalId     ? r.status : 'unresolved',
      canonicalScore:  r.score
    })
  }
  return resolved
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenOverlapScore(inputTokens, label, aliases) {
  const allText    = [label, ...(aliases || [])].join(' ').toLowerCase()
  const targetToks = allText.split(/[\s,\/\-_]+/).filter(t => t.length > 2)
  const intersection = inputTokens.filter(t =>
    targetToks.some(tt => tt.includes(t) || t.includes(tt))
  )
  const maxLen = Math.max(inputTokens.length, targetToks.length)
  return maxLen === 0 ? 0 : intersection.length / maxLen
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = { resolveCanonical, resolveSections }
