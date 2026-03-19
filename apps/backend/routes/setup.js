const express = require('express')
const router  = express.Router()
const { runSeed, getStats }        = require('../controllers/setup/seedController')
const canonicalCtrl                = require('../controllers/setup/canonicalController')
const canonicalItemCtrl            = require('../controllers/setup/canonicalItemController')
const structureLearner             = require('../services/structureLearner')

// ─── Seed / admin ─────────────────────────────────────────────────────────────
router.post('/seed',  runSeed)
router.get('/stats',  getStats)

// ─── Learning trigger (admin) ─────────────────────────────────────────────────
router.post('/learn', async (req, res, next) => {
  try {
    const summary = await structureLearner.run()
    res.json({ success: true, ...summary })
  } catch (err) { next(err) }
})

// ─── CanonicalNode (learning DB) — resolve, search, tree ─────────────────────
router.post('/canonical/resolve',           canonicalCtrl.resolve)
router.post('/canonical/resolve-batch',     canonicalCtrl.resolveBatch)
router.get('/canonical/search',             canonicalCtrl.search)
router.get('/canonical/tree/:projectType',  canonicalCtrl.getTree)
router.get('/canonical/:canonicalId',       canonicalCtrl.getNode)

// ─── CanonicalItem (product catalogue — permanent dictionary + demo pricing) ──
// These are the endpoints used by:
//   Step 4 AddSectionPicker  →  GET /canonical-items?level=2&projectType=X
//   Step 5 AddItemPicker     →  GET /canonical-items?level=3&parentId=Y
//   Estimate editor row add  →  GET /canonical-items/search?q=...
//   Admin panel              →  POST/PATCH /canonical-items
//   Upload resolver          →  internal (canonicalResolver uses this)
router.get('/canonical-items/tree/:projectType',  canonicalItemCtrl.getTree)
router.get('/canonical-items/search',             canonicalItemCtrl.searchItems)
router.post('/canonical-items/resolve',           canonicalItemCtrl.resolveRaw)
router.get('/canonical-items',                    canonicalItemCtrl.listItems)
router.get('/canonical-items/:canonicalId',       canonicalItemCtrl.getItem)
router.post('/canonical-items',                   canonicalItemCtrl.createItem)
router.patch('/canonical-items/:canonicalId',     canonicalItemCtrl.updateItem)
router.post('/canonical-items/promote',           canonicalItemCtrl.promoteItem)

module.exports = router
