const UserRateProfile = require('../../models/UserRateProfile')
const CanonicalNode   = require('../../models/CanonicalNode')

// ─── List user rates ──────────────────────────────────────────────────────────

/**
 * GET /api/rates?userId=xxx&tier=balanced&projectType=residential_apartment
 * Returns all learned rates for a user, joined with canonical labels.
 */
async function listRates(req, res, next) {
  try {
    const userId = req.user.id
    const { tier, projectType } = req.query

    const filter = { userId }
    if (tier)        filter.tier        = tier
    if (projectType) filter.projectType = projectType

    const profiles = await UserRateProfile.find(filter)
      .sort({ sampleCount: -1, lastUsed: -1 })
      .lean()

    if (profiles.length === 0) {
      return res.json({ success: true, count: 0, rates: [] })
    }

    // Join with canonical labels
    const canonicalIds = [...new Set(profiles.map(p => p.canonicalRef))]
    const nodes = await CanonicalNode.find({ canonicalId: { $in: canonicalIds } })
      .select('canonicalId label level parentId defaultUnit')
      .lean()

    const nodeMap = {}
    for (const n of nodes) nodeMap[n.canonicalId] = n

    const rates = profiles.map(p => ({
      canonicalRef:  p.canonicalRef,
      label:         nodeMap[p.canonicalRef]?.label || p.canonicalRef,
      level:         nodeMap[p.canonicalRef]?.level,
      unit:          p.unit || nodeMap[p.canonicalRef]?.defaultUnit,
      materialRate:  p.materialRate ? parseFloat(p.materialRate.toString()) : null,
      laborRate:     p.laborRate    ? parseFloat(p.laborRate.toString())    : null,
      tier:          p.tier,
      city:          p.city,
      sampleCount:   p.sampleCount,
      lastUsed:      p.lastUsed
    }))

    res.json({ success: true, count: rates.length, rates })
  } catch (err) {
    next(err)
  }
}

// ─── Update a single rate ─────────────────────────────────────────────────────

/**
 * PUT /api/rates
 * Manually set/override a rate for a user.
 * Body: { userId, canonicalRef, materialRate, laborRate, tier, unit }
 */
async function upsertRate(req, res, next) {
  try {
    const { canonicalRef, materialRate, laborRate, tier, unit, city } = req.body
    const userId = req.user.id

    if (!canonicalRef) {
      return res.status(400).json({ success: false, error: 'canonicalRef required' })
    }

    const profile = await UserRateProfile.findOneAndUpdate(
      { userId, canonicalRef, tier: tier || null },
      {
        $set: {
          materialRate: materialRate != null ? materialRate : undefined,
          laborRate:    laborRate    != null ? laborRate    : undefined,
          unit:         unit         || null,
          city:         city         || null,
          lastUsed:     new Date()
        },
        $inc: { sampleCount: 0 }  // ensures document is created if not exists
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({
      success: true,
      rate: {
        canonicalRef:  profile.canonicalRef,
        materialRate:  profile.materialRate ? parseFloat(profile.materialRate.toString()) : null,
        laborRate:     profile.laborRate    ? parseFloat(profile.laborRate.toString())    : null,
        tier:          profile.tier,
        sampleCount:   profile.sampleCount
      }
    })
  } catch (err) {
    next(err)
  }
}

// ─── Delete a rate ────────────────────────────────────────────────────────────

/**
 * DELETE /api/rates/:canonicalRef?userId=xxx&tier=balanced
 */
async function deleteRate(req, res, next) {
  try {
    const userId = req.user.id
    const { tier } = req.query
    const { canonicalRef } = req.params

    if (!canonicalRef) {
      return res.status(400).json({ success: false, error: 'canonicalRef required' })
    }

    const filter = { userId, canonicalRef }
    if (tier) filter.tier = tier

    const result = await UserRateProfile.deleteMany(filter)

    res.json({ success: true, deleted: result.deletedCount })
  } catch (err) {
    next(err)
  }
}

// ─── Rate coverage summary ────────────────────────────────────────────────────

/**
 * GET /api/rates/coverage?userId=xxx&projectType=residential_apartment&tier=balanced
 * Shows which canonical items the user has rates for vs total available.
 * Helps user understand what to upload next.
 */
async function getRateCoverage(req, res, next) {
  try {
    const userId = req.user.id
    const { projectType, tier } = req.query

    if (!projectType) {
      return res.status(400).json({ success: false, error: 'projectType is required' })
    }

    // All L3 items for this project type
    const allItems = await CanonicalNode.find({
      projectTypes: projectType,
      level:        3,
      status:       'active'
    }).select('canonicalId label parentId').lean()

    // User's known rates
    const filter = { userId }
    if (tier) filter.tier = tier
    const knownRates = await UserRateProfile.find(filter)
      .select('canonicalRef')
      .lean()

    const knownSet = new Set(knownRates.map(r => r.canonicalRef))

    const covered   = allItems.filter(i => knownSet.has(i.canonicalId))
    const uncovered = allItems.filter(i => !knownSet.has(i.canonicalId))

    const coveragePct = allItems.length > 0
      ? Math.round((covered.length / allItems.length) * 100)
      : 0

    res.json({
      success: true,
      projectType,
      tier:          tier || 'all',
      totalItems:    allItems.length,
      covered:       covered.length,
      uncovered:     uncovered.length,
      coveragePct,
      uncoveredItems: uncovered.map(i => ({ canonicalId: i.canonicalId, label: i.label }))
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { listRates, upsertRate, deleteRate, getRateCoverage }
