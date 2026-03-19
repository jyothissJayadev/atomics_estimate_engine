const CanonicalNode       = require('../../models/CanonicalNode')
const { resolveCanonical } = require('../../utils/canonicalResolver')

// ─── Resolve a raw string ─────────────────────────────────────────────────────

/**
 * POST /api/canonical/resolve
 * Tests how a raw string maps to a canonical node.
 * Useful during onboarding and alias gap analysis.
 *
 * Body: { rawName: "BWP Ply 19mm carcass", parentCanonicalId: "apt_modular_kitchen" }
 */
async function resolve(req, res, next) {
  try {
    const { rawName, parentCanonicalId } = req.body

    if (!rawName) {
      return res.status(400).json({ success: false, error: 'rawName is required' })
    }

    const result = await resolveCanonical(rawName, parentCanonicalId || null)

    res.json({ success: true, input: rawName, ...result })
  } catch (err) {
    next(err)
  }
}

// ─── Batch resolve ────────────────────────────────────────────────────────────

/**
 * POST /api/canonical/resolve-batch
 * Resolves an array of raw strings at once.
 *
 * Body: { items: [{ rawName, parentCanonicalId }] }
 */
async function resolveBatch(req, res, next) {
  try {
    const { items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' })
    }

    if (items.length > 100) {
      return res.status(400).json({ success: false, error: 'Max 100 items per batch' })
    }

    const results = await Promise.all(
      items.map(async item => {
        const r = await resolveCanonical(item.rawName, item.parentCanonicalId || null)
        return { input: item.rawName, ...r }
      })
    )

    const resolved   = results.filter(r => r.status === 'resolved').length
    const pending    = results.filter(r => r.status === 'pending_review').length
    const unresolved = results.filter(r => r.status === 'unresolved').length

    res.json({
      success: true,
      summary: { total: results.length, resolved, pending, unresolved },
      results
    })
  } catch (err) {
    next(err)
  }
}

// ─── Search canonical nodes ───────────────────────────────────────────────────

/**
 * GET /api/canonical/search?q=kitchen&projectType=residential_apartment&level=3
 * Search canonical nodes by label/alias for use in autocomplete.
 */
async function search(req, res, next) {
  try {
    const { q, projectType, level, parentId, limit = 20 } = req.query

    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: 'q must be at least 2 characters' })
    }

    const query = {
      status: 'active',
      $or: [
        { label:   { $regex: new RegExp(q, 'i') } },
        { aliases: { $elemMatch: { $regex: new RegExp(q, 'i') } } }
      ]
    }

    if (projectType) query.projectTypes = projectType
    if (level)       query.level        = parseInt(level)
    if (parentId)    query.parentId     = parentId

    const nodes = await CanonicalNode.find(query)
      .select('canonicalId label level parentId defaultUnit isFlexible projectTypes')
      .limit(Math.min(parseInt(limit), 50))
      .lean()

    res.json({ success: true, count: nodes.length, nodes })
  } catch (err) {
    next(err)
  }
}

// ─── Get tree for project type ────────────────────────────────────────────────

/**
 * GET /api/canonical/tree/:projectType
 * Returns full L2→L3 tree for a project type.
 * Used by frontend to build section/item picker UI.
 */
async function getTree(req, res, next) {
  try {
    const { projectType } = req.params

    const allNodes = await CanonicalNode.find({
      projectTypes: projectType,
      status:       'active',
      level:        { $in: [2, 3] }
    })
      .select('canonicalId label level parentId defaultUnit isFlexible predictionWeight')
      .sort({ level: 1, isFlexible: 1 })
      .lean()

    // Build L2 → [L3] tree
    const l2Nodes = allNodes.filter(n => n.level === 2)
    const l3Nodes = allNodes.filter(n => n.level === 3)

    const tree = l2Nodes.map(section => ({
      ...section,
      items: l3Nodes.filter(i => i.parentId === section.canonicalId)
    }))

    res.json({
      success:     true,
      projectType,
      sectionCount: l2Nodes.length,
      itemCount:    l3Nodes.length,
      tree
    })
  } catch (err) {
    next(err)
  }
}

// ─── Get single node ──────────────────────────────────────────────────────────

/**
 * GET /api/canonical/:canonicalId
 */
async function getNode(req, res, next) {
  try {
    const node = await CanonicalNode.findOne({
      canonicalId: req.params.canonicalId
    }).lean()

    if (!node) {
      return res.status(404).json({ success: false, error: 'Canonical node not found' })
    }

    res.json({ success: true, node })
  } catch (err) {
    next(err)
  }
}

module.exports = { resolve, resolveBatch, search, getTree, getNode }
