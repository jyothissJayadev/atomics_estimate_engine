const { v4: uuidv4 } = require('uuid')

/**
 * Generates a short unique ID for estimate items and categories.
 * Format: 8-char hex prefix from UUID — collision probability negligible
 * within a single estimate (typically <200 items).
 */
function generateId() {
  return uuidv4().replace(/-/g, '').substring(0, 12)
}

/**
 * Generates a full UUID for top-level documents (estimates, projects).
 */
function generateDocId() {
  return uuidv4()
}

module.exports = { generateId, generateDocId }
