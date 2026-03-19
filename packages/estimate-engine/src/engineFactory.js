const EstimateEngine          = require('./engine')
const CompositeRateStrategy   = require('./strategies/rate/CompositeRateStrategy')
const UserHistoryStrategy     = require('./strategies/rate/UserHistoryStrategy')
const ScridbRatioStrategy     = require('./strategies/rate/ScridbRatioStrategy')
const DemoRateStrategy        = require('./strategies/rate/DemoRateStrategy')
const BasicValidationStrategy = require('./strategies/validation/BasicValidationStrategy')
const InternalViewStrategy    = require('./strategies/output/InternalViewStrategy')
const { CURRENT_PHASE }       = require('../../../apps/backend/config/constants')

/**
 * Builds and returns an EstimateEngine configured for the current phase.
 *
 * @param {Object} dbData  - pre-fetched data from controller
 *   Required: { userRates, canonicalNodes }
 *   Phase 2 adds: { sectionStats, parentMap }
 *   New: { canonicalItemMap, city }
 *
 * canonicalItemMap: Map<canonicalId, CanonicalItem> — pre-fetched by controller.
 * DemoRateStrategy reads from this instead of hardcoded constants.
 * If not provided, DemoRateStrategy falls back to hardcoded rates (safe).
 */
function buildEngine(dbData = {}) {
  const { userRates, sectionStats, parentMap } = dbData
  const city             = dbData.city             || null
  const canonicalItemMap = dbData.canonicalItemMap || new Map()

  const validationStrategy = new BasicValidationStrategy()
  const outputStrategy     = new InternalViewStrategy()
  const demoStrategy       = new DemoRateStrategy(canonicalItemMap, city)

  let rateStrategy

  if (CURRENT_PHASE === 1) {
    rateStrategy = new CompositeRateStrategy([
      new UserHistoryStrategy(userRates, city),
      demoStrategy
    ])
  } else if (CURRENT_PHASE === 2) {
    rateStrategy = new CompositeRateStrategy([
      new UserHistoryStrategy(userRates, city),
      new ScridbRatioStrategy(userRates, sectionStats, parentMap),
      demoStrategy
    ])
  } else {
    rateStrategy = new CompositeRateStrategy([
      new UserHistoryStrategy(userRates, city),
      demoStrategy
    ])
  }

  return new EstimateEngine(
    rateStrategy,
    validationStrategy,
    outputStrategy,
    { enginePhase: CURRENT_PHASE }
  )
}

module.exports = { buildEngine }
