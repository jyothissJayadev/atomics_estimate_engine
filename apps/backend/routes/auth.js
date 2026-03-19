const express = require('express')
const router  = express.Router()

const {
  getMe,
  googleLogin,
  sendOtp,
  verifyOtpAndRegister,
  refreshAccessToken
} = require('../controllers/auth/auth.controller')

const { protect } = require('../middleware/auth.middleware')

// Current user (requires valid access token)
router.get('/me', protect, getMe)

// Google OAuth flow
router.post('/google-login',  googleLogin)

// Phone OTP registration
router.post('/send-otp',      sendOtp)
router.post('/verify-otp',    verifyOtpAndRegister)

// Token refresh
router.post('/refresh-token', refreshAccessToken)

module.exports = router
