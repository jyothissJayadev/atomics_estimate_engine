/**
 * seed-canonical-items.js
 *
 * Seeds / upserts CanonicalItem documents from canonical_catalogue.json
 * (produced by running: python3 txt_to_json.py canonical_catalogue.txt canonical_catalogue.json)
 *
 * Also mirrors each entry into CanonicalNode (setOnInsert only — never overwrites
 * predictionWeight, occurrenceCount, or other learned fields).
 *
 * Usage:
 *   node apps/backend/seed/seed-canonical-items.js [path/to/canonical_catalogue.json]
 *
 * If path not given, looks for canonical_catalogue.json in the same directory.
 */

'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const path      = require('path')
const fs        = require('fs')
const mongoose  = require('mongoose')

const CanonicalItem = require('../models/CanonicalItem')
const CanonicalNode = require('../models/CanonicalNode')

// ── Resolve JSON path ─────────────────────────────────────────────────────────
const jsonPath = process.argv[2]
  || path.join(__dirname, 'canonical_catalogue.json')

if (!fs.existsSync(jsonPath)) {
  console.error(`ERROR: JSON file not found: ${jsonPath}`)
  console.error('Run:  python3 txt_to_json.py canonical_catalogue.txt canonical_catalogue.json')
  console.error('Then: node apps/backend/seed/seed-canonical-items.js')
  process.exit(1)
}

const nodes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
console.log(`Loaded ${nodes.length} canonical entries from ${path.basename(jsonPath)}`)

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI not set in apps/backend/.env')
    process.exit(1)
  }

  console.log('Connecting to MongoDB…')
  await mongoose.connect(mongoUri)
  console.log('Connected.\n')

  const stats = {
    item: { created: 0, updated: 0, errors: 0 },
    node: { created: 0, updated: 0, errors: 0 },
  }

  const BATCH = 50
  for (let i = 0; i < nodes.length; i += BATCH) {
    const batch = nodes.slice(i, i + BATCH)

    await Promise.all(batch.map(async node => {

      // ── CanonicalItem (full upsert — rates and rules always refreshed) ────
      try {
        const itemDoc = {
          canonicalId:        node.canonicalId,
          label:              node.label,
          level:              node.level,
          parentId:           node.parentId  || null,
          defaultUnit:        node.defaultUnit || null,
          isFlexible:         node.isFlexible,
          projectTypes:       node.projectTypes || [],
          aliases:            node.aliases      || [],
          status:             node.status       || 'active',
          source:             node.source       || 'seed',
          baselineRates:      node.baselineRates || {},
          regionMultipliers:  node.regionMultipliers || {},
          quantityRule:       node.quantityRule  || null,
          defaultBudgetRatio: node.defaultBudgetRatio || null,
          minCostEstimate:    node.minCostEstimate    || null,
          notes:              node.notes || '',
        }

        const existing = await CanonicalItem.findOne({ canonicalId: node.canonicalId }).lean()
        await CanonicalItem.findOneAndUpdate(
          { canonicalId: node.canonicalId },
          { $set: itemDoc },
          { upsert: true, setDefaultsOnInsert: true }
        )
        if (existing) stats.item.updated++
        else          stats.item.created++
      } catch (err) {
        stats.item.errors++
        console.error(`  CanonicalItem error [${node.canonicalId}]:`, err.message)
      }

      // ── CanonicalNode (setOnInsert only — never overwrites learned data) ──
      try {
        const existingNode = await CanonicalNode.findOne({ canonicalId: node.canonicalId }).lean()
        await CanonicalNode.findOneAndUpdate(
          { canonicalId: node.canonicalId },
          {
            $setOnInsert: {
              canonicalId:      node.canonicalId,
              label:            node.label,
              level:            node.level,
              parentId:         node.parentId  || null,
              defaultUnit:      node.defaultUnit || null,
              isFlexible:       node.isFlexible,
              projectTypes:     node.projectTypes || [],
              aliases:          node.aliases      || [],
              status:           'active',
              source:           'seed_manual',
              predictionWeight: 1.0,
              occurrenceCount:  0,
              appropriateTiers: [],
              minCostEstimate:  node.minCostEstimate || null,
              notes:            '',
            },
            // Always keep label + aliases current on existing nodes
            $set: {
              label:   node.label,
              aliases: node.aliases || [],
            }
          },
          { upsert: true, setDefaultsOnInsert: true }
        )
        if (existingNode) stats.node.updated++
        else              stats.node.created++
      } catch (err) {
        stats.node.errors++
        console.error(`  CanonicalNode error [${node.canonicalId}]:`, err.message)
      }
    }))

    const done = Math.min(i + BATCH, nodes.length)
    process.stdout.write(`\r  Progress: ${done}/${nodes.length}`)
  }

  console.log('\n')
  console.log('═══════════════════════════════════════════════')
  console.log('  SEED COMPLETE')
  console.log('═══════════════════════════════════════════════')
  console.log(`  CanonicalItem  created: ${stats.item.created}  updated: ${stats.item.updated}  errors: ${stats.item.errors}`)
  console.log(`  CanonicalNode  created: ${stats.node.created}  updated: ${stats.node.updated}  errors: ${stats.node.errors}`)
  console.log('═══════════════════════════════════════════════')

  if (stats.item.errors === 0 && stats.node.errors === 0) {
    console.log('\n✓ Catalogue live in MongoDB. Engine will use DB rates on next request.')
  } else {
    console.log('\n⚠  Completed with errors — see above.')
  }

  await mongoose.disconnect()
}

run().catch(err => {
  console.error('Fatal:', err)
  mongoose.disconnect()
  process.exit(1)
})
