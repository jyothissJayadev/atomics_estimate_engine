const mongoose = require('mongoose')

const structureEventSchema = new mongoose.Schema({
  projectId: {
    type: String,
    required: true
  },
  estimateId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  eventType: {
    type: String,
    required: true,
    enum: [
      'section_added',
      'section_removed',
      'section_added_manual',
      'section_accepted',
      'item_added',
      'item_removed',
      'item_added_manual',
      'item_edited',
      'item_moved',
      'rate_changed',
      'estimate_generated'
    ]
  },
  canonicalRef: {
    type: String,
    default: null
  },
  position: {
    type: Number,
    default: null
  },

  // Project state at time of event — for learning context
  context: {
    budget:      { type: Number },
    sqft:        { type: Number },
    rooms:       { type: String },
    roomSubtype: { type: String },
    tier:        { type: String },
    city:        { type: String },
    projectType: { type: String }
  },

  wasAiSuggested: {
    type: Boolean,
    default: false
  },
  userAccepted: {
    type: Boolean,
    default: null   // null = not yet determined
  },

  // For rate_changed events
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  timestamp: {
    type: Date,
    default: Date.now
  },

  // Set to true by structureLearner after processing.
  // Allows incremental nightly runs without re-processing old events.
  processed: {
    type:    Boolean,
    default: false
  }
}, {
  // No updatedAt — events are immutable
  timestamps: { createdAt: 'timestamp', updatedAt: false }
})

// IMPORTANT: Application must enforce append-only.
// No update or delete operations are allowed on this collection.
structureEventSchema.index({ projectId: 1, timestamp: -1 })
structureEventSchema.index({ userId: 1, eventType: 1 })
structureEventSchema.index({ canonicalRef: 1, wasAiSuggested: 1, userAccepted: 1 })

module.exports = mongoose.model('StructureEvent', structureEventSchema)
