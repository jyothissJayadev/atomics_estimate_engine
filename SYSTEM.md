# Atomics Estimate Engine — System Documentation (v2)

## What this system does

Takes a designer's project inputs (budget, area, room type, project type) and generates a
complete estimate structure — sections, line items, quantities, and rates — ready to edit
and send to clients.

The engine works in three interactive levels. The designer confirms sections at Level 1,
confirms items at Level 2 (with live budget feedback), and receives a full costed BOQ at
Level 3. Every confirmed estimate teaches the engine: section preferences, item preferences,
and pricing history all improve future predictions.

---

## Architecture in one paragraph

The backend is a Node/Express API. When a designer completes project setup, the controller
fetches all required data from MongoDB (canonical nodes, section stats, user rates, user
section profiles) and passes it to the EstimateEngine. The engine never touches the database
directly — it runs pure functions to predict structure, prune unaffordable sections, allocate
budget, predict items (tier-filtered), estimate quantities, attach rates, and calculate costs.
When the designer locks the estimate, structureEventProcessor diffs the AI prediction against
the final structure and writes StructureEvent records. A nightly structureLearner job reads
those events and updates CanonicalNode.predictionWeight and UserSectionProfile so the next
prediction is better.

---

## Directory structure

```
atomics_estimate_engine/
├── apps/
│   └── backend/
│       ├── config/
│       │   ├── db.js                  Mongoose connection
│       │   └── constants.js           All magic numbers, phase config,
│       │                              SECTION_MIN_COSTS, QUANTITY_RULES,
│       │                              USER_SECTION_BLEND_WEIGHTS
│       ├── controllers/
│       │   ├── finance/
│       │   │   ├── estimateController.js   CRUD + level2Items + level3Generate
│       │   │   │                           lock triggers EMA rate learning
│       │   │   ├── projectController.js    setup wizard + completeProjectSetup
│       │   │   └── uploadController.js     past estimate upload + EMA rates
│       │   │                               + UserSectionProfile bootstrap
│       │   └── setup/
│       │       └── seedController.js       API-triggered seed
│       ├── models/
│       │   ├── CanonicalNode.js       Vocabulary — 373+ nodes
│       │   │                          NEW: appropriateTiers, minCostEstimate
│       │   ├── GlobalSectionStats.js  Scribd-derived frequencies
│       │   ├── UserRateProfile.js     Per-user per-item rate history (EMA)
│       │   ├── UserSectionProfile.js  NEW — per-user section + item usage
│       │   ├── StructureEvent.js      Append-only edit log
│       │   │                          NEW: processed field, expanded eventTypes
│       │   └── finance/
│       │       └── EstimateVersion.js Main estimate document
│       ├── routes/
│       │   ├── estimates.js    CRUD + level2-items + level3-generate
│       │   ├── finance.js      Finance + upload routes (upload now active)
│       │   └── setup.js        Seed + stats + /learn trigger
│       ├── services/           NEW directory
│       │   ├── structureEventProcessor.js  Diffs AI vs final on lock
│       │   └── structureLearner.js         Nightly weight update job
│       └── server.js           Express entry + nightly cron
│
└── packages/
    └── estimate-engine/src/
        ├── engine.js              Orchestrator — all 7 steps
        ├── engineFactory.js       Phase-controlled assembly
        ├── core/
        │   ├── calculator.js      6-step pure math — UNCHANGED
        │   ├── normalizer.js      Override chain — UNCHANGED
        │   └── aggregator.js      Rollup totals — UNCHANGED
        ├── strategies/            All rate + output strategies — UNCHANGED
        └── predictor/
            ├── structurePredictor.js  4-signal L2 section scoring
            ├── budgetAllocator.js     Budget split — UNCHANGED
            ├── itemPredictor.js       Tier-filtered L3 items + user boost
            ├── sectionPruner.js       NEW — cuts unaffordable sections
            └── quantityEstimator.js   NEW — sqft-based quantity estimation
```

---

## Getting started

### Prerequisites

- Node.js 20+
- MongoDB 6+ (local or Atlas)
- Anthropic API key (for estimate upload parsing)

### Step 1 — Install

```bash
cd atomics_estimate_engine
npm install
```

### Step 2 — Environment

```bash
cd apps/backend
cp .env.example .env
# Fill in MONGO_URI, PORT, ANTHROPIC_API_KEY, JWT secrets
```

### Step 3 — Seed

```bash
node seed/seed-db.js
```

### Step 4 — Start

```bash
npm run dev
```

---

## API reference

### Health check

```
GET /health
→ { "status": "ok", "service": "atomics-estimate-engine", "time": "..." }
```

---

### Three-level estimate workflow

#### Level 1 — Complete setup, get predicted sections

```
POST /api/projects/:projectId/setup/complete
```

Validates wizard answers, runs structurePredictor (4-signal blend), returns the initial
EstimateVersion with AI-predicted L2 sections. The frontend shows this list; the designer
adds, removes, or renames sections.

---

#### Level 2 — Get items for confirmed sections

```
POST /api/estimates/:estimateId/level2-items
Body: { "confirmedSections": ["apt_modular_kitchen", "apt_false_ceiling", ...] }
```

Returns per-section item lists with allocated budgets and per-item estimated costs.
The frontend shows section cards with live budget totals that update instantly as the
designer adds or removes items (pure frontend arithmetic — no API call needed per change).

**Response shape:**
```json
{
  "success": true,
  "sections": [
    {
      "canonicalRef": "apt_modular_kitchen",
      "allocatedBudget": 240000,
      "items": [
        { "canonicalRef": "kit_carcass_ply", "estimatedCost": 18000, "confidence": "low" }
      ]
    }
  ],
  "budgetSummary": {
    "totalBudget": 1800000,
    "totalAllocated": 1710000,
    "currentEstimate": 0
  }
}
```

---

#### Level 3 — Generate full costed BOQ

```
POST /api/estimates/:estimateId/level3-generate
Body: { "confirmedItems": { "apt_modular_kitchen": ["kit_carcass_ply", ...] } }
```

Runs quantityEstimator → rate strategies → calculator.js → aggregator. Saves as a new
EstimateVersion with real cost numbers. Designer edits quantities and rates.

---

#### Lock (triggers learning)

```
POST /api/estimates/:estimateId/lock
```

Fires three async processes on lock:
1. structureEventProcessor — diffs AI vs final, writes events, updates UserSectionProfile
2. _learnRates — EMA-updates UserRateProfile from finalized rates
3. Finance recalculation sync

**Rate learning never fires on draft saves** — only on lock.

---

#### Upload past estimate (onboarding)

```
POST /api/upload/estimate
Body: { "rawText": "...", "projectType": "residential_apartment", "city": "bangalore" }
```

Claude API parses the raw text, resolves canonical references, EMA-updates UserRateProfile,
and bootstraps UserSectionProfile with section and item usage history.

---

#### Trigger learning manually

```
POST /api/setup/learn
→ { "success": true, "eventsProcessed": 42, "sectionsUpdated": 8, "usersUpdated": 15 }
```

---

### Canonical tree (for UI pickers)

```
GET /api/setup/canonical/tree/:projectType
```

Returns the full L2 → L3 tree. Use to populate "add section" and "add item" pickers
in the Level 1 and Level 2 UIs.

---

## Understanding confidence and rateSource

| rateSource | confidence | Meaning |
|---|---|---|
| `user_history` | `high` | From designer's own past estimates (EMA) |
| `scribd_ratio` | `medium` | Derived from ratio scaling (Phase 2+) |
| `demo_seed` | `low` | Hardcoded market estimate — verify |
| `unrated` | `none` | No rate available — enter manually |

---

## The 4-level canonical structure

```
L1 — Project type     e.g. residential_apartment
L2 — Section / room   e.g. apt_modular_kitchen
L3 — Work item        e.g. kit_carcass_ply
L4 — Variant          e.g. laminate_premium (only when price differs by spec)
```

### Tier filtering on L3 items (new in v2)

Each L3 CanonicalNode now has an `appropriateTiers` array. If non-empty, the item only
appears for projects in matching tiers. Examples:

| Item | appropriateTiers |
|---|---|
| `kit_countertop_quartz` | `['premium']` |
| `kit_countertop_granite` | `['balanced', 'premium']` |
| `fl_marble` | `['premium']` |
| `fl_vitrified_tile` | `[]` (all tiers) |

---

## Section prediction scoring (v2)

Flexible sections are scored using four signals:

```
step 1 — blend:
  baseScore = globalFrequency × 0.5 + userFrequency × 0.3

step 2 — context boosts (added on top, capped at 1.0):
  3BHK → +0.35 on apt_bedroom2_wardrobe
  cafe → +0.50 on hos_bar_lounge

step 3 — predictionWeight multiplier (learned from events, range 0.1–2.0):
  finalScore = (baseScore + boosts) × predictionWeight blended at 0.2 weight
```

`userFrequency` = usageCount / (usageCount + removalCount) per user per section.
Day-one value is 0. Grows as the designer completes and locks projects.

---

## Section pruning (new in v2)

After budgetAllocator assigns budgets, sectionPruner checks each section against
SECTION_MIN_COSTS:

| Section type | Prune condition |
|---|---|
| Flexible | `allocatedBudget < SECTION_MIN_COSTS[section]` |
| Anchor (isFlexible=false) | `allocatedBudget < SECTION_MIN_COSTS[section] × 0.5` |
| Unlisted | Uses `SECTION_MIN_COSTS._default` (₹15,000) |

This prevents a ₹5L project from showing a modular kitchen with ₹12,000 allocated.

---

## Quantity estimation (new in v2)

quantityEstimator fills null quantities using QUANTITY_RULES before rate strategies run,
so calculator.js produces real costs from day one instead of zeros.

| Rule type | Formula |
|---|---|
| `sqft_multiplier` | `qty = sqft × multiplier` |
| `fixed` | `qty = value` (sinks, chimneys: 1) |
| `count_from_sqft` | `qty = ceil(sqft / divisor)` |
| `wall_linear` | `qty = ceil(√sqft × 4 × multiplier)` |

Example for 1200 sqft:
```
fc_gypsum_board  → 1200 × 0.65 = 780 sqft
el_switch_point  → ceil(1200 / 80) = 15 nos
kit_sink         → 1 (fixed)
```

Designer-entered dimensions always override the rule.

---

## The 6-step cost calculation

```
Step 1   directCost   = qty × (materialRate + laborRate)
Step 2   adjustedCost = directCost × (1 + wastage/100)
Step 3   businessCost = adjustedCost × (1 + overhead/100)
Step 4   subtotal     = businessCost × (1 + markup/100)      ← sell price before tax
Step 5   finalTotal   = subtotal × (1 + tax/100)             ← GST pass-through
Step 6   grossMargin  = (subtotal − directCost) / subtotal × 100
```

Defaults: wastage 5%, overhead 10%, markup 20%, tax 18%.
Override priority: line-item → category → project → system default.
All arithmetic uses Decimal.js — never native JS floats on money.

---

## Rate learning — EMA (v2)

```
newRate = oldRate × 0.8 + incomingRate × 0.2
```

Recent estimates contribute more than old ones. After 5 estimates the most recent
contributes ~33% of the stored rate. Old rates become negligible over time.

Rate learning fires only on lockEstimate — never on draft version saves.

---

## The full learning loop (v2)

| Trigger | What updates |
|---|---|
| Lock estimate | structureEventProcessor writes accept/remove events |
| Lock estimate | _learnRates EMA-updates UserRateProfile |
| Lock estimate | UserSectionProfile updated (usage, item usage) |
| Upload past estimate | UserRateProfile EMA-bootstrapped |
| Upload past estimate | UserSectionProfile bootstrapped from sections/items |
| Nightly (every 24h) | structureLearner updates CanonicalNode.predictionWeight |
| Nightly | UserSectionProfile usage/removal counts consolidated |

---

## MongoDB collections

| Collection | Purpose | Key indexes |
|---|---|---|
| `canonicalnodes` | 373+ canonical vocabulary nodes | `canonicalId` (unique) |
| `globalsectionstats` | Scribd frequencies + budget ratios | `projectType` (unique) |
| `userrateprofiles` | Per-user EMA rate history | `userId + canonicalRef + tier` |
| `usersectionprofiles` | Per-user section + item usage | `userId + canonicalRef + projectType` (unique) |
| `structureevents` | Append-only edit log | `processed + eventType`, `projectId + timestamp` |
| `estimateversions` | Full estimate documents | `estimateId + versionNumber` (unique) |

---

## Key invariants — never break these

1. `calculator.js` is a pure function. No async, no DB, no side effects.
2. All money arithmetic uses `Decimal.js`. Never native JS floats.
3. Canonical fields never block saving. `canonicalStatus: "unresolved"` is valid.
4. `StructureEvent` is append-only. Never update or delete event records.
5. `values` Map on items stays completely free. Canonical is metadata.
6. `canonicalId` slugs never change after creation.
7. `predictionWeight` is clamped to [0.1, 2.0] — never goes to zero.
8. `CURRENT_PHASE` in `constants.js` is the single switch for phase upgrades.
9. The engine never queries the database. The controller fetches and passes everything in.
10. Rate learning only fires on lock — never on draft saves.
11. `structureLearner` is idempotent — processes only events where `processed=false`.

---

## Phase upgrades

**Current: Phase 1**
```
Rate: UserHistoryStrategy → DemoRateStrategy
Structure: Global freq + UserSectionProfile + predictionWeight
```

**Phase 2** (20+ user projects): change `CURRENT_PHASE = 2` in constants.js
```
Rate: UserHistoryStrategy → ScridbRatioStrategy → DemoRateStrategy
```

**Phase 3** (100+ projects): add GlobalBaselineStrategy to engineFactory.js

---

## Troubleshooting

**Estimate returns empty categories**
- Run `GET /api/setup/stats` — verify 300+ active canonical nodes
- Confirm `projectType` matches a valid L1 canonicalId

**All sections pruned**
- Budget is below minimum floors in `SECTION_MIN_COSTS`
- Reduce the floor values or test with a larger budget

**All rates show `confidence: "none"`**
- No UserRateProfile entries yet — upload a past estimate first
- Missing demo rates for this item — add to DemoRateStrategy.js

**Quantities all null / totals zero**
- Item has no rule in `QUANTITY_RULES` — add one, or designer enters manually

**predictionWeight not changing**
- Call `POST /api/setup/learn` and check `eventsProcessed > 0`
- Estimates must be locked, not just saved

**Rate learning not improving**
- Confirm estimates are being locked (`POST /api/estimates/:id/lock`)
- Draft saves no longer trigger learning — this is correct v2 behaviour
