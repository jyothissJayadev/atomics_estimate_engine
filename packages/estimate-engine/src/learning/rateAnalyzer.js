/**
 * rateAnalyzer.js — Pure function, no DB access.
 *
 * Extracts rate-learning deltas from a finalized estimate.
 * Returns structured data that the backend writes to UserRateProfile.
 *
 * Rules:
 *  - Only learn from items the designer explicitly set (rateSource = 'manual' | 'user_history')
 *  - Skip demo_seed and unrated — those were never confirmed by the designer
 *  - Weak signal: if rateSource = 'demo_seed' but sampleCount >= 3 in the calling
 *    context, the backend can choose to apply a weak EMA (handled in estimateController)
 */

const LEARNABLE_SOURCES = new Set(['manual', 'user_history', 'scribd_ratio'])

/**
 * @param {Array}  categories     - finalized EstimateVersion.categories
 * @param {Object} projectContext - { tier, city, projectType, sqft }
 * @returns {Array<{canonicalRef, tier, city, projectType, materialRate, laborRate, isWeak}>}
 */
function extractRateLearning(categories, projectContext) {
  const { tier, city, projectType } = projectContext
  const deltas = []

  for (const cat of (categories || [])) {
    for (const item of (cat.items || [])) {
      if (!item.canonicalRef) continue

      const vals = item.values instanceof Map
        ? Object.fromEntries(item.values)
        : (item.values || {})

      const mr = parseFloat(vals.materialRate ?? vals.rate ?? 0) || null
      const lr = parseFloat(vals.laborRate ?? 0) || null
      if (!mr && !lr) continue

      const rateSource = item.rateSource || 'unrated'

      if (!LEARNABLE_SOURCES.has(rateSource)) continue

      // Tier-only delta (primary lookup key)
      deltas.push({
        canonicalRef: item.canonicalRef,
        tier:         tier || null,
        city:         null,
        projectType:  projectType || null,
        materialRate: mr,
        laborRate:    lr,
        isWeak:       rateSource === 'scribd_ratio', // scribd rates = lower weight
      })

      // City+tier delta for city-specific lookup (Gap 7)
      if (city) {
        deltas.push({
          canonicalRef: item.canonicalRef,
          tier:         tier || null,
          city:         city,
          projectType:  projectType || null,
          materialRate: mr,
          laborRate:    lr,
          isWeak:       rateSource === 'scribd_ratio',
        })
      }
    }
  }

  return deltas
}

module.exports = { extractRateLearning }
