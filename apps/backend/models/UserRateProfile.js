const mongoose = require('mongoose')

const userRateProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  canonicalRef: {
    type: String,
    required: true
  },
  projectType: {
    type: String,
    default: null
  },
  tier: {
    type: String,
    enum: ['budget', 'balanced', 'premium', null],
    default: null
  },
  city: {
    type: String,
    default: null
  },

  // Stored as Decimal128 for precision, converted on read
  materialRate: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },
  laborRate: {
    type: mongoose.Schema.Types.Decimal128,
    default: null
  },

  unit: {
    type: String,
    enum: ['sqft', 'rft', 'nos', 'lumpsum', null],
    default: null
  },

  // How many past estimates contributed to this rate
  sampleCount: {
    type: Number,
    default: 1
  },

  lastUsed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

userRateProfileSchema.index({ userId: 1, canonicalRef: 1, tier: 1 })
userRateProfileSchema.index({ userId: 1, projectType: 1 })

// Helper to convert Decimal128 to plain number on output
userRateProfileSchema.set('toJSON', {
  transform(doc, ret) {
    if (ret.materialRate) ret.materialRate = parseFloat(ret.materialRate.toString())
    if (ret.laborRate)    ret.laborRate    = parseFloat(ret.laborRate.toString())
    return ret
  }
})

module.exports = mongoose.model('UserRateProfile', userRateProfileSchema)
