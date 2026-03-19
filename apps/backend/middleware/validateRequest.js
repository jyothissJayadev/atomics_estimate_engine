/**
 * Generic request body validator.
 * Usage: validateRequest(['projectType', 'budget', 'sqft'])
 */
function validateRequest(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(field => {
      const val = req.body[field]
      return val === undefined || val === null || val === ''
    })

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error:   `Missing required fields: ${missing.join(', ')}`
      })
    }

    next()
  }
}

module.exports = validateRequest
