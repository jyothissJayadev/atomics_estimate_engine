const mongoose = require('mongoose')

// Lightweight reference to each estimate inside a project's finance doc
const estimateRefSchema = new mongoose.Schema({
  estimateId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Estimate',
    required: true
  },
  estimateName:     { type: String },
  includedInBudget: { type: Boolean, default: true },
  subtotal:         { type: Number,  default: 0 },
  isLocked:         { type: Boolean, default: false },
  position:         { type: Number,  default: 0 },
  lastUpdatedAt:    { type: Date }
}, { _id: false })

const projectFinanceSchema = new mongoose.Schema({
  projectId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    unique:   true
  },

  estimates: { type: [estimateRefSchema], default: [] },

  gstEnabled:    { type: Boolean, default: true },
  gstPercentage: { type: Number,  default: 18 },

  totals: {
    subtotal:   { type: Number, default: 0 },
    gstAmount:  { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 }
  },

  header: {
    companyName:   { type: String, default: null },
    logoUrl:       { type: String, default: null },
    phone:         { type: String, default: null },
    email:         { type: String, default: null },
    location:      { type: String, default: null },
    quotationDate: { type: Date,   default: null }
  },

  footer: {
    notes: { type: [String], default: [] }
  },

  status: {
    type:    String,
    enum:    ['Draft', 'Finalized'],
    default: 'Draft'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User'
  }
}, { timestamps: true })

projectFinanceSchema.index({ projectId: 1 }, { unique: true })

module.exports = mongoose.model('ProjectFinance', projectFinanceSchema)
