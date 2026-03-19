/**
 * transformApiData.js
 *
 * Maps the raw API response from getFinancePreviewApi into the internal
 * financeData shape consumed by the layout engine and renderers.
 *
 * API shape (abbreviated):
 * {
 *   estimates: [{
 *     estimateId, estimateName, categories: [{
 *       _id, name,
 *       columns: [{ id, name, type, width, widthPercent, calculated }],
 *       computedTotals: { subtotal },
 *       items: [{ _id, values: { name, description, height, width, rate, quantity, … }, computed: { total, square } }]
 *     }]
 *   }],
 *   totals: { subtotal, gstAmount, grandTotal },
 *   footer: { notes: [] },
 *   gstEnabled, gstPercentage,
 *   status
 * }
 *
 * Internal financeData shape:
 * {
 *   projectName, clientName, preparedBy, date, currency,
 *   gstEnabled, gstPercentage,
 *   estimates: [{
 *     id, title,
 *     categories: [{
 *       id, name,
 *       columns: [{ id, name, type, isAmount, isCalc }],  ← normalised column list
 *       rows: [{ id, values: {}, computed: {}, amount }]
 *     }]
 *   }],
 *   footerNotes: string[],
 *   totals: { subtotal, gstAmount, grandTotal }
 * }
 */

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN TYPE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Columns whose type is "image" are skipped in PDF output —
 * images are not renderable in the deterministic layout engine.
 */
const SKIP_TYPES = new Set(["image"]);

/**
 * Columns that are typically the rightmost "amount" column.
 * Used to right-align and bold the value.
 */
const AMOUNT_IDS = new Set(["total", "amount", "grandtotal"]);

/**
 * Normalise a raw API column into the renderer-friendly shape.
 * Returns null if the column type should be skipped.
 *
 * @param {object} col  raw API column
 * @returns {object|null}
 */
function normaliseColumn(col) {
  if (SKIP_TYPES.has(col.type)) return null;

  return {
    id: col.id,
    name: col.name,
    type: col.type, // "text" | "number" | "currency"
    widthPct: col.widthPercent || 0,
    rawWidth: col.width || 100,
    isCalc: col.calculated || false,
    isAmount: AMOUNT_IDS.has(col.id.toLowerCase()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM → ROW
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flatten an API item into a row shape that the renderer can use.
 *
 * `values` holds user-entered fields; `computed` holds calculated fields.
 * We merge them into a single flat map keyed by column id.
 *
 * @param {object} item        raw API item
 * @param {object[]} columns   normalised column list for this category
 * @param {number} rowIndex    0-based index within category
 * @returns {object}
 */
function itemToRow(item, columns, rowIndex) {
  const merged = { ...item.values, ...item.computed };

  // Resolve the "amount" column value — prefer `total`, then `amount`
  const amount =
    item.computed?.total ?? item.computed?.amount ?? item.values?.total ?? 0;

  return {
    id: item._id,
    rowIndex,
    values: merged, // flat map: colId → value
    amount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY TRANSFORMER
// ─────────────────────────────────────────────────────────────────────────────

function transformCategory(rawCat) {
  const columns = (rawCat.columns || []).map(normaliseColumn).filter(Boolean);

  const rows = (rawCat.items || []).map((item, i) =>
    itemToRow(item, columns, i),
  );

  return {
    id: rawCat._id,
    name: rawCat.name,
    columns,
    rows,
    subtotal: rawCat.computedTotals?.subtotal ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATE TRANSFORMER
// ─────────────────────────────────────────────────────────────────────────────

function transformEstimate(rawEst) {
  return {
    id: rawEst.estimateId,
    title: rawEst.estimateName,
    version: rawEst.currentVersion,
    isLocked: rawEst.isLocked,
    categories: (rawEst.categories || []).map(transformCategory),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRANSFORMER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transform the raw API response into the internal financeData shape.
 *
 * @param {object} apiResponse   raw response from getFinancePreviewApi
 * @param {object} [meta={}]     optional project meta (projectName, clientName, etc.)
 * @returns {object}             financeData
 */
export function transformApiData(apiResponse, meta = {}) {
  const {
    estimates = [],
    totals = {},
    footer = {},
    header = {},
    gstEnabled = false,
    gstPercentage = 0,
  } = apiResponse;

  // Resolve company name: header.companyName wins, then meta, then fallback
  const companyName =
    header.companyName || meta.preparedBy || "Studio Interiors";

  // Resolve quotation date: header.quotationDate wins, then meta.date
  const quotationDate = header.quotationDate
    ? new Date(header.quotationDate).toISOString().slice(0, 10)
    : meta.date || new Date().toISOString().slice(0, 10);

  return {
    // Project-level meta
    projectName: meta.projectName || "Interior Design Project",
    clientName: meta.clientName || "",
    preparedBy: companyName,
    date: quotationDate,
    currency: meta.currency || "₹",

    // Raw header object — kept so the editor can pre-fill all fields
    header: {
      companyName: companyName,
      phone: header.phone || "",
      email: header.email || "",
      location: header.location || "",
      quotationDate: quotationDate,
      logoUrl: header.logoUrl || "",
    },

    // GST
    gstEnabled,
    gstPercentage,

    // Estimates
    estimates: estimates.map(transformEstimate),

    // Footer
    footer: { notes: footer.notes || [] },
    footerNotes: footer.notes || [],

    // API-computed totals
    apiTotals: {
      subtotal: totals.subtotal || 0,
      gstAmount: totals.gstAmount || 0,
      grandTotal: totals.grandTotal || 0,
    },
  };
}
