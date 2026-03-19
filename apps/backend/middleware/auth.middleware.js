const jwt  = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Verifies JWT access token and attaches req.user = { id, _id }
 */
function protect(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const token   = auth.split(' ')[1]
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    // Attach both id (string) and _id for compatibility
    req.user = { id: decoded.id, _id: decoded.id }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

module.exports = { protect }
