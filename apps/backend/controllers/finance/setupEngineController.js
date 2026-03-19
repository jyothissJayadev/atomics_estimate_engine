/**
 * setupEngineController
 *
 * Handles the three-level interactive engine calls during project setup wizard.
 *
 *  Level 1 — POST /projects/:projectId/setup/level1
 *    Reads wizard answers saved so far, runs structurePredictor,
 *    returns ranked L2 sections with allocated budgets.
 *
 *  Level 2 — POST /projects/:projectId/setup/level2
 *    Takes confirmed L2 section list, runs itemPredictor + quantityEstimator
 *    + rate strategies, returns L3 items with costs per section.
 *
 *  Level 3 is handled by completeProjectSetup in projectController.js —
 *    it saves confirmed sections+items as answers and runs the full engine
 *    to create the first EstimateVersion.
 */

const ProjectSetup        = require('../../models/ProjectSetup')
const CanonicalItem       = require('../../models/CanonicalItem')
const Project             = require('../../models/Project')
const CanonicalNode       = require('../../models/CanonicalNode')
const GlobalSectionStats  = require('../../models/GlobalSectionStats')
const UserRateProfile     = require('../../models/UserRateProfile')
const UserSectionProfile  = require('../../models/UserSectionProfile')
const UserQuantityProfile = require('../../models/UserQuantityProfile')
const { buildEngine }     = require('@atomics/estimate-engine')
const { generateId }      = require('../../utils/idGenerator')
const { inferTier }       = require('../../config/constants')

// ─── helpers ──────────────────────────────────────────────────────────────────

function getAnswer(setup, key) {
  if (setup.answers instanceof Map) return setup.answers.get(key)
  return (setup.answers || {})[key]
}

async function buildDbData(userId, projectType, city) {
  const [sectionStats, rawUserRates, canonicalNodes, rawUserSectionProfiles, rawUserQuantityProfiles, rawCanonicalItems] =
    await Promise.all([
      GlobalSectionStats.findOne({ projectType }).lean(),
      UserRateProfile.find({ userId: userId.toString() }).lean(),
      CanonicalNode.find({ projectTypes: projectType, status: 'active', level: { $in: [2, 3] } }).lean(),
      UserSectionProfile.find({ userId: userId.toString(), projectType }).lean(),
      UserQuantityProfile.find({ userId: userId.toString() }).lean(),
      CanonicalItem.find({ status: 'active' }).lean(),
    ])

  // Build canonicalItemMap for DemoRateStrategy (replaces hardcoded DEMO_RATES)
  const canonicalItemMap = new Map()
  for (const item of rawCanonicalItems) {
    canonicalItemMap.set(item.canonicalId, item)
  }

  const userRates = new Map()
  for (const p of rawUserRates) {
    userRates.set(`${p.canonicalRef}::${p.tier}`, p)
    if (!userRates.has(p.canonicalRef)) userRates.set(p.canonicalRef, p)
    if (p.city) userRates.set(`${p.canonicalRef}::${p.tier}::${p.city}`, p)
  }

  const userSectionProfile = {}
  for (const p of rawUserSectionProfiles) userSectionProfile[p.canonicalRef] = p

  const userQuantityProfile = {}
  for (const p of rawUserQuantityProfiles) userQuantityProfile[p.canonicalRef] = p

  const parentMap = new Map()
  for (const node of canonicalNodes) {
    if (node.level === 3 && node.parentId) parentMap.set(node.canonicalId, node.parentId)
  }

  return { sectionStats, userRates, canonicalNodes, parentMap, userSectionProfile, userQuantityProfile, city, canonicalItemMap }
}

// ─── LEVEL 1: predict sections ────────────────────────────────────────────────

async function predictSectionsForSetup(req, res, next) {
  try {
    const { projectId } = req.params
    const userId = req.user.id

    const [project, setup] = await Promise.all([
      Project.findById(projectId).lean(),
      ProjectSetup.findOne({ projectId }).lean(),
    ])
    if (!project || !setup) return res.status(404).json({ error: 'Project or setup not found' })

    const get = (k) => getAnswer(setup, k)

    const totalArea   = Number(get('totalArea'))   || 0
    const totalBudget = Number(get('totalBudget')) || 0
    const rawPT       = get('projectType') || ''

    const PROJECT_TYPE_MAP = {
      Apartment: 'residential_apartment', Villa: 'villa',
      Office: 'commercial_office', Retail: 'retail_shop',
      'Hotel / Café': 'hospitality', Clinic: 'clinic_healthcare',
      'School / College': 'education', Industrial: 'industrial_warehouse',
    }
    const projectType = PROJECT_TYPE_MAP[rawPT] || rawPT
    const city        = get('city') || null
    const rooms       = get('subType') || get('roomConfig') || get('roomSubtype') || '3BHK'
    const roomSubtype = get('roomSubtype') || null
    const tier        = inferTier(totalBudget, totalArea)

    if (!projectType || !totalBudget || !totalArea) {
      return res.status(400).json({ error: 'projectType, totalBudget and totalArea are required in setup answers' })
    }

    const input = { projectType, budget: totalBudget, sqft: totalArea, rooms, roomSubtype, tier, city, userId: userId.toString() }
    const dbData = await buildDbData(userId, projectType, city)
    const engine = buildEngine(dbData)

    // Run only the section prediction steps (not full BOQ)
    const fullResult = engine.predict(input, dbData, generateId)

    // Return sections with allocated budgets — no item details yet (that's Level 2)
    const sections = (fullResult.categories || []).map(cat => ({
      canonicalRef:    cat.canonicalRef,
      label:           cat.name,
      allocatedBudget: cat._allocatedBudget || 0,
      isAnchor:        !!(dbData.canonicalNodes.find(n => n.canonicalId === cat.canonicalRef)?.isFlexible === false),
      confidence:      'predicted',
    }))

    // Pruned sections — sections that were considered but dropped by sectionPruner
    // because allocatedBudget < minCostEstimate. We return them separately so
    // Step 4 can show the designer why they were excluded and how much more budget is needed.
    const { SECTION_MIN_COSTS } = require('../../config/constants')
    const predictedRefs = new Set(sections.map(s => s.canonicalRef))
    const allL2Nodes = dbData.canonicalNodes.filter(n => n.level === 2)
    const prunedSections = allL2Nodes
      .filter(n => !predictedRefs.has(n.canonicalId) && n.isFlexible)
      .map(n => {
        const minCost = SECTION_MIN_COSTS[n.canonicalId] || SECTION_MIN_COSTS._default || 15000
        return {
          canonicalRef:    n.canonicalId,
          label:           n.label,
          allocatedBudget: 0,
          isAnchor:        false,
          pruned:          true,
          requiredBudget:  minCost,
          reason:          'Budget below minimum required for this section',
        }
      })

    // Also return all available L2 sections for this project type (for the "add section" picker)
    const allL2 = allL2Nodes
      .map(n => ({ canonicalRef: n.canonicalId, label: n.label, isFlexible: n.isFlexible }))

    res.json({
      success: true,
      predictedSections: sections,
      prunedSections,
      allSections: allL2,
      projectContext: { projectType, tier, totalBudget, totalArea, city },
    })
  } catch (err) {
    next(err)
  }
}

// ─── LEVEL 2: predict items for confirmed sections ────────────────────────────

async function predictItemsForSetup(req, res, next) {
  try {
    const { projectId } = req.params
    const userId = req.user.id

    const { confirmedSections } = req.body  // array of canonicalRef strings
    if (!Array.isArray(confirmedSections) || confirmedSections.length === 0) {
      return res.status(400).json({ error: 'confirmedSections array is required' })
    }

    const [project, setup] = await Promise.all([
      Project.findById(projectId).lean(),
      ProjectSetup.findOne({ projectId }).lean(),
    ])
    if (!project || !setup) return res.status(404).json({ error: 'Project or setup not found' })

    const get  = (k) => getAnswer(setup, k)
    const totalArea   = Number(get('totalArea'))   || 0
    const totalBudget = Number(get('totalBudget')) || 0
    const rawPT       = get('projectType') || ''

    const PROJECT_TYPE_MAP = {
      Apartment: 'residential_apartment', Villa: 'villa',
      Office: 'commercial_office', Retail: 'retail_shop',
      'Hotel / Café': 'hospitality', Clinic: 'clinic_healthcare',
      'School / College': 'education', Industrial: 'industrial_warehouse',
    }
    const projectType = PROJECT_TYPE_MAP[rawPT] || rawPT
    const city        = get('city') || null
    const rooms       = get('subType') || get('roomConfig') || '3BHK'
    const roomSubtype = get('roomSubtype') || null
    const tier        = inferTier(totalBudget, totalArea)

    const input  = { projectType, budget: totalBudget, sqft: totalArea, rooms, roomSubtype, tier, city, userId: userId.toString() }
    const dbData = await buildDbData(userId, projectType, city)
    const engine = buildEngine(dbData)

    // Run full prediction
    const fullResult = engine.predict(input, dbData, generateId)

    // Filter to confirmed sections only and shape items with cost data
    const confirmedSet = new Set(confirmedSections)
    const sectionBudgets = {}
    for (const cat of (fullResult.categories || [])) {
      sectionBudgets[cat.canonicalRef] = cat._allocatedBudget || 0
    }

    const sections = (fullResult.categories || [])
      .filter(cat => confirmedSet.has(cat.canonicalRef))
      .map(cat => {
        // Compute section total from items
        const sectionSell = (cat.computedTotals?.totalSell) || 0
        const items = (cat.items || []).map(item => {
          const vals = item.values instanceof Map ? Object.fromEntries(item.values) : (item.values || {})
          const comp = item.computed instanceof Map ? Object.fromEntries(item.computed) : (item.computed || {})
          return {
            canonicalRef:  item.canonicalRef,
            label:         vals.description || item.canonicalRef,
            unit:          vals.unit || '',
            quantity:      vals.quantity || null,
            materialRate:  parseFloat(vals.materialRate) || 0,
            laborRate:     parseFloat(vals.laborRate) || 0,
            subtotal:      parseFloat(comp.subtotal) || 0,
            finalTotal:    parseFloat(comp.finalTotal) || 0,
            rateSource:    item.rateSource || 'unrated',
            confidence:    item.confidence || 'none',
          }
        })

        return {
          canonicalRef:    cat.canonicalRef,
          label:           cat.name,
          allocatedBudget: sectionBudgets[cat.canonicalRef] || 0,
          sectionTotal:    sectionSell,
          items,
        }
      })

    // Return ALL available L3 items per section from CanonicalItem (full catalogue).
    // This uses CanonicalItem not CanonicalNode, so the picker shows the complete
    // list even when prediction weights are zero (sparse data / day-one state).
    const itemsBySectionRef = {}
    const cityKey = (get('city') || '').toLowerCase().trim()
    const allL3Items = await CanonicalItem.find({
      projectTypes: projectType, status: 'active', level: 3
    }).lean()

    for (const item of allL3Items) {
      if (!item.parentId) continue
      if (!itemsBySectionRef[item.parentId]) itemsBySectionRef[item.parentId] = []
      const rates  = item.baselineRates?.[tier] || item.baselineRates?.balanced || {}
      const rm     = item.regionMultipliers
      const mult   = cityKey ? ((rm instanceof Map ? rm.get(cityKey) : rm?.[cityKey]) || 1.0) : 1.0
      itemsBySectionRef[item.parentId].push({
        canonicalRef:  item.canonicalId,
        label:         item.label,
        unit:          item.defaultUnit || 'nos',
        appropriateTiers: item.appropriateTiers || [],
        materialRate:  Math.round((rates.materialRate || 0) * mult),
        laborRate:     Math.round((rates.laborRate    || 0) * mult),
        indicativeRate: Math.round(((rates.materialRate || 0) + (rates.laborRate || 0)) * mult),
      })
    }

    // Project totals
    const projectTotal = sections.reduce((s, sec) => s + sec.sectionTotal, 0)
    const budgetDeviation = totalBudget > 0
      ? ((projectTotal - totalBudget) / totalBudget * 100).toFixed(1)
      : null

    res.json({
      success: true,
      sections,
      allItemsBySectionRef: itemsBySectionRef,
      projectTotals: {
        totalBudget,
        projectTotal: Math.round(projectTotal),
        budgetDeviationPercent: budgetDeviation ? parseFloat(budgetDeviation) : null,
        isOverBudget: projectTotal > totalBudget,
      },
    })
  } catch (err) {
    next(err)
  }
}

// ─── RECALCULATE: re-price confirmed items after add/remove in Step 5 ──────────
// Called every time the designer adds or removes an item.
// Body: { confirmedSections: [...], confirmedItems: { sectionRef: [itemRef, ...] }, tierOverride? }

async function recalculateItems(req, res, next) {
  try {
    const { projectId } = req.params
    const userId = req.user.id

    const { confirmedSections, confirmedItems, tierOverride } = req.body
    if (!confirmedSections?.length || !confirmedItems) {
      return res.status(400).json({ error: 'confirmedSections and confirmedItems are required' })
    }

    const [project, setup] = await Promise.all([
      Project.findById(projectId).lean(),
      ProjectSetup.findOne({ projectId }).lean(),
    ])
    if (!project || !setup) return res.status(404).json({ error: 'Project or setup not found' })

    const get         = (k) => getAnswer(setup, k)
    const totalArea   = Number(get('totalArea'))   || 0
    const totalBudget = Number(get('totalBudget')) || 0
    const rawPT       = get('projectType') || ''
    const PROJECT_TYPE_MAP = {
      Apartment: 'residential_apartment', Villa: 'villa',
      Office: 'commercial_office', Retail: 'retail_shop',
      'Hotel / Café': 'hospitality', Clinic: 'clinic_healthcare',
      'School / College': 'education', Industrial: 'industrial_warehouse',
    }
    const projectType = PROJECT_TYPE_MAP[rawPT] || rawPT
    const city        = get('city') || null
    const rooms       = get('subType') || get('roomConfig') || '3BHK'
    const roomSubtype = get('roomSubtype') || null
    const baseTier    = inferTier(totalBudget, totalArea)
    const tier        = tierOverride || baseTier

    const input  = { projectType, budget: totalBudget, sqft: totalArea, rooms, roomSubtype, tier, city, userId: userId.toString() }
    const dbData = await buildDbData(userId, projectType, city)
    const engine = buildEngine(dbData)

    // Run full engine prediction
    const fullResult = engine.predict(input, dbData, generateId)

    // Get CanonicalItem for items not in engine output (user-added items)
    const allConfirmedItemRefs = new Set(Object.values(confirmedItems).flat())
    const engineItemMap = new Map()
    for (const cat of (fullResult.categories || [])) {
      for (const item of (cat.items || [])) {
        if (item.canonicalRef) engineItemMap.set(item.canonicalRef, item)
      }
    }

    // For any item not in engine output, price it directly using rate strategy
    const missingRefs = [...allConfirmedItemRefs].filter(ref => !engineItemMap.has(ref))
    if (missingRefs.length > 0) {
      const { calculate } = require('@atomics/estimate-engine')
      const { resolveOverrides, buildCalculatorInput } = require('@atomics/estimate-engine')
      const { QUANTITY_RULES, SYSTEM_DEFAULTS } = require('../../config/constants')

      for (const ref of missingRefs) {
        // Fetch canonical item for this ref
        const catalogItem = dbData.canonicalItemMap.get(ref)
        if (!catalogItem) continue

        // Get rates from engine's rate strategy
        const rateResult = engine.rateStrategy.getRates(ref, tier)
        const mr = rateResult?.materialRate || 0
        const lr = rateResult?.laborRate    || 0

        // Estimate quantity from CanonicalItem.quantityRule
        const qRule = catalogItem.quantityRule
        let qty = 1
        if (qRule) {
          const sqft = totalArea || 100
          if (qRule.type === 'sqft_multiplier') qty = Math.ceil(sqft * (qRule.multiplier || 1))
          else if (qRule.type === 'fixed')       qty = qRule.value || 1
          else if (qRule.type === 'count_from_sqft') qty = Math.ceil(sqft / (qRule.divisor || 100))
          else if (qRule.type === 'wall_linear') qty = Math.ceil(Math.sqrt(sqft) * 4 * (qRule.multiplier || 1))
        }

        // Calculate costs
        const calcInput = {
          quantity: qty, materialRate: mr, laborRate: lr,
          wastage: SYSTEM_DEFAULTS.wastage, overhead: SYSTEM_DEFAULTS.overhead,
          markup: SYSTEM_DEFAULTS.markup, tax: SYSTEM_DEFAULTS.tax
        }
        const calcResult = calculate(calcInput)

        // Create a synthetic item entry
        engineItemMap.set(ref, {
          canonicalRef: ref,
          values: new Map([
            ['description', catalogItem.label],
            ['unit',        catalogItem.defaultUnit || 'nos'],
            ['quantity',    qty],
            ['materialRate', mr],
            ['laborRate',   lr],
          ]),
          computed: new Map(Object.entries(calcResult)),
          rateSource:  rateResult?.source  || 'unrated',
          confidence:  rateResult?.confidence || 'none',
        })
      }
    }

    // Shape response: per section with only confirmed items
    const confirmedSectionSet = new Set(confirmedSections)
    const sections = (fullResult.categories || [])
      .filter(cat => confirmedSectionSet.has(cat.canonicalRef))
      .map(cat => {
        const confirmedRefs = new Set(confirmedItems[cat.canonicalRef] || [])

        // Merge engine items + manually added items for this section
        const allSectionRefs = new Set([
          ...(cat.items || []).map(i => i.canonicalRef),
          ...confirmedRefs
        ])

        const items = [...allSectionRefs]
          .filter(ref => confirmedRefs.has(ref))
          .map(ref => {
            const item = engineItemMap.get(ref)
            if (!item) return null
            const vals = item.values instanceof Map ? Object.fromEntries(item.values) : (item.values || {})
            const comp = item.computed instanceof Map ? Object.fromEntries(item.computed) : (item.computed || {})
            return {
              canonicalRef:  ref,
              label:         vals.description || ref,
              unit:          vals.unit || '',
              quantity:      vals.quantity || null,
              materialRate:  parseFloat(vals.materialRate) || 0,
              laborRate:     parseFloat(vals.laborRate) || 0,
              subtotal:      parseFloat(comp.subtotal) || 0,
              finalTotal:    parseFloat(comp.finalTotal) || 0,
              rateSource:    item.rateSource || 'unrated',
              confidence:    item.confidence || 'none',
            }
          }).filter(Boolean)

        const sectionTotal = items.reduce((s, i) => s + (i.subtotal || 0), 0)
        return {
          canonicalRef: cat.canonicalRef,
          label:        cat.name,
          sectionTotal: Math.round(sectionTotal),
          items,
        }
      })

    const projectTotal = sections.reduce((s, sec) => s + sec.sectionTotal, 0)
    const budgetDeviation = totalBudget > 0
      ? parseFloat(((projectTotal - totalBudget) / totalBudget * 100).toFixed(1))
      : null

    res.json({
      success: true,
      sections,
      tier,
      tierIsOverride: !!tierOverride,
      projectTotals: {
        totalBudget,
        projectTotal: Math.round(projectTotal),
        budgetDeviationPercent: budgetDeviation,
        isOverBudget: projectTotal > totalBudget,
      },
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { predictSectionsForSetup, predictItemsForSetup, recalculateItems }
