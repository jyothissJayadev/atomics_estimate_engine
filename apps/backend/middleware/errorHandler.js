/**
 * Global error handler middleware.
 * Must be the last app.use() call in server.js.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500
  const isDev      = process.env.NODE_ENV === 'development'

  // Log everything in dev, only 500s in production
  if (isDev || statusCode >= 500) {
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    console.error(err.stack || err.message)
  }

  const response = {
    success: false,
    error:   err.message || 'Internal server error'
  }

  // Include field-level validation errors if present
  if (err.validationErrors) {
    response.validationErrors = err.validationErrors
  }

  // Include stack trace in development
  if (isDev && statusCode >= 500) {
    response.stack = err.stack
  }

  res.status(statusCode).json(response)
}

module.exports = errorHandler
