const mongoose = require('mongoose')

const projectSchema = new mongoose.Schema({

  // ─── Identity ──────────────────────────────────────────────────────────────
  // createdBy links to User._id (ObjectId)
  createdBy: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },

  name: {
    type:    String,
    required: true,
    trim:    true,
    default: 'Untitled Project'
  },
  clientName:  { type: String, default: null },
  clientPhone: { type: String, default: null },
  coverImage:  { type: String, default: null },
  startDate:   { type: Date,   default: null },
  endDate:     { type: Date,   default: null },

  // ─── Setup state machine ───────────────────────────────────────────────────
  setupStatus: {
    type:    String,
    enum:    ['draft', 'in_progress', 'completed'],
    default: 'draft'
  },
  currentSetupStep: { type: Number, default: 0 },

  // ─── Core project data (populated on setup completion) ────────────────────
  // projectType uses the canonical IDs from the estimate engine
  projectType: {
    type: String,
    enum: [
      'residential_apartment', 'villa', 'commercial_office',
      'retail_shop', 'hospitality', 'clinic_healthcare',
      'education', 'industrial_warehouse', null
    ],
    default: null
  },

  // tier derived from budget/sqft at completion
  tier: {
    type:    String,
    enum:    ['budget', 'balanced', 'premium', null],
    default: null
  },

  city:        { type: String, default: null },
  sqft:        { type: Number, default: null },
  rooms:       { type: String, default: null },   // e.g. "3BHK"
  roomSubtype: { type: String, default: null },   // e.g. "startup_office"
  budget:      { type: Number, default: null },

  // ─── Intelligence context (for estimate engine) ───────────────────────────
  intelligenceContext: {
    clusterKey:    { type: String, default: null },
    budgetPerSqft: { type: Number, default: null },
    budgetBand:    {
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    cityCluster:   { type: String, default: null }
  },

  // ─── Project status ───────────────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['active', 'won', 'lost', 'on_hold', 'archived'],
    default: 'active'
  },

  // ─── Latest estimate cache ────────────────────────────────────────────────
  latestEstimateId: { type: String, default: null },
  latestTotal:      { type: Number, default: null }

}, { timestamps: true })

projectSchema.index({ createdBy: 1, createdAt: -1 })
projectSchema.index({ createdBy: 1, status:    1  })
projectSchema.index({ setupStatus: 1 })

module.exports = mongoose.model('Project', projectSchema)
