const { CONFIDENCE, RATE_SOURCE } = require('../../../../../apps/backend/config/constants')

/**
 * UserHistoryStrategy
 *
 * Looks up rates from the designer's own past estimates.
 * Uses a priority chain so city-specific rates beat tier-only rates:
 *
 *   1. canonicalRef::tier::city  (most specific — e.g. kit_carcass_ply::balanced::bangalore)
 *   2. canonicalRef::tier        (tier-specific — e.g. kit_carcass_ply::balanced)
 *   3. canonicalRef              (any rate for this item)
 *
 * Map keys are built by the controller when loading UserRateProfiles.
 * The controller must set all three key variants for each profile.
 */
class UserHistoryStrategy {
  /**
   * @param {Map<string, Object>} userRates  - Pre-fetched by controller.
   *   Keys: canonicalRef::tier::city, canonicalRef::tier, canonicalRef
   * @param {string} [city]  - current project city for city-specific lookup
   */
  constructor(userRates, city) {
    this.userRates = userRates || new Map()
    this.city      = city      || null
  }

  getRates(itemCanonicalRef, tier) {
    // Build all lookup keys in priority order
    const keys = []
    if (this.city) {
      keys.push(`${itemCanonicalRef}::${tier}::${this.city}`)
    }
    keys.push(`${itemCanonicalRef}::${tier}`)
    keys.push(itemCanonicalRef)

    let profile = null
    for (const key of keys) {
      profile = this.userRates.get(key)
      if (profile) break
    }

    if (!profile) return null

    const materialRate = profile.materialRate
      ? parseFloat(profile.materialRate.toString())
      : null

    const laborRate = profile.laborRate
      ? parseFloat(profile.laborRate.toString())
      : null

    if (materialRate === null && laborRate === null) return null

    return {
      materialRate,
      laborRate,
      confidence: CONFIDENCE.HIGH,
      source:     RATE_SOURCE.USER,
      basis:      `from ${profile.sampleCount} of your past project(s)`
    }
  }
}

module.exports = UserHistoryStrategy
