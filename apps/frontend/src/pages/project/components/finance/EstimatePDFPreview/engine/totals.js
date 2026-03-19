/**
 * totals.js
 *
 * Financial computation utilities for the transformed financeData shape.
 * Rows now carry a flat `values` + `computed` map rather than named fields.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a numeric value as a localized currency string.
 * @param {number} value
 * @param {string} currency  e.g. "₹"
 * @returns {string}
 */
export function formatCurrency(value, currency = "₹") {
  const num = Number(value);
  if (isNaN(num)) return `${currency}0.00`;
  return `${currency}${num.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

/**
 * Format a plain number with locale formatting (no currency symbol).
 * @param {number|string} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(value, decimals = 2) {
  const num = Number(value);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALUE FORMATTER  (dispatch by column type)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format a raw cell value according to the column's type.
 *
 * @param {*}      value
 * @param {object} col     normalised column descriptor
 * @param {string} currency
 * @returns {string}
 */
export function formatCellValue(value, col, currency = "₹") {
  if (value === undefined || value === null || value === "") return "—";

  switch (col.type) {
    case "currency":
      return formatCurrency(value, currency);
    case "number":
      return formatNumber(value, col.isCalc ? 2 : 0);
    default:
      return String(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOTALS COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute per-estimate and per-category totals from internal financeData.
 *
 * Each category stores a pre-computed `subtotal` from the API.
 * If not present, we sum `row.amount` as a fallback.
 *
 * @param {object} financeData   transformed financeData
 * @returns {{
 *   estimateTotals: Array<{ estTotal: number, catTotals: number[] }>,
 *   grandTotal: number,
 *   gstAmount: number,
 *   grandTotalWithGst: number,
 * }}
 */
export function computeTotals(financeData) {
  // Prefer the API-provided totals if available and non-zero
  const api = financeData.apiTotals || {};

  let grandTotal = 0;

  const estimateTotals = (financeData.estimates || []).map((est) => {
    let estTotal = 0;

    const catTotals = (est.categories || []).map((cat) => {
      // Use API subtotal if present, otherwise sum rows
      const catTotal =
        cat.subtotal > 0
          ? cat.subtotal
          : (cat.rows || []).reduce((sum, row) => sum + (row.amount || 0), 0);

      estTotal += catTotal;
      return catTotal;
    });

    grandTotal += estTotal;
    return { estTotal, catTotals };
  });

  // Use API grand total if provided and > 0, else use computed
  const resolvedGrand =
    api.grandTotal && api.grandTotal > 0 ? api.grandTotal : grandTotal;

  const gstPct = financeData.gstEnabled ? financeData.gstPercentage || 0 : 0;
  const gstAmount =
    api.gstAmount && api.gstAmount > 0
      ? api.gstAmount
      : Math.round((grandTotal * gstPct) / 100);

  return {
    estimateTotals,
    grandTotal,
    gstAmount,
    grandTotalWithGst: grandTotal + gstAmount,
  };
}
