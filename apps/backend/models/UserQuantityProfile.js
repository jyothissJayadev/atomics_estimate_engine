const mongoose = require('mongoose')

/**
 * UserQuantityProfile
 *
 * Stores per-user, per-item quantity observations as a normalised ratio
 * (actual_quantity / project_sqft). Using a ratio — not raw quantity — means
 * observations from a 900sqft project and a 1400sqft project can be averaged
 * meaningfully and then scaled to any new project's sqft.
 *
 * Updated on every estimate lock via _learnQuantities() in estimateController.
 * Read by quantityEstimator.js to personalise quantity predictions.
 *
 * For fixed/lumpsum items (sinks, chimneys) isFixed=true and quantityRatio
 * is not used — the fixed count is stored in fixedQuantity instead.
 *
 * Confidence levels:
 *   sampleCount >= 3  → use user ratio directly (high confidence)
 *   sampleCount 1-2   → blend 60% user + 40% global rule (medium confidence)
 *   sampleCount = 0   → fall back to global rule (no data)
 */
const userQuantityProfileSchema = new mongoose.Schema({
  userId: {
    type:     String,
    required: true
  },
  canonicalRef: {
    type:     String,
    required: true           // L3 canonicalId e.g. "kit_carcass_ply"
  },
  projectType: {
    type:    String,
    default: null
  },
  tier: {
    type:    String,
    enum:    ['budget', 'balanced', 'premium', null],
    default: null
  },

  // The normalised ratio: actual quantity / sqft
  // e.g. if a 1200sqft project had 28sqft carcass → ratio = 0.02333
  // EMA-updated with α = 0.2 on each new observation
  quantityRatio: {
    type:    Number,
    default: null
  },

  // For fixed/lumpsum items — quantity is always a whole number, not sqft-derived
  isFixed: {
    type:    Boolean,
    default: false
  },
  fixedQuantity: {
    type:    Number,
    default: null
  },

  // How many locked estimates contributed to this ratio
  sampleCount: {
    type:    Number,
    default: 1
  },

  lastUsed: {
    type:    Date,
    default: Date.now
  }
}, {
  timestamps: true
})

userQuantityProfileSchema.index({ userId: 1, canonicalRef: 1, tier: 1 }, { unique: true })
userQuantityProfileSchema.index({ userId: 1, projectType: 1 })

module.exports = mongoose.model('UserQuantityProfile', userQuantityProfileSchema)
