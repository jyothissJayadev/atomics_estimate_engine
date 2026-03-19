const { BUDGET_BUFFER, DEFAULT_BUDGET_RATIOS } = require('../../../../apps/backend/config/constants')

/**
 * Allocates the total project budget across predicted sections.
 *
 * Priority chain for each section's ratio:
 *   1. UserSectionProfile.avgBudgetShare (designer's own real spending history)
 *      Only used if usageCount >= 2 — one sample could be a fluke.
 *   2. GlobalSectionStats.sectionBudgetRatio (Scribd-derived averages)
 *   3. DEFAULT_BUDGET_RATIOS (hardcoded fallback constants)
 *
 * Ratios are normalised so they sum to 1.0 for selected sections.
 *
 * @param {Array}  sections  - output of structurePredictor (with canonicalNode)
 * @param {Object} input     - { budget }
 * @param {Object} dbData    - { sectionStats, userSectionProfile }
 * @returns {Array}          - same sections with allocatedBudget filled in
 */
function allocateBudget(sections, input, dbData) {
  const { budget } = input
  const { sectionStats, userSectionProfile } = dbData

  const available = budget * (1 - BUDGET_BUFFER)

  const rawRatios = {}
  for (const s of sections) {
    const cid = s.canonicalNode.canonicalId
    let ratio = null

    // ── Priority 1: User's own historical spending ratio ─────────────────
    if (userSectionProfile) {
      const profile = userSectionProfile instanceof Map
        ? userSectionProfile.get(cid)
        : (userSectionProfile[cid] || null)
      if (profile && profile.avgBudgetShare && profile.usageCount >= 2) {
        ratio = profile.avgBudgetShare
      }
    }

    // ── Priority 2: Scribd global stats ──────────────────────────────────
    if (ratio === null && sectionStats && sectionStats.sectionBudgetRatio) {
      const sbr   = sectionStats.sectionBudgetRatio
      const entry = (sbr instanceof Map) ? sbr.get(cid) : sbr[cid]
      if (entry && entry.samples > 0) {
        ratio = entry.mean
      }
    }

    // ── Priority 3: Hardcoded defaults ───────────────────────────────────
    if (ratio === null || ratio === undefined) {
      ratio = DEFAULT_BUDGET_RATIOS[cid] ?? null
    }

    rawRatios[cid] = ratio
  }

  const withRatio    = sections.filter(s => rawRatios[s.canonicalNode.canonicalId] !== null)
  const withoutRatio = sections.filter(s => rawRatios[s.canonicalNode.canonicalId] === null)

  const knownRatioSum = withRatio.reduce(
    (sum, s) => sum + (rawRatios[s.canonicalNode.canonicalId] || 0), 0
  )

  const remainderRatio       = Math.max(0, 1.0 - knownRatioSum)
  const equalShareForUnknown = withoutRatio.length > 0
    ? remainderRatio / withoutRatio.length
    : 0

  for (const s of withoutRatio) {
    rawRatios[s.canonicalNode.canonicalId] = equalShareForUnknown || (1.0 / sections.length)
  }

  const totalRatio = sections.reduce(
    (sum, s) => sum + (rawRatios[s.canonicalNode.canonicalId] || 0), 0
  )

  for (const s of sections) {
    const cid             = s.canonicalNode.canonicalId
    const normalisedRatio = totalRatio > 0
      ? (rawRatios[cid] || 0) / totalRatio
      : (1.0 / sections.length)

    s.allocatedBudget = Math.round(available * normalisedRatio)
  }

  return sections
}

module.exports = { allocateBudget }
