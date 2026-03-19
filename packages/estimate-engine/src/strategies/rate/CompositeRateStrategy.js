const { CONFIDENCE, RATE_SOURCE } = require('../../../../../apps/backend/config/constants')

/**
 * Tries each strategy in order. First non-null result wins.
 * This is the only rate strategy the engine talks to directly.
 */
class CompositeRateStrategy {
  /**
   * @param {Array} strategies  - ordered array of strategy instances
   *   e.g. [UserHistoryStrategy, ScridbRatioStrategy, DemoRateStrategy]
   */
  constructor(strategies) {
    this.strategies = strategies || []
  }

  getRates(itemCanonicalRef, tier) {
    for (const strategy of this.strategies) {
      const result = strategy.getRates(itemCanonicalRef, tier)
      if (result !== null && result !== undefined) {
        return result
      }
    }

    // All strategies exhausted — item will appear with blank rates
    return {
      materialRate: null,
      laborRate:    null,
      confidence:   CONFIDENCE.NONE,
      source:       RATE_SOURCE.NONE,
      basis:        'no rate available — enter manually'
    }
  }
}

module.exports = CompositeRateStrategy
