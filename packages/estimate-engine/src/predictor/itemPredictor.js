const { ITEM_THRESHOLD } = require("../../../../apps/backend/config/constants");

// Default columns for every category table
const DEFAULT_COLUMNS = [
  {
    id: "description",
    name: "Description",
    type: "text",
    width: 220,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "unit",
    name: "Unit",
    type: "unit",
    width: 70,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "quantity",
    name: "Qty",
    type: "number",
    width: 70,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "materialRate",
    name: "Material Rate",
    type: "number",
    width: 110,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "laborRate",
    name: "Labour Rate",
    type: "number",
    width: 110,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "subtotal",
    name: "Subtotal",
    type: "formula",
    width: 110,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "finalTotal",
    name: "Total (inc. GST)",
    type: "formula",
    width: 120,
    widthPercent: 0,
    visible: true,
  },
  {
    id: "notes",
    name: "Notes",
    type: "text",
    width: 150,
    widthPercent: 0,
    visible: false,
  },
];

/**
 * Predicts which L3 items should appear in a given section.
 *
 * @param {Object} sectionEntry  - one entry from structurePredictor output
 * @param {Object} input         - { projectType, tier, city }
 * @param {Object} dbData        - { sectionStats, canonicalNodes, userSectionProfile }
 * @param {string} idGenerator   - function to generate item _id
 * @returns {Object}             - category-shaped object with item stubs
 */
function predictItems(sectionEntry, input, dbData, generateId) {
  const { canonicalNode, allocatedBudget, order } = sectionEntry;
  const { tier } = input;
  const { sectionStats, canonicalNodes, userSectionProfile } = dbData;

  // Get all L3 nodes for this section
  const l3Nodes = canonicalNodes.filter(
    (n) =>
      n.level === 3 &&
      n.parentId === canonicalNode.canonicalId &&
      n.status === "active",
  );

  // Get item frequency data for this section from Scribd stats
  let sectionItemFreqs = {};
  if (sectionStats && sectionStats.itemFrequencyBySection) {
    const ibf = sectionStats.itemFrequencyBySection;
    const raw =
      ibf instanceof Map
        ? ibf.get(canonicalNode.canonicalId)
        : ibf[canonicalNode.canonicalId];
    if (raw) {
      sectionItemFreqs = raw instanceof Map ? Object.fromEntries(raw) : raw;
    }
  }

  // Get user's item usage and removal counts for this section
  let userItemUsage = {};
  let userItemRemovals = {};
  if (userSectionProfile) {
    const sectionProfile = userSectionProfile instanceof Map
      ? userSectionProfile.get(canonicalNode.canonicalId)
      : (userSectionProfile[canonicalNode.canonicalId] || null);
    if (sectionProfile) {
      if (sectionProfile.itemUsage) {
        userItemUsage = sectionProfile.itemUsage instanceof Map
          ? Object.fromEntries(sectionProfile.itemUsage)
          : sectionProfile.itemUsage;
      }
      if (sectionProfile.itemRemovalCount) {
        userItemRemovals = sectionProfile.itemRemovalCount instanceof Map
          ? Object.fromEntries(sectionProfile.itemRemovalCount)
          : sectionProfile.itemRemovalCount;
      }
    }
  }

  const totalUserUsage    = Object.values(userItemUsage).reduce((s, c) => s + c, 0)
  const totalUserRemovals = Object.values(userItemRemovals).reduce((s, c) => s + c, 0)

  // Score and filter items
  const itemStubs = [];
  for (const node of l3Nodes) {
    // ── Tier filter ───────────────────────────────────────────────────────────
    // If appropriateTiers is non-empty, this item only appears in those tiers.
    // Empty appropriateTiers means appropriate for all tiers.
    if (
      node.appropriateTiers &&
      node.appropriateTiers.length > 0 &&
      !node.appropriateTiers.includes(tier)
    ) {
      continue;
    }

    const freqEntry  = sectionItemFreqs[node.canonicalId];
    const globalFreq = freqEntry ? freqEntry.frequency || 0 : 0;

    // User item history boost (+0.15 × userItemFreq)
    const userCount  = userItemUsage[node.canonicalId] || 0;
    const userFreq   = totalUserUsage > 0 ? userCount / totalUserUsage : 0;

    // Item removal penalty: if the designer consistently removes this AI item,
    // reduce its effective score so it eventually stops being predicted.
    // removalFreq = removals / (usages + removals) for this item
    const removalCount = userItemRemovals[node.canonicalId] || 0;
    const totalItemSeen = userCount + removalCount;
    const removalFreq  = totalItemSeen > 0 ? removalCount / totalItemSeen : 0;

    const boostedFreq = globalFreq + (userFreq * 0.15) - (removalFreq * 0.10);

    // Include if above threshold OR if section has very few items
    const include =
      l3Nodes.length <= 3
        ? true
        : boostedFreq >= ITEM_THRESHOLD;

    if (!include) continue;

    itemStubs.push(buildItemStub(node, generateId()));
  }

  // Sort: higher net score first (global freq + user boost - removal penalty)
  itemStubs.sort((a, b) => {
    const usageA   = (userItemUsage[a.canonicalRef] || 0) / (totalUserUsage || 1);
    const removalA = (userItemRemovals[a.canonicalRef] || 0) /
      Math.max((userItemUsage[a.canonicalRef] || 0) + (userItemRemovals[a.canonicalRef] || 0), 1);
    const fa = (sectionItemFreqs[a.canonicalRef]?.frequency ?? 0) + usageA * 0.15 - removalA * 0.10;

    const usageB   = (userItemUsage[b.canonicalRef] || 0) / (totalUserUsage || 1);
    const removalB = (userItemRemovals[b.canonicalRef] || 0) /
      Math.max((userItemUsage[b.canonicalRef] || 0) + (userItemRemovals[b.canonicalRef] || 0), 1);
    const fb = (sectionItemFreqs[b.canonicalRef]?.frequency ?? 0) + usageB * 0.15 - removalB * 0.10;

    return fb - fa;
  });

  // Assign order
  itemStubs.forEach((item, idx) => {
    item.order = idx;
  });

  return {
    _id: generateId(),
    name: canonicalNode.label,
    order,
    canonicalRef: canonicalNode.canonicalId,
    columns: DEFAULT_COLUMNS,
    items: itemStubs,
    computedTotals: {
      totalCost: 0,
      totalSell: 0,
      marginAmount: 0,
      marginPercent: 0,
    },
    _allocatedBudget: allocatedBudget,
  };
}

/**
 * Builds a single item stub from a canonical node.
 * Rates start as null — filled by rate strategy after this.
 */
function buildItemStub(node, itemId) {
  return {
    _id: itemId,
    order: 0,
    canonicalRef: node.canonicalId,
    canonicalStatus: "resolved",
    canonicalScore: 1.0,
    confidence: "none",
    rateSource: "unrated",
    imageRefs: [],
    children: [],
    values: new Map([
      ["description", node.label],
      ["unit", node.defaultUnit || ""],
      ["quantity", null],
      ["materialRate", null],
      ["laborRate", null],
      ["notes", ""],
    ]),
    computed: new Map(),
  };
}

module.exports = { predictItems, DEFAULT_COLUMNS };
