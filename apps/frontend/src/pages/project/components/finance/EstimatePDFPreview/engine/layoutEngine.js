/**
 * layoutEngine.js
 *
 * Deterministic pagination engine.
 *
 * HEIGHT POLICY (the only rule that matters):
 *   Row height is NEVER read from incoming data fields (no height, width,
 *   quantity, or any numeric field influences layout height).
 *
 *   Height is computed exclusively from:
 *     1. The pixel width of each text column  (from resolveColumnWidths → CSR)
 *     2. The character length of the text content in that column
 *     3. The shared typography constants (font-size, line-height, padding)
 *        that must stay in sync with TableRenderer.jsx
 *
 *   Number / currency columns are always single-line and never drive height.
 *
 * COLUMN WIDTH POLICY:
 *   widthPercent from the API is used when present and > 0.
 *   Otherwise rawWidth values are used proportionally.
 *   image-type columns are already stripped by transformApiData.
 */

import {
  BASE,
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  MARGIN_H_PX,
  PAGE_NUMBER_ZONE_PX,
} from "./measurementModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY CONSTANTS
// Must stay in sync with TableRenderer.jsx cell styles.
// ─────────────────────────────────────────────────────────────────────────────

export const TYPOGRAPHY = {
  FONT_SIZE: 9,
  LINE_HEIGHT: 1.4,
  CELL_PAD_V: 5,

  // 🔽 Slightly reduced to avoid over-estimation
  // Was 5.0
  CHAR_WIDTH: 4.8,
};

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN WIDTH RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns UNSCALED base px widths — proportional to the A4 content area.
 * Scale is NOT applied here; it is the renderer's concern only.
 */
export function resolveColumnWidths(columns) {
  const usableWidth = A4_WIDTH_PX - 2 * MARGIN_H_PX; // unscaled base px

  const hasPct = columns.some((c) => (c.widthPct || 0) > 0);

  if (hasPct) {
    const totalPct = columns.reduce((s, c) => s + (c.widthPct || 0), 0);
    const norm = totalPct > 0 ? 1 / totalPct : 1;
    return new Map(
      columns.map((c) => [c.id, usableWidth * (c.widthPct || 0) * norm]),
    );
  }

  const totalRaw = columns.reduce((s, c) => s + (c.rawWidth || 100), 0);
  return new Map(
    columns.map((c) => [c.id, usableWidth * ((c.rawWidth || 100) / totalRaw)]),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROW HEIGHT ESTIMATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All arithmetic is in UNSCALED base px.
 * colWidths must be produced by resolveColumnWidths(columns) — no scale arg.
 * Returns unscaled px height matching the engine's budget coordinate space.
 */
export function estimateRowHeight(row, columns, colWidths) {
  let maxLines = 1;

  columns.forEach((col) => {
    if (col.type !== "text") return;
    const rawVal = row.values?.[col.id];
    if (rawVal === undefined || rawVal === null || rawVal === "") return;

    const text = String(rawVal);
    const colPx = colWidths.get(col.id) || TYPOGRAPHY.FONT_SIZE * 10;
    // 4px horizontal padding each side (unscaled)
    const innerW = Math.max(colPx - 8, TYPOGRAPHY.FONT_SIZE);
    const cpl = Math.max(1, Math.floor(innerW / TYPOGRAPHY.CHAR_WIDTH));

    const lines = text.split("\n").reduce((sum, seg) => {
      return sum + Math.max(1, Math.ceil((seg.length || 1) / cpl));
    }, 0);

    maxLines = Math.max(maxLines, lines);
  });

  const textH = maxLines * TYPOGRAPHY.FONT_SIZE * TYPOGRAPHY.LINE_HEIGHT;

  // 🔽 Removed Math.ceil to avoid inflation
  const total = textH + TYPOGRAPHY.CELL_PAD_V * 2;
  console.log("Row", row.rowIndex, "Estimated height:", total);
  return Math.max(total, BASE.ROW_HEIGHT);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build paginated document layout from internal financeData.
 *
 * @param {object} financeData
 * @param {{ marginTopPx: number, marginBottomPx: number, scale: number }} config
 * @returns {Array<Array<object>>}  pages[i] = chunk descriptor array
 */
export function buildDocumentPages(financeData, config) {
  const { marginTopPx, marginBottomPx, scale } = config;

  // ── Budget is in pure BASE px (96dpi, scale=1) ───────────────────────────
  // A4_HEIGHT_PX, PAGE_NUMBER_ZONE_PX, DEFAULT_MARGIN_*_PX are all defined
  // from mm at 96dpi — they are base px, NOT scaled px.
  // marginTopPx / marginBottomPx come from DEFAULT_MARGIN_*_PX (also base px).
  // BASE.* constants are base px.
  // Therefore NO division or multiplication by scale anywhere in budget math.
  const usableHeight =
    A4_HEIGHT_PX - marginTopPx - marginBottomPx - PAGE_NUMBER_ZONE_PX;
  const CAT_H = BASE.CATEGORY_HEADER;
  const TBL_H = BASE.TABLE_HEADER;
  const EST_H = BASE.ESTIMATE_HEADER;
  const SUM_H = BASE.SUMMARY_BLOCK;
  const FOOT_H = BASE.FOOTER_LINE;
  const GAP_H = BASE.GAP;
  const PG_H = BASE.PAGE_HEADER;

  const pages = [];
  let currentPage = [];
  let remaining = usableHeight;

  function startNewPage() {
    pages.push(currentPage);
    currentPage = [];
    remaining = usableHeight;
  }

  // _height stored on each chunk is UNSCALED base px.
  // The renderer multiplies by scale when creating the slot div.
  function consume(height, chunk) {
    currentPage.push({ ...chunk, _height: height });
    remaining -= height;
  }

  // ── First page: document header ───────────────────────────────────────────
  consume(PG_H, { type: "pageHeader" });
  consume(GAP_H, { type: "gap", height: GAP_H });

  // ── Estimates ─────────────────────────────────────────────────────────────
  const estimates = financeData.estimates || [];

  estimates.forEach((estimate, estIdx) => {
    (estimate.categories || []).forEach((category, catIdx) => {
      const rows = category.rows || [];
      const columns = category.columns || [];
      // colWidths are unscaled base px — matches estimateRowHeight coordinate space
      const colWidths = resolveColumnWidths(columns);

      // Estimate header — once per estimate, before its first category
      if (catIdx === 0) {
        const firstRowH =
          rows.length > 0
            ? estimateRowHeight(rows[0], columns, colWidths)
            : BASE.ROW_HEIGHT;

        if (EST_H + GAP_H + CAT_H + TBL_H + firstRowH > remaining) {
          startNewPage();
        }
        consume(EST_H, { type: "estimateHeader", estimateIndex: estIdx });
        consume(GAP_H, { type: "gap", height: GAP_H });
      }

      // Row-by-row pagination — one flat loop, no nested loops
      let rowIndex = 0;
      let needsHeaders = true;

      while (rowIndex < rows.length) {
        const rH = estimateRowHeight(rows[rowIndex], columns, colWidths);

        if (needsHeaders) {
          if (CAT_H + TBL_H + rH > remaining) startNewPage();

          consume(CAT_H, {
            type: "categoryHeader",
            estimateIndex: estIdx,
            categoryIndex: catIdx,
            isContinued: false,
          });
          consume(TBL_H, {
            type: "tableHeader",
            estimateIndex: estIdx,
            categoryIndex: catIdx,
          });
          needsHeaders = false;
        } else if (rH > remaining + 4) startNewPage();

        consume(rH, {
          type: "tableRow",
          estimateIndex: estIdx,
          categoryIndex: catIdx,
          rowIndex,
        });
        rowIndex++;
      }

      if (GAP_H <= remaining) {
        consume(GAP_H, { type: "gap", height: GAP_H });
      }
    });
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  if (SUM_H + GAP_H > remaining) startNewPage();
  consume(GAP_H, { type: "gap", height: GAP_H });
  consume(SUM_H, { type: "summary" });

  // ── Footer notes ──────────────────────────────────────────────────────────
  const notes = financeData.footerNotes || [];
  if (notes.length > 0) {
    if (GAP_H <= remaining) consume(GAP_H, { type: "gap", height: GAP_H });
    notes.forEach((line, i) => {
      if (FOOT_H > remaining) startNewPage();
      consume(FOOT_H, { type: "footerLine", lineIndex: i, text: line });
    });
  }

  if (currentPage.length > 0) pages.push(currentPage);
  console.log("=== PAGE DEBUG ===");

  pages.forEach((page, i) => {
    const totalHeight = page.reduce(
      (sum, chunk) => sum + (chunk._height || 0),
      0,
    );
    console.log(`Page ${i + 1}`);
    console.log("Used height:", totalHeight);
    console.log("Usable height:", usableHeight);
    console.log("Remaining space:", usableHeight - totalHeight);
  });
  return pages;
}
