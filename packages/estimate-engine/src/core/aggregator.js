const Decimal = require('decimal.js')

/**
 * Aggregates item-level calculated values into a category total.
 *
 * @param {Array} items  - items with computed Map already populated
 * @returns {Object}     - { totalCost, totalSell, marginAmount, marginPercent }
 */
function aggregateCategory(items) {
  let totalCost    = new Decimal(0)
  let totalSell    = new Decimal(0)

  for (const item of items) {
    const computed = item.computed instanceof Map
      ? Object.fromEntries(item.computed)
      : (item.computed || {})

    // Issue 2 fix: totalCost = direct cost to the business (material + labour + wastage + overhead)
    // totalSell = sell price (pre-GST, markup applied) — GST is a pass-through, not margin
    // Using finalTotal (post-GST) as "cost" always produces negative margins — that was the bug.
    totalCost = totalCost.plus(new Decimal(computed.directCost ?? 0))
    totalSell = totalSell.plus(new Decimal(computed.subtotal   ?? 0))
  }

  const marginAmount  = totalSell.minus(totalCost)
  const marginPercent = totalSell.isZero()
    ? new Decimal(0)
    : marginAmount.dividedBy(totalSell).times(100)

  return {
    totalCost:     toNum(totalCost),
    totalSell:     toNum(totalSell),
    marginAmount:  toNum(marginAmount),
    marginPercent: toNum(marginPercent)
  }
}

/**
 * Aggregates category totals into a project total.
 *
 * @param {Array}  categories  - categories with computedTotals filled
 * @param {number} inputBudget - original budget from user input
 * @returns {Object}           - project-level totals + deviation
 */
function aggregateProject(categories, inputBudget) {
  let totalCost   = new Decimal(0)
  let totalSell   = new Decimal(0)

  for (const cat of categories) {
    totalCost = totalCost.plus(new Decimal(cat.computedTotals?.totalCost ?? 0))
    totalSell = totalSell.plus(new Decimal(cat.computedTotals?.totalSell ?? 0))
  }

  const marginAmount  = totalSell.minus(totalCost)
  const marginPercent = totalSell.isZero()
    ? new Decimal(0)
    : marginAmount.dividedBy(totalSell).times(100)

  const budgetDeviationPercent = inputBudget && inputBudget > 0
    ? toNum(totalSell.minus(inputBudget).dividedBy(inputBudget).times(100))
    : null

  return {
    computedTotals: {
      subtotal:      toNum(totalSell),
      totalCost:     toNum(totalCost),
      totalSell:     toNum(totalSell),
      marginAmount:  toNum(marginAmount),
      marginPercent: toNum(marginPercent)
    },
    budgetDeviationPercent
  }
}

function toNum(decimal) {
  return parseFloat(decimal.toFixed(2))
}

module.exports = { aggregateCategory, aggregateProject }
