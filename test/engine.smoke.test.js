/**
 * Smoke tests for the estimate engine core.
 * Run without MongoDB: node test/engine.smoke.test.js
 *
 * Tests:
 *   1. Calculator — pure math correctness
 *   2. Aggregator — rollup totals
 *   3. Normalizer — override priority
 *   4. DemoRateStrategy — returns rates
 *   5. CompositeRateStrategy — first-hit logic
 *   6. StructurePredictor — section selection
 *   7. BudgetAllocator — budget splits
 *   8. ItemPredictor — item stubs built
 *   9. Full engine.predict() — end to end without DB
 */

// Minimal test harness — no dependencies needed
let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (e) {
    console.log(`  ✗  ${name}`)
    console.log(`     ${e.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed')
}

function assertClose(a, b, tolerance, message) {
  if (Math.abs(a - b) > (tolerance || 0.01)) {
    throw new Error(`${message || ''} — expected ${b}, got ${a}`)
  }
}

// ─── Load modules ─────────────────────────────────────────────────────────────

const { calculate }   = require('../packages/estimate-engine/src/core/calculator')
const { aggregateCategory, aggregateProject } = require('../packages/estimate-engine/src/core/aggregator')
const { resolveOverrides, buildCalculatorInput } = require('../packages/estimate-engine/src/core/normalizer')
const DemoRateStrategy        = require('../packages/estimate-engine/src/strategies/rate/DemoRateStrategy')
const UserHistoryStrategy     = require('../packages/estimate-engine/src/strategies/rate/UserHistoryStrategy')
const CompositeRateStrategy   = require('../packages/estimate-engine/src/strategies/rate/CompositeRateStrategy')
const BasicValidationStrategy = require('../packages/estimate-engine/src/strategies/validation/BasicValidationStrategy')
const InternalViewStrategy    = require('../packages/estimate-engine/src/strategies/output/InternalViewStrategy')
const { predictSections }     = require('../packages/estimate-engine/src/predictor/structurePredictor')
const { allocateBudget }      = require('../packages/estimate-engine/src/predictor/budgetAllocator')
const { predictItems }        = require('../packages/estimate-engine/src/predictor/itemPredictor')
const EstimateEngine          = require('../packages/estimate-engine/src/engine')

// ─── 1. Calculator ────────────────────────────────────────────────────────────

console.log('\n1. Calculator')

test('basic calculation produces correct directCost', () => {
  const result = calculate({ quantity: 100, materialRate: 95, laborRate: 24,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  assertClose(result.directCost, 11900, 0.01, 'directCost')
})

test('6-step stack produces correct subtotal', () => {
  const result = calculate({ quantity: 100, materialRate: 95, laborRate: 24,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  // directCost=11900, wastage=595, adjusted=12495, overhead=1249.5, business=13744.5
  // profit=2748.9, subtotal=16493.4
  assertClose(result.subtotal, 16493.40, 1, 'subtotal')
})

test('grossMarginPct is positive when markup > 0', () => {
  const result = calculate({ quantity: 10, materialRate: 100, laborRate: 20,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  assert(result.grossMarginPct > 0, 'grossMarginPct should be positive')
})

test('zero quantity produces zero costs', () => {
  const result = calculate({ quantity: 0, materialRate: 95, laborRate: 24,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  assert(result.directCost === 0, 'directCost should be 0')
  assert(result.finalTotal === 0, 'finalTotal should be 0')
})

test('zero rates produce zero costs', () => {
  const result = calculate({ quantity: 100, materialRate: 0, laborRate: 0,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  assert(result.finalTotal === 0, 'finalTotal should be 0')
})

test('all returned values are plain numbers (not Decimal objects)', () => {
  const result = calculate({ quantity: 50, materialRate: 95, laborRate: 24,
                              wastage: 5, overhead: 10, markup: 20, tax: 18 })
  for (const [k, v] of Object.entries(result)) {
    assert(typeof v === 'number', `${k} should be a number, got ${typeof v}`)
  }
})

// ─── 2. Aggregator ────────────────────────────────────────────────────────────

console.log('\n2. Aggregator')

test('aggregateCategory sums item totals correctly', () => {
  const items = [
    { computed: new Map([['subtotal', 1000], ['finalTotal', 1180]]) },
    { computed: new Map([['subtotal', 2000], ['finalTotal', 2360]]) }
  ]
  const totals = aggregateCategory(items)
  assertClose(totals.totalSell, 3000, 0.01, 'totalSell')
  assertClose(totals.totalCost, 3540, 0.01, 'totalCost')
})

test('aggregateCategory handles empty items array', () => {
  const totals = aggregateCategory([])
  assert(totals.totalCost === 0 && totals.totalSell === 0, 'empty should be zero')
})

test('aggregateProject sums categories', () => {
  const cats = [
    { computedTotals: { totalCost: 100000, totalSell: 80000 } },
    { computedTotals: { totalCost: 50000,  totalSell: 40000 } }
  ]
  const result = aggregateProject(cats, 100000)
  assertClose(result.computedTotals.totalCost, 150000, 1, 'totalCost')
})

test('budgetDeviationPercent computed correctly', () => {
  const cats = [
    { computedTotals: { totalCost: 0, totalSell: 110000 } }
  ]
  const result = aggregateProject(cats, 100000)
  assertClose(result.budgetDeviationPercent, 10.0, 0.1, 'deviation should be 10%')
})

// ─── 3. Normalizer ────────────────────────────────────────────────────────────

console.log('\n3. Normalizer')

test('item-level override wins over category', () => {
  const overrides = resolveOverrides(
    { markup: 30 },      // item
    { markup: 25 },      // category
    { markup: 20 }       // project
  )
  assert(overrides.markup === 30, 'item markup should win')
})

test('category override wins over project', () => {
  const overrides = resolveOverrides({}, { markup: 25 }, { markup: 20 })
  assert(overrides.markup === 25, 'category markup should win')
})

test('system default used when nothing else set', () => {
  const overrides = resolveOverrides({}, {}, {})
  assert(overrides.markup === 20, `system default markup should be 20, got ${overrides.markup}`)
  assert(overrides.tax    === 18, `system default tax should be 18, got ${overrides.tax}`)
})

test('buildCalculatorInput merges correctly', () => {
  const overrides = resolveOverrides({}, {}, {})
  const input = buildCalculatorInput(
    { quantity: 10 },
    { materialRate: 100, laborRate: 20 },
    overrides
  )
  assert(input.quantity === 10,     'quantity correct')
  assert(input.materialRate === 100,'materialRate correct')
  assert(input.markup === 20,       'markup default correct')
})

// ─── 4. DemoRateStrategy ─────────────────────────────────────────────────────

console.log('\n4. DemoRateStrategy')

test('returns rates for known item in balanced tier', () => {
  const strategy = new DemoRateStrategy()
  const rates    = strategy.getRates('kit_carcass_ply', 'balanced')
  assert(rates !== null, 'should return rates')
  assert(rates.materialRate > 0, 'materialRate should be > 0')
  assert(rates.confidence === 'low', 'confidence should be low')
  assert(rates.source === 'demo_seed', 'source should be demo_seed')
})

test('returns rates for premium tier', () => {
  const strategy = new DemoRateStrategy()
  const rates    = strategy.getRates('kit_carcass_ply', 'premium')
  const balanced = strategy.getRates('kit_carcass_ply', 'balanced')
  assert(rates !== null, 'premium rates should exist')
  assert(rates.materialRate > balanced.materialRate, 'premium should cost more than balanced')
})

test('returns null for unknown item', () => {
  const strategy = new DemoRateStrategy()
  const rates    = strategy.getRates('nonexistent_item_xyz', 'balanced')
  assert(rates === null, 'should return null for unknown item')
})

// ─── 5. CompositeRateStrategy ─────────────────────────────────────────────────

console.log('\n5. CompositeRateStrategy')

test('returns first non-null result', () => {
  const userRates = new Map([['kit_carcass_ply', { materialRate: { toString: () => '120' }, laborRate: null, sampleCount: 3 }]])
  const composite = new CompositeRateStrategy([
    new UserHistoryStrategy(userRates),
    new DemoRateStrategy()
  ])
  const rates = composite.getRates('kit_carcass_ply', 'balanced')
  assert(rates.source === 'user_history', 'should use user history first')
})

test('falls through to demo when user has no rate', () => {
  const composite = new CompositeRateStrategy([
    new UserHistoryStrategy(new Map()),
    new DemoRateStrategy()
  ])
  const rates = composite.getRates('kit_carcass_ply', 'balanced')
  assert(rates.source === 'demo_seed', 'should fall through to demo')
})

test('returns unrated when all strategies miss', () => {
  const composite = new CompositeRateStrategy([
    new UserHistoryStrategy(new Map()),
    new DemoRateStrategy()
  ])
  const rates = composite.getRates('completely_unknown_item_abc', 'balanced')
  assert(rates.source === 'unrated', 'should return unrated')
  assert(rates.confidence === 'none', 'confidence should be none')
})

// ─── 6. StructurePredictor ───────────────────────────────────────────────────

console.log('\n6. StructurePredictor')

// Minimal mock canonical nodes
const mockL2Nodes = [
  { canonicalId: 'apt_modular_kitchen',   level: 2, isFlexible: false, projectTypes: ['residential_apartment'], status: 'active', predictionWeight: null, label: 'Modular kitchen' },
  { canonicalId: 'apt_master_wardrobe',   level: 2, isFlexible: false, projectTypes: ['residential_apartment'], status: 'active', predictionWeight: null, label: 'Master wardrobe' },
  { canonicalId: 'apt_false_ceiling',     level: 2, isFlexible: false, projectTypes: ['residential_apartment'], status: 'active', predictionWeight: null, label: 'False ceiling' },
  { canonicalId: 'apt_tv_unit',           level: 2, isFlexible: false, projectTypes: ['residential_apartment'], status: 'active', predictionWeight: null, label: 'TV unit' },
  { canonicalId: 'apt_bedroom2_wardrobe', level: 2, isFlexible: true,  projectTypes: ['residential_apartment'], status: 'active', predictionWeight: 1.0, label: 'Bedroom 2 wardrobe' },
  { canonicalId: 'apt_study_unit',        level: 2, isFlexible: true,  projectTypes: ['residential_apartment'], status: 'active', predictionWeight: 1.0, label: 'Study unit' },
  { canonicalId: 'apt_pooja_unit',        level: 2, isFlexible: true,  projectTypes: ['residential_apartment'], status: 'active', predictionWeight: 1.0, label: 'Pooja unit' }
]

const mockSectionStats = {
  sectionFrequency: {
    apt_bedroom2_wardrobe: { count: 4, frequency: 0.80 },
    apt_study_unit:        { count: 2, frequency: 0.40 },
    apt_pooja_unit:        { count: 1, frequency: 0.20 }
  },
  sectionBudgetRatio: {
    apt_modular_kitchen:   { mean: 0.28, samples: 5 },
    apt_master_wardrobe:   { mean: 0.22, samples: 5 },
    apt_false_ceiling:     { mean: 0.14, samples: 5 },
    apt_tv_unit:           { mean: 0.08, samples: 4 },
    apt_bedroom2_wardrobe: { mean: 0.12, samples: 4 }
  },
  itemFrequencyBySection: {}
}

const mockInput = {
  projectType: 'residential_apartment',
  budget: 1800000,
  sqft: 1200,
  rooms: '3BHK',
  roomSubtype: null,
  tier: 'balanced',
  city: 'bangalore'
}

test('always includes non-flexible anchors', () => {
  const sections = predictSections(mockInput, {
    sectionStats:   mockSectionStats,
    canonicalNodes: mockL2Nodes
  })
  const ids = sections.map(s => s.canonicalNode.canonicalId)
  assert(ids.includes('apt_modular_kitchen'), 'kitchen should be included')
  assert(ids.includes('apt_master_wardrobe'), 'wardrobe should be included')
  assert(ids.includes('apt_false_ceiling'),   'false ceiling should be included')
  assert(ids.includes('apt_tv_unit'),         'TV unit should be included')
})

test('high-frequency flexible sections are included', () => {
  const sections = predictSections(mockInput, {
    sectionStats:   mockSectionStats,
    canonicalNodes: mockL2Nodes
  })
  const ids = sections.map(s => s.canonicalNode.canonicalId)
  assert(ids.includes('apt_bedroom2_wardrobe'), 'bedroom2 wardrobe (freq 0.80) should be included')
})

test('anchors appear before flexible sections', () => {
  const sections = predictSections(mockInput, {
    sectionStats:   mockSectionStats,
    canonicalNodes: mockL2Nodes
  })
  const anchorOrders   = sections.filter(s => s.isAnchor).map(s => s.order)
  const flexibleOrders = sections.filter(s => !s.isAnchor).map(s => s.order)
  const maxAnchor = Math.max(...anchorOrders)
  const minFlex   = Math.min(...flexibleOrders)
  assert(maxAnchor < minFlex, 'anchors should all appear before flexible sections')
})

test('3BHK rooms input boosts bedroom2 score', () => {
  const lowRoomInput  = { ...mockInput, rooms: '1BHK' }
  const highRoomInput = { ...mockInput, rooms: '3BHK' }

  const lowSections  = predictSections(lowRoomInput,  { sectionStats: mockSectionStats, canonicalNodes: mockL2Nodes })
  const highSections = predictSections(highRoomInput, { sectionStats: mockSectionStats, canonicalNodes: mockL2Nodes })

  const lowScore  = lowSections.find(s => s.canonicalNode.canonicalId === 'apt_bedroom2_wardrobe')?.score ?? 0
  const highScore = highSections.find(s => s.canonicalNode.canonicalId === 'apt_bedroom2_wardrobe')?.score ?? 0
  assert(highScore >= lowScore, '3BHK should give equal or higher score for bedroom2 wardrobe')
})

// ─── 7. BudgetAllocator ───────────────────────────────────────────────────────

console.log('\n7. BudgetAllocator')

test('allocated budgets sum to ~95% of total (5% buffer)', () => {
  const sections = predictSections(mockInput, {
    sectionStats:   mockSectionStats,
    canonicalNodes: mockL2Nodes
  })
  const withBudgets = allocateBudget(sections, mockInput, { sectionStats: mockSectionStats })
  const totalAllocated = withBudgets.reduce((sum, s) => sum + s.allocatedBudget, 0)
  const expected = mockInput.budget * 0.95
  assertClose(totalAllocated, expected, expected * 0.01, 'allocation should be ~95% of budget')
})

test('every section gets a positive budget', () => {
  const sections    = predictSections(mockInput, { sectionStats: mockSectionStats, canonicalNodes: mockL2Nodes })
  const withBudgets = allocateBudget(sections, mockInput, { sectionStats: mockSectionStats })
  for (const s of withBudgets) {
    assert(s.allocatedBudget > 0, `${s.canonicalNode.canonicalId} should have positive budget`)
  }
})

// ─── 8. ItemPredictor ─────────────────────────────────────────────────────────

console.log('\n8. ItemPredictor')

const mockL3Nodes = [
  { canonicalId: 'kit_carcass_ply',      level: 3, parentId: 'apt_modular_kitchen', defaultUnit: 'sqft', status: 'active', label: 'Carcass plywood' },
  { canonicalId: 'kit_shutter_laminate', level: 3, parentId: 'apt_modular_kitchen', defaultUnit: 'sqft', status: 'active', label: 'Laminate shutter' },
  { canonicalId: 'kit_sink',             level: 3, parentId: 'apt_modular_kitchen', defaultUnit: 'nos',  status: 'active', label: 'Sink + faucet' }
]

const mockItemStats = {
  sectionFrequency: mockSectionStats.sectionFrequency,
  sectionBudgetRatio: mockSectionStats.sectionBudgetRatio,
  itemFrequencyBySection: {
    apt_modular_kitchen: {
      kit_carcass_ply:      { count: 5, frequency: 1.0 },
      kit_shutter_laminate: { count: 4, frequency: 0.8 },
      kit_sink:             { count: 5, frequency: 1.0 }
    }
  }
}

test('predictItems returns item stubs for high-frequency items', () => {
  const sectionEntry = {
    canonicalNode:   mockL2Nodes[0],
    allocatedBudget: 500000,
    order:           0
  }
  const category = predictItems(sectionEntry, mockInput, {
    sectionStats:   mockItemStats,
    canonicalNodes: [...mockL2Nodes, ...mockL3Nodes]
  }, () => Math.random().toString(36).substr(2, 8))

  assert(category.items.length > 0, 'should have items')
  const itemIds = category.items.map(i => i.canonicalRef)
  assert(itemIds.includes('kit_carcass_ply'),      'carcass ply (freq 1.0) should be included')
  assert(itemIds.includes('kit_shutter_laminate'), 'laminate shutter (freq 0.8) should be included')
})

test('item stubs start with null rates', () => {
  const sectionEntry = { canonicalNode: mockL2Nodes[0], allocatedBudget: 500000, order: 0 }
  const category = predictItems(sectionEntry, mockInput, {
    sectionStats:   mockItemStats,
    canonicalNodes: [...mockL2Nodes, ...mockL3Nodes]
  }, () => Math.random().toString(36).substr(2, 8))

  for (const item of category.items) {
    const values = Object.fromEntries(item.values)
    assert(values.materialRate === null, 'materialRate should start null')
    assert(values.quantity === null,     'quantity should start null')
  }
})

// ─── 9. Full engine.predict() end to end ─────────────────────────────────────

console.log('\n9. Full engine.predict() — end to end')

const allMockNodes = [...mockL2Nodes, ...mockL3Nodes]

function makeEngine() {
  const composite = new CompositeRateStrategy([
    new UserHistoryStrategy(new Map()),
    new DemoRateStrategy()
  ])
  return new EstimateEngine(composite, new BasicValidationStrategy(), new InternalViewStrategy())
}

test('predict() returns categories array', () => {
  const engine = makeEngine()
  const result = engine.predict(mockInput, {
    sectionStats:   mockItemStats,
    userRates:      new Map(),
    canonicalNodes: allMockNodes
  }, () => Math.random().toString(36).substr(2, 8))

  assert(Array.isArray(result.categories), 'should return categories array')
  assert(result.categories.length > 0,     'should have at least one category')
})

test('predict() attaches demo rates to items (confidence=low)', () => {
  const engine = makeEngine()
  const result = engine.predict(mockInput, {
    sectionStats:   mockItemStats,
    userRates:      new Map(),
    canonicalNodes: allMockNodes
  }, () => Math.random().toString(36).substr(2, 8))

  const kitchenCat = result.categories.find(c => c.canonicalRef === 'apt_modular_kitchen')
  assert(kitchenCat, 'kitchen category should exist')

  const carcassItem = kitchenCat.items.find(i => i.canonicalRef === 'kit_carcass_ply')
  assert(carcassItem, 'carcass ply item should exist')
  assert(carcassItem.confidence === 'low',        'should have low confidence (demo rate)')
  assert(carcassItem.rateSource === 'demo_seed',  'should use demo_seed source')
  const vals = Object.fromEntries(carcassItem.values)
  assert(vals.materialRate > 0, 'materialRate should be populated from demo')
})

test('predict() uses user_history when available', () => {
  const userRates = new Map([
    ['kit_carcass_ply::balanced', {
      materialRate: { toString: () => '150' },
      laborRate:    { toString: () => '35'  },
      sampleCount:  5
    }]
  ])
  const composite = new CompositeRateStrategy([
    new UserHistoryStrategy(userRates),
    new DemoRateStrategy()
  ])
  const engine = new EstimateEngine(composite, new BasicValidationStrategy(), new InternalViewStrategy())
  const result = engine.predict(mockInput, {
    sectionStats:   mockItemStats,
    userRates,
    canonicalNodes: allMockNodes
  }, () => Math.random().toString(36).substr(2, 8))

  const kitchenCat  = result.categories.find(c => c.canonicalRef === 'apt_modular_kitchen')
  const carcassItem = kitchenCat?.items.find(i => i.canonicalRef === 'kit_carcass_ply')
  assert(carcassItem, 'carcass ply should exist')
  assert(carcassItem.rateSource === 'user_history', 'should use user_history')
  assert(carcassItem.confidence === 'high',         'should have high confidence')
})

test('predict() throws on invalid input', () => {
  const engine   = makeEngine()
  let threw      = false
  try {
    engine.predict({ projectType: 'invalid_type', budget: -100, sqft: 0, rooms: '', tier: 'balanced', userId: 'u1' }, {
      sectionStats: null, userRates: new Map(), canonicalNodes: []
    }, () => 'id')
  } catch (e) {
    threw = true
  }
  assert(threw, 'should throw on invalid input')
})

test('recalculate() updates totals without re-predicting structure', () => {
  const engine = makeEngine()

  // Build an estimate first
  const predicted = engine.predict(mockInput, {
    sectionStats:   mockItemStats,
    userRates:      new Map(),
    canonicalNodes: allMockNodes
  }, () => Math.random().toString(36).substr(2, 8))

  // Set a quantity on first item of first category
  const firstItem = predicted.categories[0].items[0]
  if (firstItem) {
    if (firstItem.values instanceof Map) {
      firstItem.values.set('quantity', 100)
    } else {
      firstItem.values = { ...firstItem.values, quantity: 100 }
    }
  }

  const recalcResult = engine.recalculate(predicted, mockInput)
  assert(Array.isArray(recalcResult.categories),    'recalculate returns categories')
  assert(recalcResult.computedTotals !== undefined, 'recalculate returns totals')
})

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(45)}`)
console.log(`Tests: ${passed + failed} total  |  ${passed} passed  |  ${failed} failed`)
if (failed === 0) {
  console.log('All tests passed.\n')
} else {
  console.log('Some tests failed — check output above.\n')
  process.exit(1)
}
