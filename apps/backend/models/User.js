const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  name:           { type: String, trim: true },
  email:          { type: String, unique: true, lowercase: true, trim: true },
  googleId:       { type: String, default: null },
  phone:          { type: String, default: null },
  phoneVerified:  { type: Boolean, default: false },
  avatar:         { type: String, default: null },
  refreshToken:   { type: String, default: null },
  aiCredits:      { type: Number, default: 10 }
}, { timestamps: true })

userSchema.index({ email: 1 }, { unique: true })

module.exports = mongoose.model('User', userSchema)
