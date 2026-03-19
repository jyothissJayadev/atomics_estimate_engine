const {
  SECTION_THRESHOLD,
  ROOM_CONTEXT_BOOSTS,
  SUBTYPE_BOOSTS,
  USER_SECTION_BLEND_WEIGHTS
} = require('../../../../apps/backend/config/constants')

// Fixed display order for non-flexible anchors per project type.
// Flexible sections are appended after these, sorted by score.
const ANCHOR_ORDER = {
  residential_apartment: [
    'apt_modular_kitchen',
    'apt_master_wardrobe',
    'apt_false_ceiling',
    'apt_tv_unit'
  ],
  villa: [
    'villa_modular_kitchen',
    'villa_master_wardrobe',
    'villa_false_ceiling',
    'villa_living_furniture',
    'villa_flooring',
    'villa_wall_treatment'
  ],
  commercial_office: [
    'off_reception',
    'off_workstation_area',
    'off_false_ceiling',
    'off_flooring',
    'off_wall_treatment',
    'off_electrical'
  ],
  retail_shop: [
    'ret_storefront',
    'ret_display_fixtures',
    'ret_cash_counter',
    'ret_false_ceiling',
    'ret_flooring',
    'ret_wall_treatment',
    'ret_lighting'
  ],
  hospitality: [
    'hos_guestroom',
    'hos_lobby',
    'hos_bathroom',
    'hos_false_ceiling',
    'hos_flooring',
    'hos_lighting',
    'hos_loose_ffe'
  ],
  clinic_healthcare: [
    'cli_waiting_area',
    'cli_consultation_room',
    'cli_flooring',
    'cli_wall_treatment'
  ],
  education: [
    'edu_classroom',
    'edu_admin_area',
    'edu_reception',
    'edu_flooring',
    'edu_wall_treatment',
    'edu_false_ceiling'
  ],
  industrial_warehouse: [
    'ind_office_area',
    'ind_reception',
    'ind_flooring',
    'ind_wall_treatment',
    'ind_washrooms',
    'ind_electrical'
  ]
}

/**
 * Predicts which L2 sections should appear in the estimate.
 *
 * @param {Object} input         - { projectType, rooms, roomSubtype, tier, city }
 * @param {Object} dbData        - { sectionStats, canonicalNodes, userSectionProfile }
 * @returns {Array}              - ordered section nodes with score attached
 */
function predictSections(input, dbData) {
  const { projectType, rooms, roomSubtype, tier } = input
  const { sectionStats, canonicalNodes, userSectionProfile } = dbData

  // Separate nodes into anchors and flexible
  const allL2 = canonicalNodes.filter(n =>
    n.level === 2 &&
    n.projectTypes.includes(projectType) &&
    n.status === 'active'
  )

  const anchors  = allL2.filter(n => !n.isFlexible)
  const flexible = allL2.filter(n => n.isFlexible)

  // Sort anchors by the defined display order
  const anchorOrder = ANCHOR_ORDER[projectType] || []
  anchors.sort((a, b) => {
    const ai = anchorOrder.indexOf(a.canonicalId)
    const bi = anchorOrder.indexOf(b.canonicalId)
    // If not in order list, put at end
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // Score and filter flexible sections
  const scoredFlexible = flexible
    .map(section => ({
      section,
      score: computeSectionScore(section, sectionStats, input, userSectionProfile)
    }))
    .filter(s => s.score >= SECTION_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  // Build final ordered list
  const result = [
    ...anchors.map((section, idx) => ({
      canonicalNode:   section,
      score:           1.0,
      isAnchor:        true,
      order:           idx,
      allocatedBudget: null  // filled by budgetAllocator
    })),
    ...scoredFlexible.map((s, idx) => ({
      canonicalNode:   s.section,
      score:           s.score,
      isAnchor:        false,
      order:           anchors.length + idx,
      allocatedBudget: null
    }))
  ]

  return result
}

/**
 * Scores a flexible section based on four signals:
 *   1. Global Scribd frequency
 *   2. User's own section usage frequency (UserSectionProfile)
 *   3. Room/subtype context boosts
 *   4. predictionWeight (learned from StructureEvent accept/remove history)
 *
 * Blend: globalFreq × 0.5 + userFreq × 0.3 + predWeight × 0.2
 * Context boosts are added on top of the blended score (capped at 1.0).
 * On day-1 (no UserSectionProfile), userFreq = 0 and weights rebalance naturally.
 */
function computeSectionScore(section, sectionStats, input, userSectionProfile) {
  const { rooms, roomSubtype, tier } = input
  const cid = section.canonicalId

  const W = USER_SECTION_BLEND_WEIGHTS

  // ── Signal 1: Global frequency from Scribd / GlobalSectionStats ───────────
  let globalFreq = 0.1
  if (sectionStats && sectionStats.sectionFrequency) {
    const sf   = sectionStats.sectionFrequency
    const freq = (sf instanceof Map) ? sf.get(cid) : sf[cid]
    if (freq) globalFreq = freq.frequency || 0.1
  }

  // ── Signal 2: User's own section frequency ────────────────────────────────
  // userFreq = usageCount / (usageCount + removalCount) clamped to [0, 1]
  // Defaults to 0 when no profile exists (day 1)
  let userFreq = 0
  if (userSectionProfile) {
    const profile = userSectionProfile instanceof Map
      ? userSectionProfile.get(cid)
      : (userSectionProfile[cid] || null)
    if (profile && (profile.usageCount + profile.removalCount) > 0) {
      userFreq = profile.usageCount / (profile.usageCount + profile.removalCount)
    }
  }

  // ── Blend global + user ───────────────────────────────────────────────────
  let score = (globalFreq * W.globalFreq) + (userFreq * W.userFreq)

  // ── Signal 3: Room/subtype context boosts ─────────────────────────────────
  const contextBoost = ROOM_CONTEXT_BOOSTS[cid]
  if (contextBoost) {
    if (contextBoost.rooms && rooms && contextBoost.rooms.includes(rooms)) {
      score = Math.min(score + contextBoost.boost, 1.0)
    }
    if (contextBoost.tiers && tier && contextBoost.tiers.includes(tier)) {
      score = Math.min(score + contextBoost.boost, 1.0)
    }
  }
  if (roomSubtype && SUBTYPE_BOOSTS[roomSubtype]) {
    const subtypeBoost = SUBTYPE_BOOSTS[roomSubtype][cid]
    if (subtypeBoost) score = Math.min(score + subtypeBoost, 1.0)
  }
  if (rooms && SUBTYPE_BOOSTS[rooms]) {
    const roomBoost = SUBTYPE_BOOSTS[rooms][cid]
    if (roomBoost) score = Math.min(score + roomBoost, 1.0)
  }

  // ── Signal 4: predictionWeight (learned adjustment) ───────────────────────
  const weight = (section.predictionWeight !== null && section.predictionWeight !== undefined)
    ? section.predictionWeight
    : 1.0
  score = score * (W.predWeight * weight + (1 - W.predWeight))

  return parseFloat(score.toFixed(4))
}

module.exports = { predictSections }
