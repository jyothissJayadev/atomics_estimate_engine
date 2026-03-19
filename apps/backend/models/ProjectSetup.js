const mongoose = require('mongoose')

const projectSetupSchema = new mongoose.Schema({
  projectId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    unique:   true
  },
  setupTemplateVersion: { type: Number, default: 1 },
  currentStep:          { type: Number, default: 0 },

  // Dynamic answer storage — all wizard fields stored here
  // Keys: projectName, clientName, projectType, city, totalArea,
  //       totalBudget, roomDetails, defaultFinishLevel, etc.
  answers: {
    type:    Map,
    of:      mongoose.Schema.Types.Mixed,
    default: {}
  },

  isCompleted: { type: Boolean, default: false }
}, { timestamps: true })

module.exports = mongoose.model('ProjectSetup', projectSetupSchema)
