const CanonicalNode      = require('../../models/CanonicalNode')
const GlobalSectionStats = require('../../models/GlobalSectionStats')
const path               = require('path')
const fs                 = require('fs')

/**
 * POST /api/setup/seed
 * Seeds canonical nodes and section stats from JSON files.
 * Only callable in non-production environments.
 */
async function runSeed(req, res, next) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Seed not allowed in production' })
    }

    const results = {}

    // ── Seed canonical nodes ───────────────────────────────────────
    const nodesPath = path.join(__dirname, '../../../../..', 'seed', 'canonical_nodes_complete.json')
    if (fs.existsSync(nodesPath)) {
      const nodes = JSON.parse(fs.readFileSync(nodesPath, 'utf8'))
      const nodesWithMeta = nodes.map(n => ({
        ...n,
        occurrenceCount:   0,
        predictionWeight:  n.isFlexible ? 1.0 : null,
        source:            n.source || 'seed_manual'
      }))

      await CanonicalNode.deleteMany({})
      await CanonicalNode.insertMany(nodesWithMeta, { ordered: false })
      results.canonicalNodes = nodesWithMeta.length
    } else {
      results.canonicalNodes = 'skipped — file not found'
    }

    // ── Seed section stats ─────────────────────────────────────────
    const statsPath = path.join(__dirname, '../../../../..', 'seed', 'global_section_stats.json')
    if (fs.existsSync(statsPath)) {
      const statsRaw   = JSON.parse(fs.readFileSync(statsPath, 'utf8'))
      const statsArray = Array.isArray(statsRaw) ? statsRaw : [statsRaw]

      await GlobalSectionStats.deleteMany({})

      for (const s of statsArray) {
        const doc = new GlobalSectionStats({
          projectType: s.projectType,
          sampleCount: s.sampleCount,
          source:      s.source || 'scribd_seed',
          lastUpdated: s.lastUpdated ? new Date(s.lastUpdated) : new Date(),
          ratioNotes:  s.ratioNotes || ''
        })
        if (s.sectionFrequency) {
          for (const [k, v] of Object.entries(s.sectionFrequency)) {
            doc.sectionFrequency.set(k, v)
          }
        }
        if (s.sectionBudgetRatio) {
          for (const [k, v] of Object.entries(s.sectionBudgetRatio)) {
            doc.sectionBudgetRatio.set(k, v)
          }
        }
        if (s.itemFrequencyBySection) {
          for (const [sectionId, itemMap] of Object.entries(s.itemFrequencyBySection)) {
            doc.itemFrequencyBySection.set(sectionId, itemMap)
          }
        }
        await doc.save()
      }

      results.sectionStats = statsArray.length
    } else {
      results.sectionStats = 'skipped — file not found'
    }

    res.json({ success: true, seeded: results })

  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/setup/stats
 * Returns collection counts for health check.
 */
async function getStats(req, res, next) {
  try {
    const [canonicalCount, statsCount] = await Promise.all([
      CanonicalNode.countDocuments({ status: 'active' }),
      GlobalSectionStats.countDocuments()
    ])

    const breakdown = await CanonicalNode.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])

    res.json({
      success: true,
      counts: {
        canonicalNodes: canonicalCount,
        sectionStats:   statsCount
      },
      byLevel: breakdown.reduce((acc, b) => {
        acc[`L${b._id}`] = b.count
        return acc
      }, {})
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { runSeed, getStats }
