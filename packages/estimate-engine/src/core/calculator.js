const Decimal = require('decimal.js')

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

/**
 * Pure function. No async, no DB, no side effects.
 * Same inputs always produce same outputs.
 *
 * @param {Object} input
 * @param {number} input.quantity
 * @param {number} input.materialRate   - rate per unit for materials
 * @param {number} input.laborRate      - rate per unit for labor (can be 0)
 * @param {number} input.wastage        - percentage (e.g. 5 for 5%)
 * @param {number} input.overhead       - percentage
 * @param {number} input.markup         - percentage
 * @param {number} input.tax            - percentage (GST pass-through)
 * @returns {Object} all calculated values as plain JS numbers
 */
function calculate(input) {
  const {
    quantity     = 0,
    materialRate = 0,
    laborRate    = 0,
    wastage      = 0,
    overhead     = 0,
    markup       = 0,
    tax          = 0
  } = input

  const qty = new Decimal(quantity)
  const mr  = new Decimal(materialRate)
  const lr  = new Decimal(laborRate)
  const w   = new Decimal(wastage)
  const oh  = new Decimal(overhead)
  const mu  = new Decimal(markup)
  const tx  = new Decimal(tax)

  // Step 1 — Direct costs
  const directMaterial = qty.times(mr)
  const directLabor    = qty.times(lr)
  const directCost     = directMaterial.plus(directLabor)

  // Step 2 — Wastage
  const wastageCost   = directCost.times(w.dividedBy(100))
  const adjustedCost  = directCost.plus(wastageCost)

  // Step 3 — Overhead
  const overheadCost  = adjustedCost.times(oh.dividedBy(100))
  const businessCost  = adjustedCost.plus(overheadCost)

  // Step 4 — Markup (profit)
  const profit        = businessCost.times(mu.dividedBy(100))
  const subtotal      = businessCost.plus(profit)   // sell price before tax

  // Step 5 — Tax (GST pass-through, not profit)
  const taxAmount     = subtotal.times(tx.dividedBy(100))
  const finalTotal    = subtotal.plus(taxAmount)

  // Step 6 — Gross margin (on subtotal before tax; tax is pass-through)
  const grossMarginPct = subtotal.isZero()
    ? new Decimal(0)
    : subtotal.minus(directCost).dividedBy(subtotal).times(100)

  return {
    directMaterial:  toNum(directMaterial),
    directLabor:     toNum(directLabor),
    directCost:      toNum(directCost),
    wastageCost:     toNum(wastageCost),
    adjustedCost:    toNum(adjustedCost),
    overheadCost:    toNum(overheadCost),
    businessCost:    toNum(businessCost),
    profit:          toNum(profit),
    subtotal:        toNum(subtotal),
    taxAmount:       toNum(taxAmount),
    finalTotal:      toNum(finalTotal),
    grossMarginPct:  toNum(grossMarginPct)
  }
}

function toNum(decimal) {
  return parseFloat(decimal.toFixed(2))
}

module.exports = { calculate }
