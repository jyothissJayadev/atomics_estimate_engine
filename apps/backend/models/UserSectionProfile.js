const mongoose = require('mongoose')

// Per-user usage history for a single L2 section.
// Updated on every estimate lock and on past-estimate upload.
const userSectionProfileSchema = new mongoose.Schema({
  userId: {
    type:     String,
    required: true
  },
  canonicalRef: {
    type:     String,
    required: true           // L2 canonicalId e.g. "apt_modular_kitchen"
  },
  projectType: {
    type:    String,
    default: null
  },

  // How many finalized estimates included this section
  usageCount: {
    type:    Number,
    default: 0
  },

  // How many times the designer removed an AI-suggested section
  removalCount: {
    type:    Number,
    default: 0
  },

  // Running average of budget fraction this section received
  // e.g. 0.28 means designer typically spends 28% of budget here
  avgBudgetShare: {
    type:    Number,
    default: null
  },

  // Per L3 item usage counts within this section
  // Map<canonicalRef → count>
  itemUsage: {
    type:    Map,
    of:      Number,
    default: {}
  },

  // Per L3 item removal counts — how many times AI-predicted items were removed
  // Map<canonicalRef → count>
  itemRemovalCount: {
    type:    Map,
    of:      Number,
    default: {}
  },

  lastUsed: {
    type:    Date,
    default: Date.now
  }
}, {
  timestamps: true
})

userSectionProfileSchema.index({ userId: 1, canonicalRef: 1, projectType: 1 }, { unique: true })
userSectionProfileSchema.index({ userId: 1, projectType: 1 })

module.exports = mongoose.model('UserSectionProfile', userSectionProfileSchema)
