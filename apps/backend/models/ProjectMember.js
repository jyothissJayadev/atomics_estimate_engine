const mongoose = require('mongoose')

const projectMemberSchema = new mongoose.Schema({
  projectId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true
  },
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  role: {
    type:     String,
    enum:     ['owner', 'designer', 'viewer'],
    required: true
  }
}, { timestamps: true })

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true })
projectMemberSchema.index({ userId: 1 })

module.exports = mongoose.model('ProjectMember', projectMemberSchema)
