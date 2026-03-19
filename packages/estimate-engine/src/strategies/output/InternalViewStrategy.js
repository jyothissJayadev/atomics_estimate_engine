/**
 * Internal view — shows all cost components including margins.
 * Used by the designer to see their full cost + profit picture.
 */
class InternalViewStrategy {
  /**
   * @param {Array}  categories  - categories with items and computed values
   * @param {Object} totals      - project-level aggregated totals
   * @param {Object} input       - original project input
   * @param {Object} meta        - engine metadata (phase, sources used etc.)
   * @returns {Object}           - shaped for EstimateVersion document
   */
  format(categories, totals, input, meta) {
    return {
      categories,
      computedTotals:  totals.computedTotals,
      generationMeta: {
        pricingSource:          meta.pricingSource,
        budgetDeviationPercent: totals.budgetDeviationPercent,
        generatedAt:            new Date(),
        enginePhase:            meta.enginePhase
      }
    }
  }
}

module.exports = InternalViewStrategy
