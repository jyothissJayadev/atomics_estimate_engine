const mongoose = require('mongoose')

const frequencyEntrySchema = new mongoose.Schema({
  count:     { type: Number, default: 0 },
  frequency: { type: Number, default: 0 }
}, { _id: false })

const ratioStatsSchema = new mongoose.Schema({
  mean:    { type: Number },
  min:     { type: Number },
  max:     { type: Number },
  samples: { type: Number, default: 0 }
}, { _id: false })

const globalSectionStatsSchema = new mongoose.Schema({
  projectType: {
    type:     String,
    required: true,
    unique:   true   // field-level unique — no separate schema.index() needed
  },
  sampleCount: {
    type:    Number,
    default: 0
  },
  source: {
    type:    String,
    default: 'scribd_seed'
  },
  lastUpdated: {
    type:    Date,
    default: Date.now
  },
  sectionFrequency: {
    type:    Map,
    of:      frequencyEntrySchema,
    default: {}
  },
  sectionBudgetRatio: {
    type:    Map,
    of:      ratioStatsSchema,
    default: {}
  },
  itemFrequencyBySection: {
    type:    Map,
    of:      { type: Map, of: frequencyEntrySchema },
    default: {}
  },
  ratioNotes: {
    type:    String,
    default: ''
  }
}, {
  timestamps: true
})

module.exports = mongoose.model('GlobalSectionStats', globalSectionStatsSchema)
