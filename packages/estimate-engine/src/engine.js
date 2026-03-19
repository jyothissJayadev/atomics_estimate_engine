const { predictSections }              = require('./predictor/structurePredictor')
const { allocateBudget }               = require('./predictor/budgetAllocator')
const { predictItems }                 = require('./predictor/itemPredictor')
const { pruneSections }                = require('./predictor/sectionPruner')
const { estimateQuantities }           = require('./predictor/quantityEstimator')
const { resolveOverrides, buildCalculatorInput } = require('./core/normalizer')
const { calculate }                    = require('./core/calculator')
const { aggregateCategory, aggregateProject } = require('./core/aggregator')

/**
 * EstimateEngine — the single orchestrator.
 *
 * The controller calls engine.predict(input, dbData).
 * The engine never touches the database directly.
 * All DB data is pre-fetched by the controller and passed in.
 *
 * This separation means:
 *   - Engine is fully testable without MongoDB
 *   - DB queries are co-located in the controller (easy to see/optimise)
 *   - Phase upgrades only change engineFactory.js
 */
class EstimateEngine {
  /**
   * @param {Object} rateStrategy       - CompositeRateStrategy instance
   * @param {Object} validationStrategy - BasicValidationStrategy instance
   * @param {Object} outputStrategy     - InternalViewStrategy instance
   * @param {Object} options            - { enginePhase }
   */
  constructor(rateStrategy, validationStrategy, outputStrategy, options = {}) {
    this.rateStrategy       = rateStrategy
    this.validationStrategy = validationStrategy
    this.outputStrategy     = outputStrategy
    this.enginePhase        = options.enginePhase || 1
  }

  /**
   * Generates a full estimate structure from project inputs.
   *
   * @param {Object} input   - { projectType, budget, sqft, rooms, roomSubtype, tier, city, userId }
   * @param {Object} dbData  - { sectionStats, userRates, canonicalNodes }
   * @param {Function} generateId - id generator function
   * @returns {Object}       - formatted by outputStrategy, ready for controller to save
   */
  predict(input, dbData, generateId) {
    // Step 1 — Validate inputs (throws on failure)
    this.validationStrategy.validate(input)

    // Step 2 — Predict section structure
    let sections = predictSections(input, dbData)

    // Step 3 — Allocate budget across sections
    sections = allocateBudget(sections, input, dbData)

    // Step 3b — Prune sections whose budget falls below minimum viable cost
    sections = pruneSections(sections)

    // Step 4 — Build categories with items and rates
    const categories = []
    const rateSources = new Set()

    for (const sectionEntry of sections) {
      // Predict items for this section
      const category = predictItems(sectionEntry, input, dbData, generateId)

      // Step 4b — Estimate quantities using user history + sqft rules
      category.items = estimateQuantities(category.items, input, dbData.userQuantityProfile, dbData.canonicalItemMap)

      // Attach rates and calculate each item
      const processedItems = []
      for (const item of category.items) {
        const processedItem = this._processItem(item, input, dbData)
        rateSources.add(processedItem.rateSource)
        processedItems.push(processedItem)
      }

      category.items = processedItems

      // Aggregate section totals
      category.computedTotals = aggregateCategory(processedItems)

      // Clean up internal-only field before returning
      delete category._allocatedBudget

      categories.push(category)
    }

    // Step 5 — Aggregate project totals
    const projectTotals = aggregateProject(categories, input.budget)

    // Step 6 — Format output
    const pricingSource = derivePricingSource(rateSources)
    const result = this.outputStrategy.format(
      categories,
      projectTotals,
      input,
      { pricingSource, enginePhase: this.enginePhase }
    )

    return result
  }

  /**
   * Recalculates an existing estimate without re-predicting structure.
   * Used when designer changes a rate or quantity manually.
   *
   * @param {Object} existingEstimate - EstimateVersion document (plain object)
   * @param {Object} input            - original project context
   * @returns {Object}                - updated categories + totals
   */
  recalculate(existingEstimate, input) {
    const categories = []

    for (const cat of existingEstimate.categories) {
      const processedItems = []

      for (const item of cat.items) {
        const values   = item.values instanceof Map
          ? Object.fromEntries(item.values)
          : (item.values || {})

        const rates = {
          materialRate: parseFloat(values.materialRate ?? 0),
          laborRate:    parseFloat(values.laborRate    ?? 0)
        }

        const overrides = resolveOverrides(
          values,
          existingEstimate.financialDefaults,
          {}
        )

        const calcInput  = buildCalculatorInput(values, rates, overrides)
        const calcResult = calculate(calcInput)

        const computed = item.computed instanceof Map ? item.computed : new Map()
        for (const [k, v] of Object.entries(calcResult)) {
          computed.set(k, v)
        }

        processedItems.push({ ...item, computed })
      }

      const updatedCat = {
        ...cat,
        items: processedItems,
        computedTotals: aggregateCategory(processedItems)
      }
      categories.push(updatedCat)
    }

    const projectTotals = aggregateProject(categories, input.budget)

    return {
      categories,
      computedTotals:  projectTotals.computedTotals,
      generationMeta: {
        ...existingEstimate.generationMeta,
        budgetDeviationPercent: projectTotals.budgetDeviationPercent,
        recalculatedAt: new Date()
      }
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _processItem(item, input, dbData) {
    // Get values as plain object
    const values = item.values instanceof Map
      ? Object.fromEntries(item.values)
      : (item.values || {})

    // Get rates from composite strategy
    const rates = this.rateStrategy.getRates(item.canonicalRef, input.tier)

    // Resolve financial override chain
    const overrides = resolveOverrides(
      values,
      {},   // category-level overrides (not yet implemented in V1)
      input.financialDefaults || {}
    )

    // Build calculator input — uses rates from strategy
    const calcInput = buildCalculatorInput(values, rates, overrides)

    // Run calculation (pure function)
    const calcResult = calculate(calcInput)

    // Write rates back into values map so they're visible/editable in UI
    const updatedValues = new Map(item.values instanceof Map ? item.values : Object.entries(values))
    if (rates.materialRate !== null) updatedValues.set('materialRate', rates.materialRate)
    if (rates.laborRate    !== null) updatedValues.set('laborRate',    rates.laborRate)

    // Store all calculated outputs in computed map
    const computed = new Map()
    for (const [k, v] of Object.entries(calcResult)) {
      computed.set(k, v)
    }

    return {
      ...item,
      values:     updatedValues,
      computed,
      confidence: rates.confidence,
      rateSource: rates.source
    }
  }
}

function derivePricingSource(rateSources) {
  if (rateSources.has('user_history'))  return 'user_history'
  if (rateSources.has('scribd_ratio'))  return 'scribd_ratio'
  if (rateSources.has('demo_seed'))     return 'demo_seed'
  return 'none'
}

module.exports = EstimateEngine
