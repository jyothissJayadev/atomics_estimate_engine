const { SECTION_MIN_COSTS } = require('../../../../apps/backend/config/constants')

/**
 * sectionPruner — runs after budgetAllocator, before itemPredictor.
 *
 * Removes sections whose allocatedBudget falls below the minimum
 * realistic cost for that section type.
 *
 * Rules:
 *   - Flexible sections: pruned if allocatedBudget < minCost
 *   - Non-flexible anchor sections: pruned only if allocatedBudget < minCost × 0.5
 *     (anchors get a softer floor — they're always relevant, just may need
 *      the designer to top up budget manually)
 *
 * @param {Array}  sections  - output of budgetAllocator (with allocatedBudget)
 * @returns {Array}          - filtered sections, pruned ones removed
 */
function pruneSections(sections) {
  const kept    = []
  const pruned  = []

  for (const s of sections) {
    const cid    = s.canonicalNode.canonicalId
    const budget = s.allocatedBudget || 0

    // Look up minimum cost — fall back to node's own field, then default
    const minCost =
      SECTION_MIN_COSTS[cid] ??
      s.canonicalNode.minCostEstimate ??
      SECTION_MIN_COSTS._default

    // Anchor sections (isFlexible = false) use a 50% floor
    const floor = s.isAnchor ? minCost * 0.5 : minCost

    if (budget >= floor) {
      kept.push(s)
    } else {
      pruned.push({ canonicalId: cid, allocatedBudget: budget, floor })
    }
  }

  if (pruned.length > 0) {
    const names = pruned.map(p => `${p.canonicalId} (₹${p.allocatedBudget} < ₹${p.floor})`).join(', ')
    console.log(`[sectionPruner] Pruned ${pruned.length} section(s): ${names}`)
  }

  return kept
}

module.exports = { pruneSections }
