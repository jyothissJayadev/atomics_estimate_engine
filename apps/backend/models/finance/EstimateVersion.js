const mongoose = require("mongoose");

// ─── Column Schema ────────────────────────────────────────────────────────────
// width + widthPercent both stored so frontend can use either.
// widthPercent is used for consistent layout across screen sizes.
const columnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: "" },
    type: {
      type: String,
      enum: [
        "text",
        "number",
        "currency",
        "image",
        "select",
        "unit",
        "formula",
      ],
      default: "text",
    },
    width: { type: Number, default: 150 },
    widthPercent: { type: Number, default: 0 },
    calculated: { type: Boolean, default: false },
    link: { type: String, default: null },
    calculationMode: { type: String, default: "auto" },
    required: { type: Boolean, default: false },
    fixed: { type: Boolean, default: false },
    visible: { type: Boolean, default: true },
  },
  { _id: false },
);

// ─── Cell Formatting ──────────────────────────────────────────────────────────
const formatRangeSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    type: {
      type: String,
      enum: ["bold", "italic", "underline"],
      required: true,
    },
  },
  { _id: false },
);

const cellFormattingSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true },
    itemId: { type: String, required: true },
    columnId: { type: String, required: true },
    ranges: { type: [formatRangeSchema], default: [] },
  },
  { _id: false },
);

// ─── Item Schema ──────────────────────────────────────────────────────────────
const itemSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    order: { type: Number, default: 0 },

    // Free key-value store — frontend writes whatever columns it has
    values: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Computed outputs (totals, areas) written by backend after calculation
    computed: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    imageRefs: { type: [String], default: [] },

    // Canonical metadata — never blocks saving
    canonicalRef: { type: String, default: null },
    canonicalStatus: {
      type: String,
      enum: ["resolved", "unresolved", "pending_review", "custom"],
      default: "unresolved",
    },
    canonicalScore: { type: Number, default: null },
    confidence: {
      type: String,
      enum: ["high", "medium", "low", "none"],
      default: "none",
    },
    rateSource: {
      type: String,
      enum: ["user_history", "scribd_ratio", "demo_seed", "unrated", "manual"],
      default: "unrated",
    },

    // L4 sub-variants — same structure
    children: [],
  },
  { _id: false },
);

// ─── Category Schema ──────────────────────────────────────────────────────────
const categorySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },

    canonicalRef: { type: String, default: null },

    // Columns MUST be persisted so frontend can reconstruct the table layout
    // and backend can recalculate computed values correctly
    columns: { type: [columnSchema], default: [] },

    items: [itemSchema],

    computedTotals: {
      totalCost: { type: Number, default: 0 },
      totalSell: { type: Number, default: 0 },
      marginAmount: { type: Number, default: 0 },
      marginPercent: { type: Number, default: 0 },
    },
  },
  { _id: false },
);

// ─── Estimate Version Schema ──────────────────────────────────────────────────
const estimateVersionSchema = new mongoose.Schema(
  {
    // Links to parent Estimate document
    estimateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Estimate",
      required: true,
    },

    versionNumber: {
      type: Number,
      required: true,
    },

    summary: {
      type: String,
      default: "",
    },

    categories: { type: [categorySchema], default: [] },
    cellFormatting: { type: [cellFormattingSchema], default: [] },

    // Project context — copied from setup so the version is self-contained
    projectContext: {
      projectType: { type: String, default: null },
      tier: {
        type: String,
        enum: ["budget", "balanced", "premium", null],
        default: null,
      },
      city: { type: String, default: null },
      sqft: { type: Number, default: null },
      rooms: { type: String, default: null },
      roomSubtype: { type: String, default: null },
      budget: { type: Number, default: null },
    },

    // Financial overrides applied at project level
    financialDefaults: {
      wastage: { type: Number, default: null },
      overhead: { type: Number, default: null },
      markup: { type: Number, default: null },
      tax: { type: Number, default: null },
    },

    // Totals snapshot for this version
    computedTotals: {
      subtotal: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      totalSell: { type: Number, default: 0 },
      marginAmount: { type: Number, default: 0 },
      marginPercent: { type: Number, default: 0 },
    },

    generationMeta: {
      pricingSource: { type: String, default: null },
      budgetDeviationPercent: { type: Number, default: null },
      generatedAt: { type: Date, default: Date.now },
      enginePhase: { type: Number, default: 1 },
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

estimateVersionSchema.index(
  { estimateId: 1, versionNumber: 1 },
  { unique: true },
);

module.exports = mongoose.model("EstimateVersion", estimateVersionSchema);
