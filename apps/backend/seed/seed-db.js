/**
 * Standalone database seeder.
 * Run from anywhere inside the project: node seed/seed-db.js
 *
 * Seeds:
 *   1. canonical_nodes       from seed/canonical_nodes_complete.json
 *   2. global_section_stats  from seed/global_section_stats.json
 *
 * Safe to re-run — drops and recreates each time.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const mongoose           = require('mongoose')
const fs                 = require('fs')
const path               = require('path')

// autoIndex: false — we call createIndexes() manually below to avoid
// the Mongoose 8 duplicate-index warning when indexes already exist in Atlas.
mongoose.set('autoIndex', false)

const CanonicalNode      = require('../models/CanonicalNode')
const GlobalSectionStats = require('../models/GlobalSectionStats')

const MONGO_URI  = process.env.MONGO_URI || 'mongodb://localhost:27017/atomics_estimate'

// __dirname is always the seed/ folder regardless of where you run the script
const NODES_FILE = path.join(__dirname, 'canonical_nodes_complete.json')
const STATS_FILE = path.join(__dirname, 'global_section_stats.json')

async function dropIndexesSafely(Model) {
  try {
    await Model.collection.dropIndexes()
  } catch (e) {
    // Collection does not exist yet on first run — that is fine
    if (e.codeName !== 'NamespaceNotFound' && e.code !== 26) {
      console.warn(`  dropIndexes skipped for ${Model.modelName}: ${e.message}`)
    }
  }
}

async function seed() {
  console.log('\nAtomics Estimate Engine — Database Seeder')
  console.log('==========================================')
  console.log(`Connecting to: ${MONGO_URI}\n`)

  await mongoose.connect(MONGO_URI)
  console.log('Connected.\n')

  // ── 1. canonical_nodes ──────────────────────────────────────────────────────
  if (!fs.existsSync(NODES_FILE)) {
    console.warn('SKIP canonical_nodes — file not found:')
    console.warn(`  ${NODES_FILE}`)
    console.warn('  Copy canonical_nodes_complete.json into apps/backend/seed/\n')
  } else {
    const raw   = JSON.parse(fs.readFileSync(NODES_FILE, 'utf8'))
    const nodes = raw.map(n => ({
      ...n,
      occurrenceCount:  0,
      predictionWeight: n.isFlexible ? 1.0 : null,
      source:           n.source || 'seed_manual'
    }))

    await CanonicalNode.deleteMany({})
    await dropIndexesSafely(CanonicalNode)
    const result = await CanonicalNode.insertMany(nodes, { ordered: false })
    await CanonicalNode.createIndexes()
    console.log(`✓ canonical_nodes: inserted ${result.length} nodes`)
    console.log('  Indexes created.\n')
  }

  // ── 2. global_section_stats ─────────────────────────────────────────────────
  if (!fs.existsSync(STATS_FILE)) {
    console.warn('SKIP global_section_stats — file not found:')
    console.warn(`  ${STATS_FILE}`)
    console.warn('  Run: node seed/compute-section-stats.js first.\n')
  } else {
    const raw        = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'))
    const statsArray = Array.isArray(raw) ? raw : [raw]

    await GlobalSectionStats.deleteMany({})
    await dropIndexesSafely(GlobalSectionStats)

    for (const s of statsArray) {
      const doc = new GlobalSectionStats({
        projectType: s.projectType,
        sampleCount: s.sampleCount || 0,
        source:      s.source      || 'scribd_seed',
        lastUpdated: s.lastUpdated ? new Date(s.lastUpdated) : new Date(),
        ratioNotes:  s.ratioNotes  || ''
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

    await GlobalSectionStats.createIndexes()
    console.log(`✓ global_section_stats: inserted ${statsArray.length} document(s)`)
    console.log('  Indexes created.\n')
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const nodeCount  = await CanonicalNode.countDocuments()
  const statsCount = await GlobalSectionStats.countDocuments()

  console.log('==========================================')
  console.log('Seed complete.')
  console.log(`  canonical_nodes:      ${nodeCount}`)
  console.log(`  global_section_stats: ${statsCount}`)
  console.log()

  await mongoose.disconnect()
}

seed().catch(err => {
  console.error('\nSeed failed:', err.message)
  if (err.code === 11000) {
    console.error('Duplicate key — check your JSON for duplicate canonicalIds.')
  }
  process.exit(1)
})
