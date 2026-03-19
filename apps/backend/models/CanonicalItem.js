const mongoose = require('mongoose')

/**
 * CanonicalItem — the constant product catalogue.
 *
 * This is distinct from CanonicalNode (which accumulates learning/prediction weights).
 * CanonicalItem stores the stable, authoritative definition of every item:
 *   - What it is (label, aliases, unit)
 *   - Where it belongs (projectTypes, parentId, level)
 *   - How much it costs (baselineRates per tier, regionMultipliers per city)
 *   - How much of it to predict (quantityRule)
 *   - Budget allocation metadata (defaultBudgetRatio, minCostEstimate)
 *
 * Used by:
 *   - Step 5 AddItemPicker (replaces canonicalCatalog.json)
 *   - DemoRateStrategy (replaces DEMO_RATES constants)
 *   - quantityEstimator fallback (replaces QUANTITY_RULES constants)
 *   - uploadController canonical resolution
 *   - Auto-promotion: new items detected in uploaded estimates → pending_review here
 */
const baselineRateSchema = new mongoose.Schema({
  materialRate: { type: Number, default: 0 },
  laborRate:    { type: Number, default: 0 }
}, { _id: false })

const quantityRuleSchema = new mongoose.Schema({
  type:       { type: String, enum: ['sqft_multiplier', 'fixed', 'count_from_sqft', 'wall_linear', 'rft_per_room', null], default: null },
  multiplier: { type: Number, default: null },
  divisor:    { type: Number, default: null },
  value:      { type: Number, default: null }
}, { _id: false })

const canonicalItemSchema = new mongoose.Schema({
  // Identity — matches CanonicalNode.canonicalId
  canonicalId: { type: String, required: true, unique: true, trim: true },
  label:       { type: String, required: true, trim: true },
  level:       { type: Number, required: true, enum: [1, 2, 3, 4] },
  parentId:    { type: String, default: null },
  defaultUnit: { type: String, enum: ['sqft', 'rft', 'nos', 'lumpsum', null], default: null },
  isFlexible:  { type: Boolean, default: true },
  projectTypes: [{ type: String }],
  aliases:     [{ type: String, trim: true }],

  // Lifecycle
  status: {
    type:    String,
    enum:    ['active', 'pending_review', 'deprecated'],
    default: 'active'
  },
  source: {
    type:    String,
    enum:    ['seed', 'auto_promoted', 'admin'],
    default: 'seed'
  },

  // ── Rate information (replaces DEMO_RATES in DemoRateStrategy.js) ──────────
  // Baseline rates per pricing tier. DemoRateStrategy reads these from DB
  // instead of the hardcoded constant map.
  baselineRates: {
    budget:   { type: baselineRateSchema, default: () => ({}) },
    balanced: { type: baselineRateSchema, default: () => ({}) },
    premium:  { type: baselineRateSchema, default: () => ({}) }
  },

  // Per-city multiplier on top of baseline rates.
  // Bangalore = 1.0 (baseline). All other cities expressed relative to it.
  // e.g. { 'mumbai': 1.22, 'delhi': 1.18, 'pune': 1.05, 'hyderabad': 0.97 }
  regionMultipliers: {
    type:    Map,
    of:      Number,
    default: {}
  },

  // ── Quantity rule (replaces QUANTITY_RULES in constants.js) ────────────────
  quantityRule: { type: quantityRuleSchema, default: null },

  // ── Budget allocation (L2 sections only) ───────────────────────────────────
  // Replaces DEFAULT_BUDGET_RATIOS and SECTION_MIN_COSTS in constants.js
  defaultBudgetRatio: { type: Number, default: null },   // e.g. 0.28 for kitchen
  minCostEstimate:    { type: Number, default: null },   // e.g. 80000 for kitchen

  // Display order within project type (replaces ANCHOR_ORDER array)
  displayOrder: { type: Number, default: 999 },
  isAnchor:     { type: Boolean, default: false },

  // Tier relevance (mirrors CanonicalNode.appropriateTiers)
  appropriateTiers: [{
    type: String,
    enum: ['budget', 'balanced', 'premium']
  }],

  // Notes / admin comments
  notes: { type: String, default: '' }
}, {
  timestamps: true
})

canonicalItemSchema.index({ projectTypes: 1, level: 1, status: 1 })
canonicalItemSchema.index({ parentId: 1, level: 1, status: 1 })
canonicalItemSchema.index({ aliases: 1 })
canonicalItemSchema.index({ level: 1, status: 1 })

module.exports = mongoose.model('CanonicalItem', canonicalItemSchema)
