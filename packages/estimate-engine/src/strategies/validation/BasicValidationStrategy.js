const { VALID_PROJECT_TYPES } = require('../../../../../apps/backend/config/constants')

class BasicValidationStrategy {
  validate(input) {
    const errors = []

    if (!input.projectType) {
      errors.push('projectType is required')
    } else if (!VALID_PROJECT_TYPES.includes(input.projectType)) {
      errors.push(`projectType must be one of: ${VALID_PROJECT_TYPES.join(', ')}`)
    }

    if (!input.budget || isNaN(input.budget) || input.budget <= 0) {
      errors.push('budget must be a positive number')
    }

    if (!input.sqft || isNaN(input.sqft) || input.sqft <= 0) {
      errors.push('sqft must be a positive number')
    }

    if (!input.rooms || typeof input.rooms !== 'string') {
      errors.push('rooms is required (e.g. "3BHK", "startup_office")')
    }

    if (!input.tier) {
      errors.push('tier is required: budget | balanced | premium')
    } else if (!['budget', 'balanced', 'premium'].includes(input.tier)) {
      errors.push('tier must be budget, balanced, or premium')
    }

    if (!input.userId || typeof input.userId !== 'string') {
      errors.push('userId is required')
    }

    if (errors.length > 0) {
      const err = new Error(errors.join('; '))
      err.statusCode = 400
      err.validationErrors = errors
      throw err
    }

    return true
  }
}

module.exports = BasicValidationStrategy
