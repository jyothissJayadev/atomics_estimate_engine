# Atomics Estimate Engine — Complete Flowcharts (v2)

Paste any diagram into https://mermaid.live to edit.

---

## 1 · Complete three-level request lifecycle

```mermaid
flowchart TD
  SETUP([Designer completes project setup\nPOST /api/projects/:id/setup/complete])
  SETUP --> L1ENGINE[Level 1 Engine\nstructurePredictor\n4-signal section scoring]
  L1ENGINE --> L1UI([L2 sections returned to UI\ndesigner adds / removes / renames])
  L1UI --> L1CONFIRM[Designer confirms section list]

  L1CONFIRM --> L2ENGINE[Level 2 Engine\nPOST /api/estimates/:id/level2-items\nbudgetAllocator → sectionPruner → itemPredictor]
  L2ENGINE --> L2UI([Section cards shown\nitem lists + allocated budgets\nlive budget total updates])
  L2UI --> L2CONFIRM[Designer confirms item list]

  L2CONFIRM --> L3ENGINE[Level 3 Engine\nPOST /api/estimates/:id/level3-generate\nquantityEstimator → rates → calculator]
  L3ENGINE --> BOQ([Full BOQ with real cost numbers\ndesigner edits quantities and rates])
  BOQ --> SAVE[Save version\nPOST /api/estimates/:id/version\nno rate learning here]
  SAVE --> LOCK

  LOCK([Designer locks estimate\nPOST /api/estimates/:id/lock])
  LOCK --> PROC[structureEventProcessor\ndiff AI vs final structure]
  LOCK --> RATES[_learnRates\nEMA update UserRateProfile]
  PROC --> EVENTS[(StructureEvent records written\nprocessed=false)]
  EVENTS --> NIGHTLY[Nightly structureLearner\nPOST /api/setup/learn]
  NIGHTLY --> WEIGHTS[(CanonicalNode.predictionWeight updated\nUserSectionProfile updated)]
  WEIGHTS -.->|Next predict call improved| L1ENGINE
```

---

## 2 · Level 1 — structurePredictor internal flow

```mermaid
flowchart TD
  IN([predictSections\ninput + dbData]) --> SPLIT[Split CanonicalNodes\nlevel=2 + projectType match]

  SPLIT --> ANCHORS[Anchors: isFlexible=false\nalways included\nsorted by ANCHOR_ORDER]
  SPLIT --> FLEX[Flexible: isFlexible=true\nscored and filtered]

  FLEX --> S1[Signal 1: globalFrequency\nfrom GlobalSectionStats\nweight 0.5]
  FLEX --> S2[Signal 2: userFrequency\nfrom UserSectionProfile\nusageCount / total\nweight 0.3]

  S1 & S2 --> BLEND[baseScore = global×0.5 + user×0.3]

  BLEND --> BOOST[Context boosts added\n3BHK +0.35 to bedroom2\ncafe +0.50 to bar_lounge\ncap at 1.0]

  BOOST --> WEIGHT[Multiply by predictionWeight\nlearned from events\nrange 0.1–2.0\nweight 0.2 blend]

  WEIGHT --> THRESH{score >= 0.25?}
  THRESH -- Yes --> INCLUDE[Include section]
  THRESH -- No --> EXCLUDE[Exclude section]

  ANCHORS & INCLUDE --> ALLOCATE[budgetAllocator\nsplit budget across sections\n5% buffer held back]
  ALLOCATE --> PRUNE[sectionPruner\ncheck allocatedBudget vs SECTION_MIN_COSTS]
  PRUNE --> RESULT([Ordered section list\nwith allocatedBudget])
```

---

## 3 · Level 2 — itemPredictor + real-time budget

```mermaid
flowchart TD
  IN([For each confirmed section\ncanonicalNode + allocatedBudget]) --> L3NODES[Find L3 nodes\nparentId = sectionId\nstatus = active]

  L3NODES --> TIER{node.appropriateTiers\nnon-empty?}
  TIER -- Yes --> TIERCHECK{projectTier\nin appropriateTiers?}
  TIERCHECK -- No --> SKIP[Skip item]
  TIERCHECK -- Yes --> FREQ
  TIER -- No --> FREQ[Get Scribd frequency]

  FREQ --> USERBOOST[User item history boost\n+0.15 × userItemFreq\nfrom UserSectionProfile]
  USERBOOST --> THRESH{boostedFreq >= 0.20?}
  THRESH -- Yes --> STUB[Build item stub\nnull qty, null rates]
  THRESH -- No --> SKIP

  STUB --> RESPONSE([Section cards returned to UI\nwith estimatedCost per item\nallocatedBudget / itemCount])

  RESPONSE --> UI([Designer adds / removes items\nUI sums estimatedCost live\nno API call per change])

  UI --> BUDGET[Header bar updates\nBudget ₹X\nEstimate ₹Y\nVariation ₹Z]
```

---

## 4 · Level 3 — quantityEstimator + calculator pipeline

```mermaid
flowchart TD
  IN([Confirmed item list\nfrom Level 2]) --> QE[quantityEstimator\nfor each item]

  QE --> RULE{QUANTITY_RULES\nhas entry?}
  RULE -- No --> NULL[quantity stays null\ndesigner enters manually]
  RULE -- sqft_multiplier --> QM[qty = sqft × multiplier\ne.g. fc_gypsum_board = 1200×0.65 = 780]
  RULE -- fixed --> QF[qty = value\ne.g. kit_sink = 1]
  RULE -- count_from_sqft --> QC[qty = ceil sqft / divisor\ne.g. el_switch = ceil 1200/80 = 15]
  RULE -- wall_linear --> QW[qty = ceil sqrt sqft × 4 × mult\nrough perimeter estimate]

  NULL & QM & QF & QC & QW --> RS[CompositeRateStrategy\nper item]

  RS --> TRY1[UserHistoryStrategy\nUserRateProfile EMA rates\nconfidence: high]
  TRY1 -- miss --> TRY2[ScridbRatioStrategy\nPhase 2+ only\nconfidence: medium]
  TRY2 -- miss --> TRY3[DemoRateStrategy\nhardcoded market rates\nconfidence: low]
  TRY3 -- miss --> UNRATED[source: unrated\nconfidence: none]

  TRY1 & TRY2 & TRY3 & UNRATED --> CALC[calculator.js\n6-step pure math\nDecimal.js]
  CALC --> AGG[aggregateCategory\nroll up item totals]
  AGG --> PAGG[aggregateProject\nbudgetDeviationPercent]
  PAGG --> SAVE[(New EstimateVersion saved\nwith real cost numbers)]
```

---

## 5 · Rate strategy chain — CompositeRateStrategy

```mermaid
flowchart TD
  IN([getRates\nitemCanonicalRef + tier]) --> TRY1

  TRY1[UserHistoryStrategy] --> Q1{userRates Map\nhas tier-specific key\ncanonicalRef::tier?}
  Q1 -- Yes --> R1([materialRate + laborRate\nconfidence: high\nsource: user_history])
  Q1 -- No --> Q1B{has generic key\ncanonicalRef?}
  Q1B -- Yes --> R1
  Q1B -- No --> NULL1[return null]

  NULL1 --> TRY2[ScridbRatioStrategy\nPhase 2 only]
  TRY2 --> Q2{sectionStats available\nAND user has anchor rate\nAND item freq >= 0.20?}
  Q2 -- No --> NULL2[return null]
  Q2 -- Yes --> R2([estimatedRate = anchor × scalingFactor\nconfidence: medium\nsource: scribd_ratio])

  NULL2 --> TRY3[DemoRateStrategy]
  TRY3 --> Q3{DEMO_RATES\ntier → canonicalRef\nexists?}
  Q3 -- Yes --> R3([seeded market rate\nconfidence: low\nsource: demo_seed])
  Q3 -- No --> NULL3[return null]

  NULL3 --> FALLBACK([materialRate: null\nconfidence: none\nsource: unrated])
```

---

## 6 · Calculator — 6-step cost stack

```mermaid
flowchart TD
  IN([calculator.calculate\nqty + matRate + labRate\nwastage + overhead + markup + tax\nAll via Decimal.js])

  IN --> S1[Step 1 — Direct cost\ndirectMaterial = qty × materialRate\ndirectLabor = qty × laborRate\ndirectCost = directMaterial + directLabor]
  S1 --> S2[Step 2 — Wastage\nwastageCost = directCost × wastage%\nadjustedCost = directCost + wastageCost]
  S2 --> S3[Step 3 — Overhead\noverheadCost = adjustedCost × overhead%\nbusinessCost = adjustedCost + overheadCost]
  S3 --> S4[Step 4 — Markup and profit\nprofit = businessCost × markup%\nsubtotal = businessCost + profit]
  S4 --> S5[Step 5 — Tax GST\ntaxAmount = subtotal × tax%\nfinalTotal = subtotal + taxAmount]
  S5 --> S6[Step 6 — Gross margin\ngrossMarginPct = subtotal minus directCost / subtotal × 100]
  S6 --> OUT([return all values as plain JS numbers])

  OVR[/normalizer.resolveOverrides\nitem → category → project → system default\nDefaults: wastage 5% overhead 10% markup 20% tax 18%/]
  OVR -.-> S2
  OVR -.-> S3
  OVR -.-> S4
  OVR -.-> S5
```

---

## 7 · Lock → structureEventProcessor → learning events

```mermaid
flowchart TD
  LOCK([POST /api/estimates/:id/lock]) --> FETCH[Fetch active EstimateVersion\nand original AI-suggested events]

  FETCH --> AI[AI-suggested section refs\nfrom StructureEvent where\nwasAiSuggested=true, userAccepted=null]
  FETCH --> FINAL[Final section refs\nfrom locked EstimateVersion.categories]

  AI & FINAL --> DIFF{For each AI-suggested ref}

  DIFF -- in final --> ACCEPT[Write event\neventType: section_accepted\nwasAiSuggested: true\nuserAccepted: true]
  DIFF -- not in final --> REMOVE[Write event\neventType: section_removed\nwasAiSuggested: true\nuserAccepted: false]

  FINAL --> MANUAL{Ref not AI-suggested\nbut in final?}
  MANUAL -- Yes --> MANEVT[Write event\neventType: section_added_manual\nwasAiSuggested: false]

  ACCEPT & REMOVE & MANEVT --> PROFILE[updateUserSectionProfile\nincrement usageCount or removalCount\nupdate avgBudgetShare\nupdate itemUsage Map]

  PROFILE --> MARK[Mark original AI events\nprocessed=true]

  LOCK --> EMA[_learnRates\nEMA update UserRateProfile\nnewRate = old×0.8 + new×0.2]
```

---

## 8 · Nightly structureLearner

```mermaid
flowchart TD
  TRIGGER([POST /api/setup/learn\nor server setInterval 24h]) --> FETCH[Fetch StructureEvent\nwhere processed=false\neventType in accepted/removed/manual]

  FETCH --> NONE{events.length = 0?}
  NONE -- Yes --> DONE([Done — nothing to process])
  NONE -- No --> GROUP[Group by canonicalRef\nfor global stats\nGroup by userId:canonicalRef\nfor user stats]

  GROUP --> GLOBAL[For each section globally\nacceptRate = accepted / suggested\nremoveRate = removed / suggested\nadjustment = acceptRate - removeRate × 0.1]
  GLOBAL --> WEIGHT[CanonicalNode.predictionWeight\n+= adjustment\nclamp to range 0.1–2.0]

  GROUP --> USER[For each userId:section\nincrement usageCount for accepted\nincrement removalCount for removed]
  USER --> PROFILE[UserSectionProfile.findOneAndUpdate\nupsert if not exists]

  WEIGHT & PROFILE --> MARK[StructureEvent.updateMany\nset processed=true\nfor all processed event IDs]
  MARK --> SUMMARY([Return summary\neventsProcessed, sectionsUpdated, usersUpdated])
```

---

## 9 · Upload past estimate — onboarding and rate + profile bootstrap

```mermaid
flowchart TD
  IN([POST /api/upload/estimate\nuserId + rawText + projectType]) --> LLM[Anthropic API\nbuildExtractionPrompt\nextract sections + items + rates]

  LLM --> PARSE{Valid JSON?}
  PARSE -- No --> FAIL([422 Unprocessable])
  PARSE -- Yes --> RESOLVE[resolveUnknownItems\ncanonicalResolver.js\n4-step alias matching]

  RESOLVE --> RATES[learnRatesFromEstimate\nEMA: newRate = old×0.8 + new×0.2\nfor each resolved item with rate data]
  RESOLVE --> PROFILE[updateUserSectionProfileFromUpload\nfor each resolved section\nincrement usageCount\nupdate avgBudgetShare\nupdate itemUsage Map]

  RATES --> STATS[updateSectionStats\nincrement GlobalSectionStats\nnon-blocking]
  PROFILE --> STATS

  STATS --> RESP([200 Response\nsectionsFound, ratesLearned\nunresolvedItems list])
```

---

## 10 · Data model relationships

```mermaid
flowchart LR
  CN[(CanonicalNode\ncanonicalId\nlevel 1-4\naliases\nisFlexible\npredictionWeight\nappropriateTiers NEW\nminCostEstimate NEW)]

  GSS[(GlobalSectionStats\nprojectType\nsectionFrequency\nsectionBudgetRatio\nitemFrequencyBySection)]

  USP[(UserSectionProfile NEW\nuserId\ncanonicalRef\nusageCount\nremovalCount\navgBudgetShare\nitemUsage Map)]

  URP[(UserRateProfile\nuserId\ncanonicalRef\nmaterialRate EMA\nlaborRate EMA\nsampleCount)]

  SE[(StructureEvent\nprojectId\nestimateId\neventType\nwasAiSuggested\nuserAccepted\nprocessed NEW\nappend-only)]

  EV[(EstimateVersion\nestimateId\ncategories\ncomputedTotals\ngenerationMeta)]

  CN -- L2+L3 nodes by projectType --> EV
  GSS -- sectionFrequency budgetRatios --> EV
  URP -- materialRate laborRate per item --> EV
  USP -- userFrequency per section --> EV
  USP -- itemUsage boost --> EV
  EV -- categories canonicalRefs --> SE
  SE -- processed by structureLearner --> CN
  SE -- processed by structureLearner --> USP
  SE -- lock triggers --> URP
```

---

## 11 · Section pruner decision

```mermaid
flowchart TD
  IN([sectionPruner\nsections with allocatedBudget]) --> LOOP{For each section}

  LOOP --> LOOKUP[Look up minCost\nSECTION_MIN_COSTS map\nor node.minCostEstimate\nor _default 15000]

  LOOKUP --> ANCHOR{isAnchor\nisFlexible=false?}
  ANCHOR -- Yes --> FLOOR[floor = minCost × 0.5\nanchors get softer floor]
  ANCHOR -- No --> FULL[floor = minCost\nfull minimum required]

  FLOOR & FULL --> CHECK{allocatedBudget >= floor?}
  CHECK -- Yes --> KEEP[Keep section]
  CHECK -- No --> PRUNE[Remove section\nlog: canonicalId, budget, floor]

  KEEP & PRUNE --> LOOP
  LOOP -- done --> OUT([Return kept sections only])
```

---

## 12 · quantityEstimator rule application

```mermaid
flowchart TD
  IN([estimateQuantities\nitems + projectContext sqft]) --> LOOP{For each item}

  LOOP --> EXISTING{item.values.quantity\nalready set and > 0?}
  EXISTING -- Yes --> PRESERVE[Preserve designer-entered value\nskip rule]

  EXISTING -- No --> RULE{QUANTITY_RULES\nhas entry for canonicalRef?}
  RULE -- No --> NULL[quantity stays null\ndesigner enters manually]

  RULE -- sqft_multiplier --> RM[qty = ceil sqft × multiplier\nfc_gypsum_board: 1200 × 0.65 = 780]
  RULE -- fixed --> RF[qty = value\nkit_sink: 1\nkit_chimney: 1]
  RULE -- count_from_sqft --> RC[qty = ceil sqft / divisor\nel_switch_point: ceil 1200/80 = 15]
  RULE -- wall_linear --> RW[qty = ceil sqrt sqft × 4 × mult\nroughly: perimeter estimate]

  PRESERVE & NULL & RM & RF & RC & RW --> LOOP
  LOOP -- done --> OUT([Return items with quantities filled])
```
