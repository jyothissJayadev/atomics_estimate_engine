/**
 * CANONICAL NODE BUILDER
 * ======================
 * Generates and maintains canonical_nodes_complete.json
 *
 * Three modes:
 *
 *   node seed/build-canonical.js --mode=generate
 *     Reads raw estimate text files from seed/raw_estimates/
 *     Calls Claude to extract canonical nodes
 *     Writes canonical_nodes_complete.json
 *
 *   node seed/build-canonical.js --mode=expand --file=my_estimate.txt
 *     Reads one new estimate, extracts nodes, MERGES into existing JSON
 *     New nodes added, existing nodes get new aliases merged in
 *     Nothing is deleted
 *
 *   node seed/build-canonical.js --mode=validate
 *     Validates the existing JSON for structural correctness
 *     Reports gaps: L2 with no L3, nodes with few aliases, orphaned parents
 *
 * Usage:
 *   node seed/build-canonical.js --mode=generate
 *   node seed/build-canonical.js --mode=expand --file=seed/raw_estimates/new_estimate.txt
 *   node seed/build-canonical.js --mode=validate
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const Anthropic = require('@anthropic/sdk')
const fs        = require('fs')
const path      = require('path')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const OUTPUT_FILE      = path.join(__dirname, 'canonical_nodes_complete.json')
const RAW_ESTIMATES_DIR = path.join(__dirname, 'raw_estimates')

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = {}
process.argv.slice(2).forEach(arg => {
  const [key, val] = arg.replace('--', '').split('=')
  args[key] = val || true
})

const MODE = args.mode || 'validate'
const FILE = args.file || null

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\nCanonical Node Builder')
  console.log('======================')
  console.log(`Mode: ${MODE}\n`)

  if (MODE === 'generate') {
    await runGenerate()
  } else if (MODE === 'expand') {
    await runExpand(FILE)
  } else if (MODE === 'validate') {
    await runValidate()
  } else {
    console.error(`Unknown mode: ${MODE}`)
    console.error('Use --mode=generate | --mode=expand | --mode=validate')
    process.exit(1)
  }
}

// ─── MODE: generate ───────────────────────────────────────────────────────────
// Reads all .txt and .json files in seed/raw_estimates/
// Calls Claude on each, then merges all results together

async function runGenerate() {
  if (!fs.existsSync(RAW_ESTIMATES_DIR)) {
    console.error(`Directory not found: ${RAW_ESTIMATES_DIR}`)
    console.error('Create it and add raw estimate text files.')
    process.exit(1)
  }

  const files = fs.readdirSync(RAW_ESTIMATES_DIR)
    .filter(f => f.endsWith('.txt') || (f.endsWith('.json') && f !== 'README.md'))
    .sort()

  if (files.length === 0) {
    console.error('No .txt or .json files in seed/raw_estimates/')
    console.error('Add your Scribd estimate text files there first.')
    process.exit(1)
  }

  console.log(`Found ${files.length} estimate file(s):`)
  files.forEach(f => console.log(`  - ${f}`))
  console.log()

  const allNodes = []

  for (const file of files) {
    const filePath = path.join(RAW_ESTIMATES_DIR, file)
    console.log(`Processing: ${file}`)

    let rawText
    if (file.endsWith('.json')) {
      // Already-extracted JSON — read the rawName fields directly
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      rawText = extractTextFromJson(parsed)
    } else {
      rawText = fs.readFileSync(filePath, 'utf8')
    }

    if (!rawText || rawText.trim().length < 50) {
      console.warn(`  Skipping — file too short or empty`)
      continue
    }

    try {
      const nodes = await extractNodesFromEstimate(rawText, file)
      console.log(`  Extracted ${nodes.length} candidate nodes`)
      allNodes.push(...nodes)
    } catch (err) {
      console.error(`  Failed: ${err.message}`)
    }

    // Rate-limit between API calls
    await sleep(1000)
  }

  if (allNodes.length === 0) {
    console.error('\nNo nodes extracted. Check your ANTHROPIC_API_KEY and estimate files.')
    process.exit(1)
  }

  console.log(`\nMerging ${allNodes.length} raw nodes...`)
  const merged = mergeNodes(allNodes)

  console.log(`After dedup: ${merged.length} unique nodes`)
  printBreakdown(merged)

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`\nWritten: ${OUTPUT_FILE}`)
}

// ─── MODE: expand ─────────────────────────────────────────────────────────────
// Merges one new estimate into the existing canonical set

async function runExpand(filePath) {
  if (!filePath) {
    console.error('--file= argument required for expand mode')
    console.error('Example: node seed/build-canonical.js --mode=expand --file=seed/raw_estimates/new.txt')
    process.exit(1)
  }

  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath)

  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`)
    process.exit(1)
  }

  // Load existing nodes
  let existing = []
  if (fs.existsSync(OUTPUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
    console.log(`Loaded ${existing.length} existing nodes`)
  } else {
    console.log('No existing canonical_nodes_complete.json — will create from scratch')
  }

  // Extract from new file
  const rawText = fs.readFileSync(absPath, 'utf8')
  console.log(`Extracting from: ${path.basename(absPath)}`)

  const newNodes = await extractNodesFromEstimate(rawText, path.basename(absPath))
  console.log(`Extracted ${newNodes.length} candidate nodes`)

  // Merge: new nodes added, existing nodes get aliases merged
  const merged = mergeNodes([...existing, ...newNodes])

  const added   = merged.length - existing.length
  console.log(`\nResult: ${merged.length} total nodes (${added > 0 ? '+' + added : added} change)`)
  printBreakdown(merged)

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8')
  console.log(`\nWritten: ${OUTPUT_FILE}`)
}

// ─── MODE: validate ───────────────────────────────────────────────────────────

async function runValidate() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`File not found: ${OUTPUT_FILE}`)
    console.error('Run --mode=generate first.')
    process.exit(1)
  }

  const nodes = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
  console.log(`Validating ${nodes.length} nodes...\n`)

  const errors   = []
  const warnings = []

  // 1 — Required fields on every node
  const requiredFields = ['canonicalId', 'level', 'label', 'isFlexible', 'projectTypes', 'aliases', 'status']
  for (const node of nodes) {
    for (const field of requiredFields) {
      if (node[field] === undefined || node[field] === null) {
        errors.push(`${node.canonicalId || '??'}: missing field "${field}"`)
      }
    }
  }

  // 2 — Duplicate canonicalIds
  const ids    = nodes.map(n => n.canonicalId)
  const counts = {}
  ids.forEach(id => { counts[id] = (counts[id] || 0) + 1 })
  Object.entries(counts)
    .filter(([, c]) => c > 1)
    .forEach(([id]) => errors.push(`Duplicate canonicalId: "${id}"`))

  // 3 — Orphaned parents
  const idSet = new Set(ids)
  for (const node of nodes) {
    if (node.parentId && !idSet.has(node.parentId)) {
      errors.push(`${node.canonicalId}: parentId "${node.parentId}" does not exist`)
    }
  }

  // 4 — L3/L4 must have a unit
  for (const node of nodes) {
    if ((node.level === 3 || node.level === 4) && !node.defaultUnit) {
      warnings.push(`${node.canonicalId} (L${node.level}): no defaultUnit`)
    }
  }

  // 5 — L2 sections with no L3 children
  const l3Parents = new Set(nodes.filter(n => n.level === 3).map(n => n.parentId))
  const l2NoChildren = nodes.filter(n => n.level === 2 && !l3Parents.has(n.canonicalId))
  if (l2NoChildren.length > 0) {
    l2NoChildren.forEach(n =>
      warnings.push(`${n.canonicalId}: L2 section has no L3 items`)
    )
  }

  // 6 — Non-flexible count per project type (should be 5-8)
  const projectTypes = [...new Set(nodes.flatMap(n => n.projectTypes || []))]
  for (const pt of projectTypes) {
    const nfCount = nodes.filter(n =>
      n.level === 2 && !n.isFlexible && (n.projectTypes || []).includes(pt)
    ).length
    if (nfCount === 0) {
      errors.push(`${pt}: has NO non-flexible L2 anchors`)
    } else if (nfCount < 3) {
      warnings.push(`${pt}: only ${nfCount} non-flexible anchors (recommend 5-8)`)
    } else if (nfCount > 10) {
      warnings.push(`${pt}: ${nfCount} non-flexible anchors — too many, predictions become rigid`)
    }
  }

  // 7 — Thin aliases
  for (const node of nodes) {
    const aliasCount = (node.aliases || []).length
    if (aliasCount < 3) {
      warnings.push(`${node.canonicalId}: only ${aliasCount} alias(es) — resolver will miss variations`)
    }
  }

  // ── Print results ──────────────────────────────────────────────────────────
  printBreakdown(nodes)
  console.log()

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}) — must fix before seeding:`)
    errors.forEach(e => console.log(`  ✗ ${e}`))
    console.log()
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}) — review recommended:`)
    warnings.slice(0, 30).forEach(w => console.log(`  ⚠ ${w}`))
    if (warnings.length > 30) {
      console.log(`  ... and ${warnings.length - 30} more`)
    }
    console.log()
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✓ Validation passed — no issues found.')
  } else if (errors.length === 0) {
    console.log(`✓ No blocking errors. ${warnings.length} warning(s) to review.`)
  } else {
    console.log(`✗ ${errors.length} error(s) must be fixed before seeding.`)
    process.exit(1)
  }
}

// ─── Claude extraction ────────────────────────────────────────────────────────

async function extractNodesFromEstimate(rawText, sourceName) {
  const prompt = buildPrompt(rawText)

  const message = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 8192,
    messages:   [{ role: 'user', content: prompt }]
  })

  const content = message.content[0]?.text || ''

  // Strip markdown fences if model added them
  const cleaned = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    // Try to extract JSON array from anywhere in the response
    const match = cleaned.match(/\[[\s\S]+\]/)
    if (match) {
      try {
        parsed = JSON.parse(match[0])
      } catch (e2) {
        throw new Error(`Could not parse JSON from Claude response for ${sourceName}`)
      }
    } else {
      throw new Error(`Claude returned non-JSON for ${sourceName}: ${cleaned.substring(0, 100)}`)
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array from Claude, got ${typeof parsed}`)
  }

  // Normalise and validate each node
  return parsed
    .filter(n => n && n.canonicalId && n.level)
    .map(n => normaliseNode(n, sourceName))
}

function buildPrompt(rawText) {
  return `You are building a canonical item catalog for an Indian interior design estimation system.

Analyze the raw estimate data below and extract every section and line item as a canonical node.

LEVELS:
L1 = project type (residential_apartment | villa | commercial_office | retail_shop | hospitality | clinic_healthcare | education | industrial_warehouse)
L2 = room or section (e.g. modular kitchen, master wardrobe, false ceiling)
L3 = line item / work item within a section (e.g. carcass plywood, laminate shutter)
L4 = variant — ONLY when a different size or spec causes a genuinely different unit rate (e.g. drawer channel 400mm vs 500mm). When in doubt do NOT create L4.

REQUIRED FIELDS per node:
{
  "canonicalId": "lowercase_slug_underscores_only_globally_unique",
  "level": 1|2|3|4,
  "label": "Clean human readable label in English",
  "parentId": "canonicalId of parent node. null for L1.",
  "defaultUnit": "sqft|rft|nos|lumpsum|null",
  "isFlexible": true|false,
  "projectTypes": ["comma", "separated", "L1 canonicalIds"],
  "aliases": ["every raw name variation you see for this item", "abbreviations", "brand names"],
  "status": "active",
  "notes": "optional context"
}

RULES:
1. canonicalId: lowercase, underscores only, globally unique. Use prefixes:
   apt_ for residential apartment sections/items
   vil_ for villa-specific
   off_ for commercial office
   ret_ for retail
   hos_ for hospitality
   cli_ for clinic/healthcare
   edu_ for education
   ind_ for industrial
   kit_ for kitchen items (shared)
   wr_  for wardrobe items (shared)
   fc_  for false ceiling items (shared)
   fl_  for flooring items (shared)
   wt_  for wall treatment items (shared)
   el_  for electrical items (shared)

2. isFlexible: false ONLY for 5-8 most structurally essential L2 sections per project type.
   ALL L3 and L4 nodes must be isFlexible: true.

3. aliases: include ALL variations you see in the estimate PLUS obvious abbreviations and brand names.
   Minimum 4 aliases per node. More is better — the resolver depends on aliases.

4. defaultUnit for L3/L4: always set one of sqft|rft|nos|lumpsum. Never null for L3/L4.

5. parentId: L2 nodes point to an L1 canonicalId. L3 nodes point to an L2 canonicalId. 
   L4 nodes point to an L3 canonicalId.

6. Only create L4 when the variant truly has a different unit rate. Drawer channels by size qualify.
   Tile sizes qualify. Paint grades qualify. Most items do NOT need L4.

7. Return ONLY a valid JSON array. No markdown. No explanation. No extra text.

RAW ESTIMATE TEXT:
${rawText.substring(0, 12000)}`
}

// ─── Node normalisation ───────────────────────────────────────────────────────

function normaliseNode(raw, sourceName) {
  return {
    canonicalId:  slugify(raw.canonicalId || ''),
    level:        parseInt(raw.level) || 3,
    label:        (raw.label || '').trim(),
    parentId:     raw.parentId || null,
    defaultUnit:  normaliseUnit(raw.defaultUnit),
    isFlexible:   raw.level === 1 ? false : Boolean(raw.isFlexible !== false),
    projectTypes: Array.isArray(raw.projectTypes) ? raw.projectTypes : [raw.projectTypes].filter(Boolean),
    aliases:      dedupeAliases(raw.aliases || [], raw.label),
    status:       'active',
    notes:        raw.notes || ''
  }
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function normaliseUnit(unit) {
  if (!unit) return null
  const u = String(unit).toLowerCase().trim()
  if (u === 'sqft' || u === 'sq ft' || u === 'sq.ft')   return 'sqft'
  if (u === 'rft'  || u === 'rn ft' || u === 'running') return 'rft'
  if (u === 'nos'  || u === 'no'    || u === 'number')  return 'nos'
  if (u === 'lumpsum' || u === 'ls' || u === 'lump sum') return 'lumpsum'
  return null
}

function dedupeAliases(aliases, label) {
  const seen = new Set()
  const result = []
  for (const a of [...aliases, label]) {
    if (!a) continue
    const key = String(a).toLowerCase().trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(String(a).trim())
    }
  }
  return result
}

// ─── Merge logic ──────────────────────────────────────────────────────────────
// Deduplicates by canonicalId.
// When two nodes share the same canonicalId, merges their aliases together.
// Never deletes nodes — only adds or extends.

function mergeNodes(nodes) {
  const map = new Map()

  for (const node of nodes) {
    if (!node.canonicalId) continue

    if (!map.has(node.canonicalId)) {
      map.set(node.canonicalId, { ...node })
    } else {
      const existing = map.get(node.canonicalId)
      // Merge aliases
      const merged = dedupeAliases(
        [...(existing.aliases || []), ...(node.aliases || [])],
        existing.label
      )
      existing.aliases = merged

      // Merge projectTypes
      const pts = new Set([...(existing.projectTypes || []), ...(node.projectTypes || [])])
      existing.projectTypes = [...pts]

      // Keep non-empty notes
      if (!existing.notes && node.notes) existing.notes = node.notes

      // Prefer explicit isFlexible: false over true
      if (node.isFlexible === false) existing.isFlexible = false

      // Keep better unit if existing is null
      if (!existing.defaultUnit && node.defaultUnit) existing.defaultUnit = node.defaultUnit
    }
  }

  // Sort: L1 → L2 → L3 → L4, alphabetically within each level
  return [...map.values()].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level
    return a.canonicalId.localeCompare(b.canonicalId)
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTextFromJson(parsed) {
  // Convert an already-extracted estimate JSON to raw text
  // by joining all rawName fields — used when input is from Level 1 extraction
  const lines = []
  if (parsed.sections) {
    for (const section of parsed.sections) {
      lines.push(section.rawName || '')
      for (const item of (section.items || [])) {
        lines.push(`  ${item.rawName || ''}`)
      }
    }
  }
  return lines.join('\n')
}

function printBreakdown(nodes) {
  const byLevel = {}
  for (const n of nodes) {
    byLevel[n.level] = (byLevel[n.level] || 0) + 1
  }
  console.log(`Node counts: total=${nodes.length}`, Object.entries(byLevel).map(([l,c]) => `L${l}=${c}`).join(' '))

  const projectTypes = [...new Set(nodes.flatMap(n => n.projectTypes || []))]
  const byPt = {}
  for (const pt of projectTypes) {
    byPt[pt] = nodes.filter(n => (n.projectTypes || []).includes(pt)).length
  }
  console.log('By project type:', Object.entries(byPt).map(([pt,c]) => `${pt}=${c}`).join(' '))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('\nFailed:', err.message)
  process.exit(1)
})
