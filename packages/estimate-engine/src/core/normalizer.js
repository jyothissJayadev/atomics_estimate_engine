const { SYSTEM_DEFAULTS } = require('../../../../apps/backend/config/constants')

/**
 * Resolves the override priority chain for financial parameters.
 * Order: line-item override → category override → project override → system default
 *
 * @param {Object} itemValues     - item.values Map as plain object
 * @param {Object} categoryDefs   - category-level financial overrides
 * @param {Object} projectDefs    - project-level financial overrides
 * @returns {Object} resolved override values
 */
function resolveOverrides(itemValues, categoryDefs, projectDefs) {
  const resolved = {}
  const fields = ['wastage', 'overhead', 'markup', 'tax']

  for (const field of fields) {
    resolved[field] =
      getVal(itemValues?.[field]) ??
      getVal(categoryDefs?.[field]) ??
      getVal(projectDefs?.[field]) ??
      SYSTEM_DEFAULTS[field]
  }

  return resolved
}

/**
 * Merges item values + rates + resolved overrides into calculator-ready input.
 *
 * @param {Object} itemValues   - item.values as plain object
 * @param {Object} rates        - { materialRate, laborRate } from rate strategy
 * @param {Object} overrides    - output of resolveOverrides()
 * @returns {Object} ready for calculator.calculate()
 */
function buildCalculatorInput(itemValues, rates, overrides) {
  return {
    quantity:     parseFloat(itemValues?.quantity ?? 0),
    materialRate: parseFloat(rates?.materialRate   ?? 0),
    laborRate:    parseFloat(rates?.laborRate      ?? 0),
    wastage:      overrides.wastage,
    overhead:     overrides.overhead,
    markup:       overrides.markup,
    tax:          overrides.tax
  }
}

function getVal(v) {
  if (v === null || v === undefined || v === '') return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

module.exports = { resolveOverrides, buildCalculatorInput }
