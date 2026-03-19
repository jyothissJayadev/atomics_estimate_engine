/**
 * MERGE FROM ESTIMATES
 * ====================
 * Reads all scribd_00x.json files from seed/raw_estimates/
 * Merges their rawNames as aliases into canonical_nodes_complete.json
 * Unresolved items become new pending_review nodes
 *
 * Run: node seed/merge-from-estimates.js
 *
 * What this does:
 *   - Resolved sections/items  → rawName added as alias to existing canonical node
 *   - Unresolved sections/items → new node created with status: pending_review
 *   - Existing nodes are NEVER deleted or overwritten — only extended
 *   - Output: seed/canonical_nodes_complete.json (ready to seed into MongoDB)
 *
 * Run this every time you add new raw estimate files.
 * Always safe to re-run — idempotent.
 */

const fs   = require('fs')
const path = require('path')

// ─── Paths ────────────────────────────────────────────────────────────────────

const SEED_DIR        = __dirname
const ESTIMATES_DIR   = path.join(SEED_DIR, 'raw_estimates')
const BASE_FILE       = path.join(SEED_DIR, 'canonical_nodes_complete.json')
const OUTPUT_FILE     = path.join(SEED_DIR, 'canonical_nodes_complete.json')

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log('\nMerge From Estimates')
  console.log('====================\n')

  // ── Load base canonical nodes ─────────────────────────────────────────────
  if (!fs.existsSync(BASE_FILE)) {
    console.error(`Base file not found: ${BASE_FILE}`)
    console.error('Make sure canonical_nodes_complete.json is in seed/')
    process.exit(1)
  }

  const baseNodes = JSON.parse(fs.readFileSync(BASE_FILE, 'utf8'))
  console.log(`Loaded ${baseNodes.length} existing canonical nodes`)

  // Build fast lookup: canonicalId → node (we mutate these in place)
  const nodeMap = new Map()
  for (const node of baseNodes) {
    nodeMap.set(node.canonicalId, node)
  }

  // ── Load estimate files ───────────────────────────────────────────────────
  if (!fs.existsSync(ESTIMATES_DIR)) {
    console.error(`Estimates directory not found: ${ESTIMATES_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(ESTIMATES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'README.json')
    .sort()

  if (files.length === 0) {
    console.error('No .json files found in seed/raw_estimates/')
    process.exit(1)
  }

  console.log(`Found ${files.length} estimate file(s):`)
  files.forEach(f => console.log(`  - ${f}`))
  console.log()

  // ── Process each estimate ─────────────────────────────────────────────────
  const stats = {
    filesProcessed:   0,
    aliasesAdded:     0,
    newNodesCreated:  0,
    unresolvedLogged: 0
  }

  const unresolvedItems = []

  for (const file of files) {
    const filePath = path.join(ESTIMATES_DIR, file)
    let estimate

    try {
      estimate = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.warn(`  SKIP ${file} — invalid JSON: ${e.message}`)
      continue
    }

    if (!estimate.sections || !Array.isArray(estimate.sections)) {
      console.warn(`  SKIP ${file} — no sections array`)
      continue
    }

    const projectType = estimate.projectType || 'residential_apartment'
    let fileAliasCount = 0
    let fileNewCount   = 0

    for (const section of estimate.sections) {
      // ── Process section (L2) ────────────────────────────────────────────
      if (section.canonicalId && section.canonicalStatus !== 'unresolved') {
        const added = addAlias(nodeMap, section.canonicalId, section.rawName)
        if (added) { stats.aliasesAdded++; fileAliasCount++ }
      } else if (section.rawName) {
        // Unresolved section — log it for review
        unresolvedItems.push({
          type:        'section',
          rawName:     section.rawName,
          projectType,
          sourceFile:  file,
          canonicalId: null
        })
        stats.unresolvedLogged++
      }

      // ── Process items (L3) ──────────────────────────────────────────────
      for (const item of (section.items || [])) {
        if (item.canonicalId && item.canonicalStatus !== 'unresolved') {
          // Add alias to existing node
          const added = addAlias(nodeMap, item.canonicalId, item.rawName)
          if (added) { stats.aliasesAdded++; fileAliasCount++ }

          // If this canonicalId does NOT exist in our base map yet, create it
          if (!nodeMap.has(item.canonicalId)) {
            const newNode = createNewNode({
              canonicalId:  item.canonicalId,
              level:        3,
              label:        toLabel(item.rawName),
              parentId:     section.canonicalId || null,
              defaultUnit:  normaliseUnit(item.unit),
              projectType,
              rawName:      item.rawName,
              status:       'pending_review',
              source:       'scribd_extract'
            })
            nodeMap.set(newNode.canonicalId, newNode)
            stats.newNodesCreated++
            fileNewCount++
          }

        } else if (item.rawName) {
          // Unresolved item — log it
          unresolvedItems.push({
            type:          'item',
            rawName:       item.rawName,
            parentSection: section.rawName,
            projectType,
            sourceFile:    file,
            canonicalId:   null
          })
          stats.unresolvedLogged++
        }
      }
    }

    console.log(`  ${file}: +${fileAliasCount} aliases, +${fileNewCount} new nodes`)
    stats.filesProcessed++
  }

  // ── Build final sorted array ──────────────────────────────────────────────
  const finalNodes = sortNodes([...nodeMap.values()])

  // ── Write output ──────────────────────────────────────────────────────────
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalNodes, null, 2), 'utf8')

  // ── Write unresolved report ───────────────────────────────────────────────
  if (unresolvedItems.length > 0) {
    const reportPath = path.join(SEED_DIR, 'unresolved_items_report.json')
    fs.writeFileSync(reportPath, JSON.stringify(unresolvedItems, null, 2), 'utf8')
  }

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log('\n==============================')
  console.log('Merge complete')
  console.log('==============================')
  console.log(`Files processed:    ${stats.filesProcessed}`)
  console.log(`Aliases added:      ${stats.aliasesAdded}`)
  console.log(`New nodes created:  ${stats.newNodesCreated} (status: pending_review)`)
  console.log(`Unresolved logged:  ${stats.unresolvedLogged}`)
  console.log(`Total nodes now:    ${finalNodes.length}`)
  console.log()
  console.log(`Output: ${OUTPUT_FILE}`)

  if (unresolvedItems.length > 0) {
    console.log(`Unresolved report: ${path.join(SEED_DIR, 'unresolved_items_report.json')}`)
    console.log()
    console.log('Unresolved items need manual mapping or will be auto-promoted later.')
    console.log('Review unresolved_items_report.json and either:')
    console.log('  1. Add the rawName as an alias to the correct existing node, OR')
    console.log('  2. Create a new canonical node for it')
  }

  // ── Print level breakdown ─────────────────────────────────────────────────
  console.log()
  const byLevel = {}
  for (const n of finalNodes) {
    byLevel[n.level] = (byLevel[n.level] || 0) + 1
  }
  console.log('Node breakdown:')
  for (const [level, count] of Object.entries(byLevel).sort()) {
    console.log(`  L${level}: ${count}`)
  }

  // ── Flag pending_review nodes ─────────────────────────────────────────────
  const pending = finalNodes.filter(n => n.status === 'pending_review')
  if (pending.length > 0) {
    console.log()
    console.log(`Pending review (${pending.length} nodes) — new nodes from estimates:`)
    pending.slice(0, 15).forEach(n => console.log(`  - ${n.canonicalId} (${n.label})`))
    if (pending.length > 15) {
      console.log(`  ... and ${pending.length - 15} more`)
    }
  }

  console.log()
  console.log('Next step: node seed/seed-db.js')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Adds a rawName alias to an existing node.
 * Returns true if the alias was new, false if already present.
 */
function addAlias(nodeMap, canonicalId, rawName) {
  if (!rawName || !canonicalId) return false

  const node = nodeMap.get(canonicalId)
  if (!node) return false

  const clean = rawName.trim()
  if (!clean) return false

  // Check if alias already exists (case-insensitive)
  const existingLower = (node.aliases || []).map(a => a.toLowerCase())
  if (existingLower.includes(clean.toLowerCase())) return false

  if (!node.aliases) node.aliases = []
  node.aliases.push(clean)
  return true
}

/**
 * Creates a new canonical node from a raw item that doesn't have one yet.
 */
function createNewNode({ canonicalId, level, label, parentId, defaultUnit, projectType, rawName, status, source }) {
  return {
    canonicalId,
    level,
    label,
    parentId:     parentId || null,
    defaultUnit:  defaultUnit || null,
    isFlexible:   true,           // all new nodes start as flexible
    projectTypes: [projectType],
    aliases:      rawName ? [rawName] : [],
    status:       status || 'pending_review',
    source:       source || 'scribd_extract',
    notes:        `Auto-created from estimate data. Review and confirm label/aliases.`
  }
}

/**
 * Converts a raw name string to a readable label.
 * "BWP 19mm Plywood - Carcass" → "BWP 19mm plywood carcass"
 */
function toLabel(rawName) {
  if (!rawName) return ''
  return rawName
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalises a unit string to one of: sqft | rft | nos | lumpsum | null
 */
function normaliseUnit(unit) {
  if (!unit) return null
  const u = String(unit).toLowerCase().trim()
  if (['sqft', 'sq ft', 'sq.ft', 'sft'].includes(u))               return 'sqft'
  if (['rft', 'rn ft', 'running ft', 'running feet', 'rlf'].includes(u)) return 'rft'
  if (['nos', 'no', 'number', 'numbers', 'each', 'ea', 'pc', 'pcs'].includes(u)) return 'nos'
  if (['lumpsum', 'ls', 'lump sum', 'lump-sum', 'lot'].includes(u)) return 'lumpsum'
  return null
}

/**
 * Sorts nodes: L1 → L2 → L3 → L4, alphabetically within each level.
 * active nodes before pending_review before deprecated.
 */
function sortNodes(nodes) {
  const statusOrder = { active: 0, pending_review: 1, deprecated: 2 }
  return nodes.sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    const sa = statusOrder[a.status] ?? 1
    const sb = statusOrder[b.status] ?? 1
    if (sa !== sb) return sa - sb
    return a.canonicalId.localeCompare(b.canonicalId)
  })
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main()
