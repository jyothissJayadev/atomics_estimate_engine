const express = require('express')
const router  = express.Router()

const {
  createEstimate,
  getEstimateById,
  saveEstimateVersion,
  getSingleEstimateVersion,
  getEstimateVersions,
  lockEstimate,
  unlockEstimate,
  uploadEstimateItemImage,
  updateEstimateMeta,
  listProjectEstimates,
  deleteEstimate,
  getLevel2Items,
  generateLevel3Estimate
} = require('../controllers/finance/estimateController')

const { protect } = require('../middleware/auth.middleware')
const { access }  = require('../middleware/access.middleware')
const { upload }  = require('../middleware/upload.middleware')

// ─── Create estimate for a project ────────────────────────────────────────────
router.post(
  '/projects/:projectId',
  protect,
  access({ allowRoles: ['owner', 'designer'] }),
  createEstimate
)

// ─── List estimates for a project ─────────────────────────────────────────────
router.get(
  '/projects/:projectId',
  protect,
  access(),
  listProjectEstimates
)

// ─── Single estimate ──────────────────────────────────────────────────────────
router.get(
  '/:estimateId',
  protect,
  getEstimateById
)

router.patch(
  '/:estimateId',
  protect,
  updateEstimateMeta
)

router.delete(
  '/:estimateId',
  protect,
  deleteEstimate
)

// ─── Versions ─────────────────────────────────────────────────────────────────
router.post(
  '/:estimateId/version',
  protect,
  saveEstimateVersion
)

router.get(
  '/:estimateId/versions',
  protect,
  getEstimateVersions
)

router.get(
  '/:estimateId/versions/:versionId',
  protect,
  getSingleEstimateVersion
)

// ─── Lock / Unlock ────────────────────────────────────────────────────────────
router.post('/:estimateId/lock',   protect, lockEstimate)
router.post('/:estimateId/unlock', protect, unlockEstimate)

// ─── Level 2 — Item prediction for confirmed sections ─────────────────────────
// Body: { confirmedSections: ['apt_modular_kitchen', 'apt_false_ceiling', ...] }
router.post('/:estimateId/level2-items', protect, getLevel2Items)

// ─── Level 3 — Full BOQ generation from confirmed items ───────────────────────
// Body: { confirmedItems: { 'apt_modular_kitchen': ['kit_carcass_ply', ...], ... } }
router.post('/:estimateId/level3-generate', protect, generateLevel3Estimate)

// ─── Item image ───────────────────────────────────────────────────────────────
router.post(
  '/:estimateId/items/:itemId/image',
  protect,
  upload.single('image'),
  uploadEstimateItemImage
)

module.exports = router
