const mongoose = require('mongoose')

const canonicalNodeSchema = new mongoose.Schema({
  canonicalId: {
    type:     String,
    required: true,
    unique:   true,   // field-level unique — Mongoose 8 prefers this over schema.index()
    trim:     true
  },
  level: {
    type:     Number,
    required: true,
    enum:     [1, 2, 3, 4]
  },
  label: {
    type:     String,
    required: true,
    trim:     true
  },
  parentId: {
    type:    String,
    default: null
  },
  defaultUnit: {
    type:    String,
    enum:    ['sqft', 'rft', 'nos', 'lumpsum', null],
    default: null
  },
  isFlexible: {
    type:     Boolean,
    required: true
  },
  projectTypes: [{ type: String }],
  aliases:      [{ type: String, trim: true }],
  status: {
    type:    String,
    enum:    ['active', 'deprecated', 'pending_review'],
    default: 'active'
  },
  source: {
    type:    String,
    enum:    ['seed_manual', 'seed_llm', 'auto_promoted', 'admin_manual'],
    default: 'seed_manual'
  },
  occurrenceCount:  { type: Number, default: 0   },
  predictionWeight: { type: Number, default: null },
  notes:            { type: String, default: ''   },

  // L3 items only — which pricing tiers this item is appropriate for.
  // Empty array means appropriate for all tiers.
  // e.g. ['premium'] means only show for premium projects
  appropriateTiers: [{
    type: String,
    enum: ['budget', 'balanced', 'premium']
  }],

  // L2 sections only — minimum realistic cost in ₹ for sectionPruner.
  // If allocatedBudget < minCostEstimate, section is pruned.
  minCostEstimate: {
    type:    Number,
    default: null
  }
}, {
  timestamps: true
})

// Compound indexes (not unique — only use schema.index() for these)
canonicalNodeSchema.index({ level: 1, parentId: 1, status: 1 })
canonicalNodeSchema.index({ aliases: 1 })
canonicalNodeSchema.index({ projectTypes: 1, level: 1, isFlexible: 1, status: 1 })

module.exports = mongoose.model('CanonicalNode', canonicalNodeSchema)
