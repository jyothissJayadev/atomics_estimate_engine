const { CONFIDENCE, RATE_SOURCE } = require('../../../../../apps/backend/config/constants')

/**
 * Derives rates for unknown items using Scribd cost ratios.
 *
 * Does NOT use Scribd absolute prices (they're old).
 * Uses the ratio: "item X is typically Y% of its section budget"
 * Then scales that against the user's known rates for the same section.
 *
 * Only activates if the user has at least one known rate in the same section.
 */
class ScridbRatioStrategy {
  /**
   * @param {Map<string, Object>} userRates   - user's rate profiles
   * @param {Object} sectionStats             - GlobalSectionStats document
   * @param {Map<string, string>} parentMap   - canonicalRef → parentSectionId
   */
  constructor(userRates, sectionStats, parentMap) {
    this.userRates    = userRates    || new Map()
    this.sectionStats = sectionStats || null
    this.parentMap    = parentMap    || new Map()
  }

  getRates(itemCanonicalRef, tier) {
    if (!this.sectionStats) return null

    const sectionId = this.parentMap.get(itemCanonicalRef)
    if (!sectionId) return null

    // Find any user rate for items in the same section
    const sectionAnchorRate = this._findSectionAnchor(sectionId, tier)
    if (!sectionAnchorRate) return null

    // Get this item's frequency within the section from Scribd stats
    // Issue 4 fix: handle both Mongoose Map (live document) and plain object (.lean())
    const ibf = this.sectionStats.itemFrequencyBySection
    const itemFreqs = ibf
      ? (ibf instanceof Map ? ibf.get(sectionId) : ibf[sectionId])
      : null

    if (!itemFreqs || !itemFreqs[itemCanonicalRef]) return null

    const itemFrequency = itemFreqs[itemCanonicalRef].frequency || 0
    if (itemFrequency < 0.2) return null  // not enough signal

    // Simple heuristic: scale anchor rate by frequency ratio
    const scalingFactor = itemFrequency / (sectionAnchorRate.anchorFrequency || 1)
    const estimatedMaterialRate = Math.round(sectionAnchorRate.materialRate * scalingFactor)

    if (estimatedMaterialRate <= 0) return null

    return {
      materialRate: estimatedMaterialRate,
      laborRate:    null,
      confidence:   CONFIDENCE.MEDIUM,
      source:       RATE_SOURCE.RATIO,
      basis:        'estimated from similar project ratio'
    }
  }

  _findSectionAnchor(sectionId, tier) {
    let bestRate = null
    let bestFrequency = 0

    for (const [key, profile] of this.userRates) {
      const canonicalRef = key.includes('::') ? key.split('::')[0] : key
      const parentSection = this.parentMap.get(canonicalRef)

      if (parentSection !== sectionId) continue

      const materialRate = profile.materialRate
        ? parseFloat(profile.materialRate.toString())
        : null

      if (!materialRate) continue

      const ibf2 = this.sectionStats?.itemFrequencyBySection
      const itemFreqs = ibf2
        ? (ibf2 instanceof Map ? ibf2.get(sectionId) : ibf2[sectionId])
        : null
      const freq = itemFreqs?.[canonicalRef]?.frequency || 0.1

      if (freq > bestFrequency) {
        bestFrequency = freq
        bestRate = { materialRate, anchorFrequency: freq }
      }
    }

    return bestRate
  }
}

module.exports = ScridbRatioStrategy
