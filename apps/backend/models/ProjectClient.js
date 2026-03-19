const mongoose = require('mongoose')

const projectClientSchema = new mongoose.Schema({
  projectId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    unique:   true
  },
  email: { type: String, required: true },
  token: { type: String, required: true, unique: true }
}, { timestamps: true })

module.exports = mongoose.model('ProjectClient', projectClientSchema)
