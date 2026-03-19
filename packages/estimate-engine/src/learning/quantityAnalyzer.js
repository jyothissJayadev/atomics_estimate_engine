/**
 * quantityAnalyzer.js — Pure function, no DB access.
 *
 * Extracts quantity-learning deltas from a finalized estimate.
 * Returns structured data that the backend writes to UserQuantityProfile.
 *
 * Rules:
 *  - rft items: skip (can't express as qty/sqft)
 *  - lumpsum / nos items: store as fixedQuantity
 *  - All others: store as quantityRatio = qty / sqft
 */

/**
 * @param {Array}  categories     - finalized EstimateVersion.categories
 * @param {Object} projectContext - { tier, city, projectType, sqft }
 * @returns {Array<{canonicalRef, tier, projectType, quantity, unit, isFixed, fixedQuantity, quantityRatio}>}
 */
function extractQuantityLearning(categories, projectContext) {
  const { sqft, tier, projectType } = projectContext
  if (!sqft || sqft <= 0) return []

  const deltas = []

  for (const cat of (categories || [])) {
    for (const item of (cat.items || [])) {
      if (!item.canonicalRef) continue

      const vals = item.values instanceof Map
        ? Object.fromEntries(item.values)
        : (item.values || {})

      const qty  = parseFloat(vals.quantity ?? 0)
      if (!qty || qty <= 0) continue

      const unit    = vals.unit || ''
      if (unit === 'rft') continue   // rft can't be ratio-ised

      const isFixed = unit === 'lumpsum' || unit === 'nos'

      deltas.push({
        canonicalRef:  item.canonicalRef,
        tier:          tier || null,
        projectType:   projectType || null,
        quantity:      qty,
        unit,
        isFixed,
        fixedQuantity: isFixed ? qty : null,
        quantityRatio: isFixed ? null : parseFloat((qty / sqft).toFixed(6)),
      })
    }
  }

  return deltas
}

module.exports = { extractQuantityLearning }
