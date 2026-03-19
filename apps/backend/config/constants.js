// ─── Engine Phase ────────────────────────────────────────────────────────────
// Change this single value to upgrade the engine. Nothing else changes.
// Phase 1: UserHistory + Demo rates
// Phase 2: UserHistory + ScridbRatio + Demo rates
const CURRENT_PHASE = 1

// ─── Tier Definitions ────────────────────────────────────────────────────────
const TIER_RANGES = {
  budget:   { min: 0,    max: 800  },
  balanced: { min: 800,  max: 1400 },
  premium:  { min: 1400, max: Infinity }
}

function inferTier(budget, sqft) {
  if (!sqft || sqft === 0) return 'balanced'
  const ratePerSqft = budget / sqft
  if (ratePerSqft < 800)  return 'budget'
  if (ratePerSqft < 1400) return 'balanced'
  return 'premium'
}

// ─── Prediction Thresholds ───────────────────────────────────────────────────
const SECTION_THRESHOLD = 0.25   // min Scribd frequency to include a flexible section
const ITEM_THRESHOLD    = 0.20   // min frequency to include an item in a section
const BUDGET_BUFFER     = 0.05   // 5% held back from allocation as contingency

// ─── Confidence + Source Labels ──────────────────────────────────────────────
const CONFIDENCE = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
  NONE:   'none'
}

const RATE_SOURCE = {
  USER:  'user_history',
  RATIO: 'scribd_ratio',
  DEMO:  'demo_seed',
  NONE:  'unrated'
}

// ─── Default Financial Parameters ────────────────────────────────────────────
const SYSTEM_DEFAULTS = {
  wastage:  5,    // %
  overhead: 10,   // %
  markup:   20,   // %
  tax:      18    // % (GST)
}

// ─── Room Context Rules ───────────────────────────────────────────────────────
// How room type changes section prediction scores
const ROOM_CONTEXT_BOOSTS = {
  apt_bedroom2_wardrobe: {
    rooms: ['2BHK', '3BHK', '4BHK'],
    boost: 0.35
  },
  apt_bedroom3_wardrobe: {
    rooms: ['3BHK', '4BHK'],
    boost: 0.35
  },
  apt_bedroom4_wardrobe: {
    rooms: ['4BHK'],
    boost: 0.35
  },
  apt_pooja_unit: {
    tiers: ['balanced', 'premium'],
    boost: 0.15
  },
  apt_study_unit: {
    tiers: ['balanced', 'premium'],
    boost: 0.10
  },
  apt_home_theatre: {
    tiers: ['premium'],
    boost: 0.20
  }
}

// ─── Room Subtype Boosts ──────────────────────────────────────────────────────
// How specific room subtypes change section scores
const SUBTYPE_BOOSTS = {
  // Residential
  '3BHK': { apt_bedroom3_wardrobe: 0.40, apt_bedroom2_wardrobe: 0.40 },
  '2BHK': { apt_bedroom2_wardrobe: 0.40 },
  '4BHK': { apt_bedroom3_wardrobe: 0.40, apt_bedroom2_wardrobe: 0.40 },
  'villa': { villa_staircase: 0.50, villa_outdoor_landscaping: 0.30 },

  // Commercial subtypes
  'startup_office':   { off_feature_wall: 0.40, off_av_systems: 0.35, off_lounge: 0.30 },
  'corporate_office': { off_conference_room: 0.50, off_cabin: 0.45, off_reception: 0.50 },
  'coworking':        { off_lounge: 0.40, off_pantry: 0.35 },

  // Retail subtypes
  'clothing_boutique': { ret_trial_room: 0.80, ret_display_fixtures: 0.60 },
  'cafe':              { hos_bar_lounge: 0.50, hos_restaurant_dining: 0.60 },
  'restaurant':        { hos_restaurant_dining: 0.80, hos_bar_lounge: 0.30, hos_kitchen_commercial: 0.60 },
  'showroom':          { ret_display_fixtures: 0.70, ret_signage: 0.50 }
}

// ─── Default Budget Ratios ────────────────────────────────────────────────────
// Used when Scribd stats don't have a ratio for a section
// These are fallback estimates only
const DEFAULT_BUDGET_RATIOS = {
  apt_modular_kitchen:   0.28,
  apt_master_wardrobe:   0.22,
  apt_false_ceiling:     0.14,
  apt_tv_unit:           0.08,
  apt_bedroom2_wardrobe: 0.12,
  apt_bedroom3_wardrobe: 0.10,
  apt_foyer_unit:        0.04,
  apt_study_unit:        0.05,
  apt_pooja_unit:        0.03,
  apt_flooring:          0.15,
  apt_wall_treatment:    0.08,
  apt_electrical:        0.06,
  apt_crockery_unit:     0.04,
  apt_bathroom_vanity:   0.04,
  apt_civil_work:        0.05,
  apt_window_blinds:     0.03,

  // Office defaults
  off_reception:         0.15,
  off_workstation_area:  0.30,
  off_false_ceiling:     0.12,
  off_flooring:          0.10,
  off_wall_treatment:    0.08,
  off_electrical:        0.10,
  off_cabin:             0.08,
  off_conference_room:   0.07,

  // Retail defaults
  ret_storefront:        0.20,
  ret_display_fixtures:  0.25,
  ret_cash_counter:      0.08,
  ret_false_ceiling:     0.10,
  ret_flooring:          0.12,
  ret_wall_treatment:    0.08,
  ret_lighting:          0.10
}

// ─── Valid Project Types ──────────────────────────────────────────────────────
const VALID_PROJECT_TYPES = [
  'residential_apartment',
  'villa',
  'commercial_office',
  'retail_shop',
  'hospitality',
  'clinic_healthcare',
  'education',
  'industrial_warehouse'
]

// ─── Section Score Blend Weights ─────────────────────────────────────────────
// How much each signal contributes to the final section score.
// globalFreq: from Scribd/GlobalSectionStats
// userFreq:   from UserSectionProfile (day-1 = 0, grows with usage)
// predWeight: learned adjustment from StructureEvent accept/remove history
const USER_SECTION_BLEND_WEIGHTS = {
  globalFreq:  0.5,
  userFreq:    0.3,
  predWeight:  0.2
}

// ─── Section Minimum Costs ───────────────────────────────────────────────────
// Used by sectionPruner: if allocatedBudget < minCost, section is removed.
// Values in ₹. Non-flexible anchors use 50% of this as their floor.
const SECTION_MIN_COSTS = {
  // Residential apartment
  apt_modular_kitchen:   80000,
  apt_master_wardrobe:   55000,
  apt_false_ceiling:     35000,
  apt_tv_unit:           22000,
  apt_bedroom2_wardrobe: 40000,
  apt_bedroom3_wardrobe: 35000,
  apt_bedroom4_wardrobe: 35000,
  apt_foyer_unit:        18000,
  apt_study_unit:        20000,
  apt_pooja_unit:        15000,
  apt_flooring:          35000,
  apt_wall_treatment:    20000,
  apt_electrical:        25000,
  apt_crockery_unit:     20000,
  apt_bathroom_vanity:   18000,
  apt_civil_work:        15000,
  apt_window_blinds:     12000,
  apt_home_theatre:      45000,

  // Villa
  villa_modular_kitchen:    90000,
  villa_master_wardrobe:    65000,
  villa_false_ceiling:      45000,
  villa_living_furniture:   60000,
  villa_flooring:           55000,
  villa_wall_treatment:     35000,
  villa_staircase:          80000,
  villa_outdoor_landscaping:50000,

  // Office
  off_reception:          40000,
  off_workstation_area:   55000,
  off_false_ceiling:      35000,
  off_flooring:           30000,
  off_wall_treatment:     20000,
  off_electrical:         30000,
  off_cabin:              45000,
  off_conference_room:    50000,
  off_pantry:             20000,
  off_lounge:             30000,
  off_av_systems:         40000,
  off_feature_wall:       25000,

  // Retail
  ret_storefront:         55000,
  ret_display_fixtures:   45000,
  ret_cash_counter:       20000,
  ret_false_ceiling:      30000,
  ret_flooring:           30000,
  ret_wall_treatment:     20000,
  ret_lighting:           25000,
  ret_trial_room:         18000,
  ret_signage:            15000,

  // Default fallback for any unlisted section
  _default: 15000
}

// ─── Quantity Estimation Rules ────────────────────────────────────────────────
// Used by quantityEstimator.js to fill null quantities before calculator runs.
// Rule types:
//   sqft_multiplier  → quantity = projectSqft × multiplier
//   fixed            → quantity = value (lumpsum items, fixtures)
//   count_from_sqft  → quantity = Math.ceil(projectSqft / divisor)
//   wall_linear      → quantity = Math.sqrt(projectSqft) × multiplier (rough perimeter)
// If a node has no rule, quantity stays null (requires manual entry).
const QUANTITY_RULES = {
  // False ceiling items
  fc_gypsum_board:        { type: 'sqft_multiplier', multiplier: 0.65 },
  fc_metal_frame:         { type: 'sqft_multiplier', multiplier: 0.65 },
  fc_pop_work:            { type: 'sqft_multiplier', multiplier: 0.20 },
  fc_cove_profile:        { type: 'wall_linear',     multiplier: 0.80 },
  fc_led_strip:           { type: 'wall_linear',     multiplier: 0.80 },
  fc_led_driver:          { type: 'count_from_sqft', divisor: 120 },
  fc_spotlight:           { type: 'count_from_sqft', divisor: 40 },
  fc_track_light:         { type: 'count_from_sqft', divisor: 80 },
  fc_ceiling_paint:       { type: 'sqft_multiplier', multiplier: 0.65 },

  // Kitchen
  kit_carcass_ply:        { type: 'sqft_multiplier', multiplier: 0.03 },
  kit_shutter_laminate:   { type: 'sqft_multiplier', multiplier: 0.03 },
  kit_shutter_acrylic:    { type: 'sqft_multiplier', multiplier: 0.03 },
  kit_shutter_membrane:   { type: 'sqft_multiplier', multiplier: 0.03 },
  kit_countertop_granite: { type: 'wall_linear',     multiplier: 0.08 },
  kit_countertop_quartz:  { type: 'wall_linear',     multiplier: 0.08 },
  kit_countertop_ss:      { type: 'wall_linear',     multiplier: 0.08 },
  kit_countertop_corian:  { type: 'wall_linear',     multiplier: 0.08 },
  kit_sink:               { type: 'fixed',           value: 1 },
  kit_chimney:            { type: 'fixed',           value: 1 },
  kit_hob:                { type: 'fixed',           value: 1 },
  kit_drawer_channel:     { type: 'count_from_sqft', divisor: 40 },
  kit_hinge_soft_close:   { type: 'count_from_sqft', divisor: 15 },
  kit_basket_pullout:     { type: 'fixed',           value: 2 },
  kit_handle:             { type: 'count_from_sqft', divisor: 15 },
  kit_wall_tiles:         { type: 'sqft_multiplier', multiplier: 0.025 },
  kit_labour:             { type: 'fixed',           value: 1 },

  // Wardrobe
  wr_carcass_ply:         { type: 'wall_linear',     multiplier: 0.12 },
  wr_shutter_laminate:    { type: 'wall_linear',     multiplier: 0.12 },
  wr_shutter_acrylic:     { type: 'wall_linear',     multiplier: 0.12 },
  wr_shutter_glass:       { type: 'wall_linear',     multiplier: 0.06 },
  wr_mirror:              { type: 'fixed',           value: 1 },
  wr_drawer:              { type: 'fixed',           value: 2 },
  wr_handle:              { type: 'count_from_sqft', divisor: 40 },
  wr_hinge:               { type: 'count_from_sqft', divisor: 20 },
  wr_sliding_track:       { type: 'wall_linear',     multiplier: 0.12 },
  wr_loft:                { type: 'wall_linear',     multiplier: 0.08 },
  wr_back_panel:          { type: 'wall_linear',     multiplier: 0.10 },

  // Flooring
  fl_vitrified_tile:      { type: 'sqft_multiplier', multiplier: 0.90 },
  fl_wooden_laminate:     { type: 'sqft_multiplier', multiplier: 0.90 },
  fl_vinyl_lvt:           { type: 'sqft_multiplier', multiplier: 0.90 },
  fl_marble:              { type: 'sqft_multiplier', multiplier: 0.90 },
  fl_adhesive_labour:     { type: 'sqft_multiplier', multiplier: 0.90 },
  fl_skirting_tile:       { type: 'wall_linear',     multiplier: 0.90 },

  // Wall treatment
  wt_emulsion_paint:      { type: 'sqft_multiplier', multiplier: 3.50 },
  wt_texture_paint:       { type: 'sqft_multiplier', multiplier: 0.80 },
  wt_wallpaper:           { type: 'sqft_multiplier', multiplier: 0.60 },
  wt_wpc_panel:           { type: 'sqft_multiplier', multiplier: 0.40 },
  wt_veneer_panel:        { type: 'sqft_multiplier', multiplier: 0.30 },
  wt_putty_primer:        { type: 'sqft_multiplier', multiplier: 3.50 },
  wt_stone_cladding:      { type: 'sqft_multiplier', multiplier: 0.25 },

  // Electrical
  el_switch_point:        { type: 'count_from_sqft', divisor: 80 },
  el_wiring_conduit:      { type: 'sqft_multiplier', multiplier: 1.20 },
  el_exhaust_fan:         { type: 'count_from_sqft', divisor: 400 },
  el_ac_point:            { type: 'count_from_sqft', divisor: 200 },
  el_db_box:              { type: 'fixed',           value: 1 },
  el_smart_switch:        { type: 'count_from_sqft', divisor: 150 },

  // TV unit
  tv_carcass:             { type: 'wall_linear',     multiplier: 0.06 },
  tv_shutter:             { type: 'wall_linear',     multiplier: 0.04 },
  tv_back_panel:          { type: 'wall_linear',     multiplier: 0.05 },
  tv_floating_shelf:      { type: 'fixed',           value: 1 },
  tv_led_profile:         { type: 'wall_linear',     multiplier: 0.06 },
  tv_cable_mgmt:          { type: 'fixed',           value: 1 },
  tv_wall_mounting:       { type: 'fixed',           value: 1 },

  // Foyer
  foy_shoe_cabinet_carcass:{ type: 'fixed',          value: 12 },
  foy_shoe_cabinet_shutter:{ type: 'fixed',          value: 12 },
  foy_console:            { type: 'fixed',           value: 1 },
  foy_mirror:             { type: 'fixed',           value: 1 },
  foy_wall_cladding:      { type: 'sqft_multiplier', multiplier: 0.04 },

  // Study
  std_desktop_carcass:    { type: 'fixed',           value: 20 },
  std_overhead_unit:      { type: 'fixed',           value: 12 },
  std_bookshelf:          { type: 'fixed',           value: 16 },

  // Pooja
  pj_carcass:             { type: 'fixed',           value: 18 },
  pj_marble_shelf:        { type: 'fixed',           value: 4 },
  pj_led_strip:           { type: 'fixed',           value: 6 },

  // Crockery
  cro_carcass:            { type: 'fixed',           value: 20 },
  cro_shutter_lower:      { type: 'fixed',           value: 12 },
  cro_shutter_glass:      { type: 'fixed',           value: 8 },
  cro_led_lighting:       { type: 'fixed',           value: 6 },

  // Bathroom vanity
  bv_vanity_unit:         { type: 'fixed',           value: 1 },
  bv_mirror:              { type: 'fixed',           value: 1 },
  bv_wall_tiles:          { type: 'sqft_multiplier', multiplier: 0.04 },
  bv_floor_tiles:         { type: 'sqft_multiplier', multiplier: 0.015 }
}

module.exports = {
  CURRENT_PHASE,
  TIER_RANGES,
  inferTier,
  SECTION_THRESHOLD,
  ITEM_THRESHOLD,
  BUDGET_BUFFER,
  CONFIDENCE,
  RATE_SOURCE,
  SYSTEM_DEFAULTS,
  ROOM_CONTEXT_BOOSTS,
  SUBTYPE_BOOSTS,
  DEFAULT_BUDGET_RATIOS,
  VALID_PROJECT_TYPES,
  USER_SECTION_BLEND_WEIGHTS,
  SECTION_MIN_COSTS,
  QUANTITY_RULES
}
