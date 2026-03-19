const express = require('express')
const router  = express.Router()

const {
  createProject,
  getProjectSetup,
  updateProjectSetup,
  completeProjectSetup,
  getMyProjects,
  getProjectById,
  updateProject,
  deleteProject,
  updateProjectCover,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  addClient,
  removeClient,
  getProjectEstimates
} = require('../controllers/finance/projectController')

const { protect } = require('../middleware/auth.middleware')
const { access }  = require('../middleware/access.middleware')
const { upload }  = require('../middleware/upload.middleware')

// ─── CRUD ─────────────────────────────────────────────────────────────────────

// Create a new draft project (cover image optional)
router.post(
  '/',
  protect,
  upload.single('coverImage'),
  createProject
)

// List all projects the user is a member of
router.get('/', protect, getMyProjects)

// Get single project (returns isDraft flag if setup not complete)
router.get('/:projectId', protect, access(), getProjectById)

// Update project metadata
router.patch(
  '/:projectId',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  updateProject
)

// Delete project + all related data
router.delete(
  '/:projectId',
  protect,
  access({ allowRoles: ['owner'] }),
  deleteProject
)

// Update cover image
router.patch(
  '/:projectId/cover',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  upload.single('coverImage'),
  updateProjectCover
)

// ─── SETUP WIZARD ────────────────────────────────────────────────────────────

// Get current setup state (answers + step)
router.get(
  '/:projectId/setup',
  protect,
  access(),
  getProjectSetup
)

// Auto-save wizard answers (called on each step)
router.patch(
  '/:projectId/setup',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  updateProjectSetup
)

// Complete setup — validates answers + runs estimate engine
router.post(
  '/:projectId/setup/complete',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  completeProjectSetup
)

// ─── MEMBERS ─────────────────────────────────────────────────────────────────

router.get(
  '/:projectId/members',
  protect,
  access(),
  getProjectMembers
)

router.post(
  '/:projectId/members',
  protect,
  access({ allowRoles: ['owner'] }),
  addProjectMember
)

router.delete(
  '/:projectId/members/:userId',
  protect,
  access({ allowRoles: ['owner'] }),
  removeProjectMember
)

// ─── CLIENT ACCESS ────────────────────────────────────────────────────────────

router.post(
  '/:projectId/client',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  addClient
)

router.delete(
  '/:projectId/client',
  protect,
  access({ allowRoles: ['owner'] }),
  removeClient
)

// ─── ESTIMATES ────────────────────────────────────────────────────────────────

// List all estimate versions for a project
router.get(
  '/:projectId/estimates',
  protect,
  access(),
  getProjectEstimates
)

// ─── ENGINE RECALCULATE — re-price when item added/removed in Step 5 ─────────
// Body: { confirmedSections, confirmedItems, tierOverride? }
router.post(
  '/:projectId/setup/recalculate-items',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  recalculateItems
)

module.exports = router

// ─── ENGINE LEVEL 1 — predict L2 sections from project context ───────────────
// Called after Step 3 (budget confirmed). Returns AI-predicted sections.
// Body: { projectType, budget, sqft, rooms, roomSubtype, tier, city }
const { predictSectionsForSetup, predictItemsForSetup, recalculateItems } = require('../controllers/finance/setupEngineController')

router.post(
  '/:projectId/setup/level1',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  predictSectionsForSetup
)

// ─── ENGINE LEVEL 2 — predict L3 items for confirmed sections ────────────────
// Body: { confirmedSections: ['apt_modular_kitchen', ...] }
router.post(
  '/:projectId/setup/level2',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  predictItemsForSetup
)
