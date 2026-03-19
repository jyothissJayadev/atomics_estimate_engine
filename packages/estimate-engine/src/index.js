const { extractRateLearning }     = require('./learning/rateAnalyzer')
const { extractQuantityLearning } = require('./learning/quantityAnalyzer')
const { extractStructureLearning }= require('./learning/structureAnalyzer')

const EstimateEngine          = require('./engine')
const { buildEngine }         = require('./engineFactory')
const { calculate }           = require('./core/calculator')
const { aggregateCategory, aggregateProject } = require('./core/aggregator')
const { resolveOverrides, buildCalculatorInput } = require('./core/normalizer')
const { pruneSections }       = require('./predictor/sectionPruner')
const { estimateQuantities }  = require('./predictor/quantityEstimator')

module.exports = {
  EstimateEngine,
  buildEngine,
  calculate,
  aggregateCategory,
  aggregateProject,
  resolveOverrides,
  buildCalculatorInput,
  pruneSections,
  estimateQuantities,
  // Learning analytics — pure functions, no DB
  extractRateLearning,
  extractQuantityLearning,
  extractStructureLearning,
}
