/**
 * quantityEstimator — pure function, no DB, no side effects.
 *
 * Fills in null quantities on item stubs using a three-tier priority chain:
 *
 *   1. Designer-entered value (already in item.values — always preserved)
 *   2. UserQuantityProfile (learned from designer's own finalized estimates)
 *      - sampleCount >= 3 → use user ratio directly
 *      - sampleCount 1-2  → blend 60% user + 40% rule
 *   3. CanonicalItem.quantityRule from canonicalItemMap (DB-sourced, replaces QUANTITY_RULES)
 *      Falls back to QUANTITY_RULES constant if canonicalItemMap is not provided.
 *   4. null — stays null, designer enters manually
 */
const { QUANTITY_RULES } = require('../../../../apps/backend/config/constants')

function estimateQuantities(items, projectContext, userQuantityProfile, canonicalItemMap) {
  const { sqft = 100, tier } = projectContext

  return items.map(item => {
    const values = item.values instanceof Map
      ? item.values
      : new Map(Object.entries(item.values || {}))

    // ── Priority 1: Respect any designer-entered value ────────────────────
    const existingQty = values.get('quantity')
    if (existingQty !== null && existingQty !== undefined && existingQty > 0) {
      return item
    }

    // ── Priority 2: User's learned quantity profile ───────────────────────
    let userQty = null
    if (userQuantityProfile) {
      const profile = userQuantityProfile instanceof Map
        ? userQuantityProfile.get(item.canonicalRef)
        : (userQuantityProfile[item.canonicalRef] || null)

      if (profile) {
        if (profile.isFixed && profile.fixedQuantity) {
          userQty = profile.fixedQuantity
        } else if (profile.quantityRatio && profile.sampleCount >= 1) {
          userQty = Math.ceil(sqft * profile.quantityRatio)
        }
      }
    }

    // ── Priority 3: Quantity rule ──────────────────────────────────────────
    // First try canonicalItemMap (DB-sourced, always current),
    // fall back to QUANTITY_RULES constant (hardcoded, legacy safety net).
    let rule = null
    if (canonicalItemMap) {
      const catalogItem = canonicalItemMap instanceof Map
        ? canonicalItemMap.get(item.canonicalRef)
        : canonicalItemMap[item.canonicalRef]
      if (catalogItem?.quantityRule?.type) {
        rule = catalogItem.quantityRule
      }
    }
    if (!rule) {
      rule = QUANTITY_RULES[item.canonicalRef] || null
    }

    const ruleQty = rule ? applyRule(rule, sqft) : null

    // ── Blend / select ────────────────────────────────────────────────────
    let qty = null
    const samples = userQuantityProfile
      ? (userQuantityProfile instanceof Map
          ? userQuantityProfile.get(item.canonicalRef)?.sampleCount
          : userQuantityProfile[item.canonicalRef]?.sampleCount) || 0
      : 0

    if (userQty !== null && ruleQty !== null) {
      if (samples >= 3) {
        qty = userQty
      } else {
        qty = Math.ceil(userQty * 0.6 + ruleQty * 0.4)
      }
    } else if (userQty !== null) {
      qty = userQty
    } else if (ruleQty !== null) {
      qty = ruleQty
    }

    if (qty === null) return item

    const updatedValues = new Map(values)
    updatedValues.set('quantity', qty)

    return { ...item, values: updatedValues }
  })
}

function applyRule(rule, sqft) {
  switch (rule.type) {
    case 'sqft_multiplier':
      return Math.ceil(sqft * rule.multiplier)
    case 'fixed':
      return rule.value
    case 'count_from_sqft':
      return Math.ceil(sqft / rule.divisor)
    case 'wall_linear': {
      const approxPerimeter = 4 * Math.sqrt(sqft)
      return Math.ceil(approxPerimeter * rule.multiplier)
    }
    default:
      return null
  }
}

module.exports = { estimateQuantities }
