const ProjectMember = require('../models/ProjectMember')

/**
 * Checks that req.user is a member of the project and optionally
 * that their role is in the allowedRoles list.
 *
 * Usage:
 *   access({ allowRoles: ['owner', 'designer'] })
 *
 * Expects: req.user.id, req.params.projectId
 */
function access({ allowRoles } = {}) {
  return async (req, res, next) => {
    try {
      const projectId = req.params.projectId || req.params.id
      if (!projectId) return next()

      const member = await ProjectMember.findOne({
        projectId,
        userId: req.user.id
      })

      if (!member) {
        return res.status(403).json({ error: 'Access denied — not a project member' })
      }

      if (allowRoles && !allowRoles.includes(member.role)) {
        return res.status(403).json({ error: `Role "${member.role}" not allowed for this action` })
      }

      req.projectMember = member
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = { access }
