const CanonicalItem = require('../../models/CanonicalItem')
const CanonicalNode = require('../../models/CanonicalNode')

/**
 * GET /api/canonical-items/tree/:projectType
 * Returns full L1→L2→L3 tree for a project type.
 * This is what Step 5 AddItemPicker calls instead of canonicalCatalog.json.
 * Includes baseline rates and quantity rules so frontend can show estimated cost.
 */
async function getTree(req, res, next) {
  try {
    const { projectType } = req.params
    const { tier = 'balanced', city } = req.query

    const items = await CanonicalItem.find({
      projectTypes: projectType,
      status: 'active',
      level: { $in: [2, 3] }
    })
      .select('canonicalId label level parentId defaultUnit isFlexible projectTypes aliases baselineRates regionMultipliers quantityRule defaultBudgetRatio minCostEstimate displayOrder isAnchor appropriateTiers')
      .sort({ level: 1, displayOrder: 1 })
      .lean()

    const cityKey = (city || '').toLowerCase().trim()
    const getMultiplier = (item) => {
      if (!cityKey) return 1.0
      const rm = item.regionMultipliers
      if (!rm) return 1.0
      return (rm instanceof Map ? rm.get(cityKey) : rm[cityKey]) || 1.0
    }

    const getRate = (item) => {
      const rates = item.baselineRates?.[tier] || item.baselineRates?.balanced || {}
      const mult  = getMultiplier(item)
      return {
        materialRate: Math.round((rates.materialRate || 0) * mult),
        laborRate:    Math.round((rates.laborRate    || 0) * mult),
      }
    }

    const l2 = items.filter(n => n.level === 2)
    const l3 = items.filter(n => n.level === 3)

    const tree = l2.map(section => ({
      canonicalId:        section.canonicalId,
      label:              section.label,
      isFlexible:         section.isFlexible,
      isAnchor:           section.isAnchor,
      displayOrder:       section.displayOrder,
      defaultBudgetRatio: section.defaultBudgetRatio,
      minCostEstimate:    section.minCostEstimate,
      items: l3
        .filter(i => i.parentId === section.canonicalId)
        .map(i => {
          const rate = getRate(i)
          return {
            canonicalId:      i.canonicalId,
            label:            i.label,
            unit:             i.defaultUnit || 'nos',
            isFlexible:       i.isFlexible,
            appropriateTiers: i.appropriateTiers || [],
            quantityRule:     i.quantityRule || null,
            aliases:          i.aliases || [],
            // Indicative rates so picker can show approximate cost
            indicativeRate:   rate.materialRate + rate.laborRate,
            materialRate:     rate.materialRate,
            laborRate:        rate.laborRate,
          }
        })
    }))

    res.json({
      success:     true,
      projectType,
      tier,
      city:        cityKey || null,
      sectionCount: l2.length,
      itemCount:    l3.length,
      tree
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/canonical-items?projectType=X&level=3&parentId=Y&tier=balanced&city=mumbai
 * Returns flat list of items matching filters.
 * Used by Step 5 section picker when fetching a single section's items.
 */
async function listItems(req, res, next) {
  try {
    const { projectType, level, parentId, tier = 'balanced', city, status = 'active' } = req.query

    const query = { status }
    if (projectType) query.projectTypes = projectType
    if (level)       query.level        = parseInt(level)
    if (parentId)    query.parentId     = parentId

    const items = await CanonicalItem.find(query)
      .sort({ displayOrder: 1, label: 1 })
      .lean()

    const cityKey = (city || '').toLowerCase().trim()

    const shaped = items.map(item => {
      const rates = item.baselineRates?.[tier] || item.baselineRates?.balanced || {}
      const rm    = item.regionMultipliers
      const mult  = cityKey ? ((rm instanceof Map ? rm.get(cityKey) : rm?.[cityKey]) || 1.0) : 1.0
      return {
        canonicalId:      item.canonicalId,
        label:            item.label,
        level:            item.level,
        parentId:         item.parentId,
        unit:             item.defaultUnit || 'nos',
        isFlexible:       item.isFlexible,
        aliases:          item.aliases || [],
        appropriateTiers: item.appropriateTiers || [],
        quantityRule:     item.quantityRule || null,
        materialRate:     Math.round((rates.materialRate || 0) * mult),
        laborRate:        Math.round((rates.laborRate    || 0) * mult),
        indicativeRate:   Math.round(((rates.materialRate || 0) + (rates.laborRate || 0)) * mult),
        defaultBudgetRatio: item.defaultBudgetRatio || null,
        minCostEstimate:    item.minCostEstimate || null,
      }
    })

    res.json({ success: true, count: shaped.length, items: shaped })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/canonical-items/search?q=kitchen&projectType=X&level=3&tier=balanced&city=X
 */
async function searchItems(req, res, next) {
  try {
    const { q, projectType, level, parentId, tier = 'balanced', city, limit = 20 } = req.query

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

    const items = await CanonicalItem.find(query)
      .limit(Math.min(parseInt(limit), 50))
      .lean()

    const cityKey = (city || '').toLowerCase().trim()
    const shaped = items.map(item => {
      const rates = item.baselineRates?.[tier] || {}
      const rm    = item.regionMultipliers
      const mult  = cityKey ? ((rm instanceof Map ? rm.get(cityKey) : rm?.[cityKey]) || 1.0) : 1.0
      return {
        canonicalId:    item.canonicalId,
        label:          item.label,
        level:          item.level,
        parentId:       item.parentId,
        unit:           item.defaultUnit || 'nos',
        aliases:        item.aliases || [],
        materialRate:   Math.round((rates.materialRate || 0) * mult),
        laborRate:      Math.round((rates.laborRate    || 0) * mult),
        indicativeRate: Math.round(((rates.materialRate || 0) + (rates.laborRate || 0)) * mult),
      }
    })

    res.json({ success: true, count: shaped.length, items: shaped })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/canonical-items/:canonicalId
 */
async function getItem(req, res, next) {
  try {
    const item = await CanonicalItem.findOne({ canonicalId: req.params.canonicalId }).lean()
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' })
    res.json({ success: true, item })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/canonical-items  (admin)
 * Creates a new canonical item (e.g. a new product entering the market).
 * Also creates a corresponding CanonicalNode for the learning system.
 */
async function createItem(req, res, next) {
  try {
    const {
      canonicalId, label, level, parentId, defaultUnit,
      isFlexible, projectTypes, aliases, baselineRates,
      quantityRule, defaultBudgetRatio, minCostEstimate, notes
    } = req.body

    if (!canonicalId || !label || !level) {
      return res.status(400).json({ error: 'canonicalId, label and level are required' })
    }

    const item = await CanonicalItem.create({
      canonicalId, label, level, parentId, defaultUnit,
      isFlexible: isFlexible ?? true,
      projectTypes: projectTypes || [],
      aliases: aliases || [],
      baselineRates: baselineRates || {},
      quantityRule: quantityRule || null,
      defaultBudgetRatio: defaultBudgetRatio || null,
      minCostEstimate: minCostEstimate || null,
      notes: notes || '',
      source: 'admin',
      status: 'active',
    })

    // Mirror into CanonicalNode for prediction engine
    await CanonicalNode.findOneAndUpdate(
      { canonicalId },
      {
        $setOnInsert: {
          canonicalId, label, level, parentId: parentId || null,
          defaultUnit: defaultUnit || null, isFlexible: isFlexible ?? true,
          projectTypes: projectTypes || [],
          aliases: aliases || [],
          status: 'active', source: 'admin_manual',
          predictionWeight: 1.0, occurrenceCount: 0,
        }
      },
      { upsert: true }
    )

    res.status(201).json({ success: true, item })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: `canonicalId '${req.body.canonicalId}' already exists` })
    next(err)
  }
}

/**
 * PATCH /api/canonical-items/:canonicalId  (admin)
 * Updates rates, quantity rules, aliases etc. without requiring a code deploy.
 */
async function updateItem(req, res, next) {
  try {
    const allowed = ['label', 'aliases', 'baselineRates', 'regionMultipliers',
      'quantityRule', 'defaultBudgetRatio', 'minCostEstimate',
      'appropriateTiers', 'displayOrder', 'isAnchor', 'notes', 'status']

    const updates = {}
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k]
    }

    const item = await CanonicalItem.findOneAndUpdate(
      { canonicalId: req.params.canonicalId },
      { $set: updates },
      { new: true }
    )
    if (!item) return res.status(404).json({ error: 'Item not found' })
    res.json({ success: true, item })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/canonical-items/promote  (internal / upload controller)
 * Promotes a raw item string to a new pending_review CanonicalItem.
 * Called by uploadController when it encounters an unresolved item
 * that appears frequently enough to warrant a new canonical entry.
 */
async function promoteItem(req, res, next) {
  try {
    const { rawName, parentId, projectType, unit, detectedRates } = req.body

    if (!rawName || !parentId) {
      return res.status(400).json({ error: 'rawName and parentId are required' })
    }

    // Generate a safe canonicalId from the raw name
    const base = rawName.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 40)
    const canonicalId = `custom_${base}_${Date.now()}`

    const item = await CanonicalItem.create({
      canonicalId,
      label:        rawName,
      level:        3,
      parentId:     parentId || null,
      defaultUnit:  unit || null,
      isFlexible:   true,
      projectTypes: projectType ? [projectType] : [],
      aliases:      [rawName.toLowerCase()],
      source:       'auto_promoted',
      status:       'pending_review',
      baselineRates: detectedRates ? {
        budget:   detectedRates,
        balanced: detectedRates,
        premium:  detectedRates,
      } : {},
    })

    res.status(201).json({ success: true, item, message: 'Item created with status=pending_review — admin must approve before it appears in pickers' })
  } catch (err) {
    next(err)
  }
}


/**
 * POST /api/canonical-items/resolve
 * Resolves a raw string to a CanonicalItem using alias matching.
 * Used by the estimate editor when a designer types a new item name.
 * Body: { rawName, parentId?, level?, projectType? }
 */
async function resolveRaw(req, res, next) {
  try {
    const { rawName, parentId, level, projectType } = req.body
    if (!rawName || rawName.length < 2) {
      return res.status(400).json({ success: false, error: 'rawName is required (min 2 chars)' })
    }

    const searchStr = rawName.toLowerCase().trim()
    const query = { status: 'active' }
    if (parentId)    query.parentId     = parentId
    if (level)       query.level        = parseInt(level)
    if (projectType) query.projectTypes = projectType

    // Step 1: exact alias
    const exact = await CanonicalItem.findOne({
      ...query,
      aliases: { $elemMatch: { $regex: new RegExp(`^${escapeRegex(searchStr)}$`, 'i') } }
    }).lean()
    if (exact) return res.json({ success: true, status: 'resolved', score: 1.0, item: shapeItem(exact) })

    // Step 2: label partial
    const partial = await CanonicalItem.findOne({
      ...query,
      label: { $regex: new RegExp(escapeRegex(searchStr), 'i') }
    }).lean()
    if (partial) return res.json({ success: true, status: 'resolved', score: 0.82, item: shapeItem(partial) })

    // Step 3: token overlap
    const tokens = searchStr.split(/[\s,\/\-_]+/).filter(t => t.length > 2)
    if (tokens.length > 0) {
      const candidates = await CanonicalItem.find({
        ...query,
        $or: [
          { label:   { $regex: new RegExp(tokens.map(escapeRegex).join('|'), 'i') } },
          { aliases: { $elemMatch: { $regex: new RegExp(tokens.map(escapeRegex).join('|'), 'i') } } }
        ]
      }).lean()

      if (candidates.length > 0) {
        const scored = candidates.map(c => ({
          item: c,
          score: tokenOverlap(tokens, c.label, c.aliases)
        })).sort((a,b) => b.score - a.score)

        const best = scored[0]
        if (best.score >= 0.40) {
          return res.json({
            success: true,
            status:  best.score >= 0.75 ? 'resolved' : 'pending_review',
            score:   parseFloat(best.score.toFixed(3)),
            item:    shapeItem(best.item)
          })
        }
      }
    }

    res.json({ success: true, status: 'unresolved', score: null, item: null })
  } catch (err) { next(err) }
}

function shapeItem(item) {
  return {
    canonicalId: item.canonicalId,
    label:       item.label,
    level:       item.level,
    parentId:    item.parentId,
    unit:        item.defaultUnit || 'nos',
    aliases:     item.aliases || [],
  }
}

function tokenOverlap(inputTokens, label, aliases) {
  const allText    = [label, ...(aliases || [])].join(' ').toLowerCase()
  const targetToks = allText.split(/[\s,\/\-_]+/).filter(t => t.length > 2)
  const inter      = inputTokens.filter(t => targetToks.some(tt => tt.includes(t) || t.includes(tt)))
  const maxLen     = Math.max(inputTokens.length, targetToks.length)
  return maxLen === 0 ? 0 : inter.length / maxLen
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = { getTree, listItems, searchItems, getItem, createItem, updateItem, promoteItem, resolveRaw }
