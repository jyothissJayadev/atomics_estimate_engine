/**
 * Reads all JSON files in seed/raw_estimates/
 * Computes GlobalSectionStats documents
 * Writes output to seed/global_section_stats.json
 *
 * Run: node seed/compute-section-stats.js
 */

const fs   = require('fs')
const path = require('path')

const ESTIMATES_DIR = path.join(__dirname, 'raw_estimates')
const OUTPUT_FILE   = path.join(__dirname, 'global_section_stats.json')

function computeStats(files) {
  const byProjectType = {}

  for (const file of files) {
    const filePath = path.join(ESTIMATES_DIR, file)
    let estimate
    try {
      estimate = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (e) {
      console.warn(`  Skipping ${file} — invalid JSON: ${e.message}`)
      continue
    }

    const pt = estimate.projectType
    if (!pt) {
      console.warn(`  Skipping ${file} — no projectType field`)
      continue
    }

    if (!byProjectType[pt]) {
      byProjectType[pt] = { projectType: pt, sampleCount: 0, estimates: [] }
    }
    byProjectType[pt].sampleCount++
    byProjectType[pt].estimates.push(estimate)
  }

  const results = []

  for (const [projectType, data] of Object.entries(byProjectType)) {
    const { estimates, sampleCount } = data

    const sectionFrequency      = {}
    const sectionRatioSamples   = {}
    const itemFrequencyBySection = {}

    for (const estimate of estimates) {
      for (const section of (estimate.sections || [])) {
        const cid = section.canonicalId
        if (!cid || section.canonicalStatus === 'unresolved') continue

        // Section frequency
        if (!sectionFrequency[cid]) sectionFrequency[cid] = { count: 0, frequency: 0 }
        sectionFrequency[cid].count++

        // Budget ratio
        if (section.sectionRatio != null) {
          if (!sectionRatioSamples[cid]) sectionRatioSamples[cid] = []
          sectionRatioSamples[cid].push(section.sectionRatio)
        }

        // Item frequency within this section
        if (!itemFrequencyBySection[cid]) itemFrequencyBySection[cid] = {}
        for (const item of (section.items || [])) {
          const icid = item.canonicalId
          if (!icid || item.canonicalStatus === 'unresolved') continue
          if (!itemFrequencyBySection[cid][icid]) {
            itemFrequencyBySection[cid][icid] = { count: 0, frequency: 0 }
          }
          itemFrequencyBySection[cid][icid].count++
        }
      }
    }

    // Compute frequencies
    for (const cid of Object.keys(sectionFrequency)) {
      sectionFrequency[cid].frequency = +(sectionFrequency[cid].count / sampleCount).toFixed(3)
    }

    // Compute item frequencies (relative to section sample count)
    for (const [cid, items] of Object.entries(itemFrequencyBySection)) {
      const sectionCount = sectionFrequency[cid]?.count || 1
      for (const icid of Object.keys(items)) {
        items[icid].frequency = +(items[icid].count / sectionCount).toFixed(3)
      }
    }

    // Compute ratio stats
    const sectionBudgetRatio = {}
    for (const [cid, ratios] of Object.entries(sectionRatioSamples)) {
      const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length
      sectionBudgetRatio[cid] = {
        mean:    +mean.toFixed(4),
        min:     +Math.min(...ratios).toFixed(4),
        max:     +Math.max(...ratios).toFixed(4),
        samples: ratios.length
      }
    }

    results.push({
      projectType,
      sampleCount,
      lastUpdated: new Date().toISOString().split('T')[0],
      source:      'scribd_seed',
      sectionFrequency,
      sectionBudgetRatio,
      itemFrequencyBySection,
      ratioNotes:  'Budget ratios from Scribd seed data. Use ratios only — not absolute prices.'
    })
  }

  return results
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(ESTIMATES_DIR)) {
  console.error(`Directory not found: ${ESTIMATES_DIR}`)
  console.error('Create seed/raw_estimates/ and add your JSON estimate files.')
  process.exit(1)
}

const files = fs.readdirSync(ESTIMATES_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()

if (files.length === 0) {
  console.error('No JSON files found in seed/raw_estimates/')
  console.error('Add at least one extracted estimate JSON file and try again.')
  process.exit(1)
}

console.log(`\nProcessing ${files.length} estimate file(s)...`)
files.forEach(f => console.log(`  - ${f}`))

const stats = computeStats(files)

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stats, null, 2), 'utf8')

console.log(`\nOutput written to: ${OUTPUT_FILE}`)
stats.forEach(s => {
  const sections = Object.keys(s.sectionFrequency).length
  const items    = Object.values(s.itemFrequencyBySection)
    .reduce((n, obj) => n + Object.keys(obj).length, 0)
  console.log(`  ${s.projectType}: ${s.sampleCount} estimates, ${sections} sections, ${items} unique items`)
})
console.log()
