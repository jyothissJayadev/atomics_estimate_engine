/**
 * TableRenderer.jsx
 *
 * Excel-style table components — dynamic columns, content-driven height.
 *
 * HEIGHT POLICY:
 *   - No height, minHeight, or fixed sizing is applied to TableRow or its cells.
 *   - Rows are a plain flex row of cells; each cell is display:block with
 *     padding + wrapping text. The row's height is whatever the tallest cell
 *     naturally needs. The browser determines the height — not the data.
 *   - The layout engine's estimateRowHeight() pre-estimates this value using
 *     the same font-size, line-height, and padding constants (TYPOGRAPHY)
 *     to decide page breaks before rendering happens.
 *
 * CSR (Content Scale Ratio) font sizing:
 *   - Every column gets a font-size computed from its pixel width.
 *   - Wide columns (description, specification) → full base font size.
 *   - Narrow columns (S.No, qty, rate) → scaled-down font size.
 *   - This keeps text readable at every column width without overflow.
 */

import { BASE } from "../engine/measurementModel.js";
import { resolveColumnWidths, TYPOGRAPHY } from "../engine/layoutEngine.js";
import { formatCellValue } from "../engine/totals.js";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const BORDER_COLOR = "#a0a0a0";
const HEADER_BG = "#D9D9D9";
const SECTION_BG = "#BDD7EE";
const FONT = "Calibri, 'Trebuchet MS', Arial, sans-serif";

const border = (s) => `${s(0.75)}px solid ${BORDER_COLOR}`;

// ─────────────────────────────────────────────────────────────────────────────
// CSR FONT SCALER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linearly interpolate font size between minPx and basePx
 * based on the column's pixel width.
 *
 * Breakpoints are defined in UNSCALED base px and multiplied by scale,
 * so the font shrinks proportionally as the page scales down — matching
 * the same CSR behaviour as the edit-mode table's transform:scale().
 *
 * Breakpoints (empirical for Calibri at A4 scale):
 *   colPx ≤ 35 * scale  → minPx  (e.g. S.No column)
 *   colPx ≥ 220 * scale → basePx (e.g. description column)
 *
 * @param {number} colPx   column width in scaled px
 * @param {number} basePx  max font size (scaled px)
 * @param {number} minPx   min font size (scaled px)
 * @param {number} scale   current preview scale factor
 * @returns {number}       font size in px
 */
function csrFontSize(colPx, basePx, minPx, scale) {
  const LOW = 35 * scale; // scaled breakpoint
  const HIGH = 220 * scale; // scaled breakpoint
  const t = Math.min(1, Math.max(0, (colPx - LOW) / (HIGH - LOW)));
  return Math.max(minPx, basePx * t + minPx * (1 - t));
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY HEADER
// ─────────────────────────────────────────────────────────────────────────────

export function CategoryHeader({ category, isContinued, scale }) {
  const s = (v) => v * scale;

  return (
    <div
      style={{
        height: s(BASE.CATEGORY_HEADER),
        display: "flex",
        alignItems: "center",
        background: SECTION_BG,
        border: border(s),
        borderTop: "none",
        paddingLeft: s(7),
        paddingRight: s(7),
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: s(9.5),
          fontWeight: 700,
          color: "#000",
          fontFamily: FONT,
          textTransform: "uppercase",
          letterSpacing: s(0.3),
        }}
      >
        {category.name}
        {isContinued && (
          <span
            style={{
              fontWeight: 400,
              color: "#444",
              marginLeft: s(8),
              textTransform: "none",
              fontSize: s(8.5),
            }}
          >
            (continued)
          </span>
        )}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE HEADER  — dynamic columns
// ─────────────────────────────────────────────────────────────────────────────

export function TableHeader({ category, scale }) {
  const s = (v) => v * scale;
  const columns = category.columns || [];
  // resolveColumnWidths returns unscaled base px; multiply by scale for screen
  const baseWidths = resolveColumnWidths(columns);
  const colWidths = new Map([...baseWidths].map(([id, w]) => [id, w * scale]));
  const baseFontPx = s(TYPOGRAPHY.FONT_SIZE);
  const minFontPx = s(6);

  return (
    <div
      style={{
        height: s(BASE.TABLE_HEADER),

        display: "flex",
        alignItems: "stretch",
        background: HEADER_BG,
        border: border(s),
        borderTop: "none",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {columns.map((col, i) => {
        const colPx = colWidths.get(col.id) || s(60);
        const fontSize = csrFontSize(colPx, baseFontPx, minFontPx, scale);
        const isLast = i === columns.length - 1;
        const isNum = col.type === "number" || col.type === "currency";

        return (
          <div
            key={col.id}
            style={{
              width: colPx,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: isNum ? "center" : "flex-start",
              padding: `0 ${s(4)}px`,
              borderRight: isLast ? "none" : border(s),
              fontSize,
              fontWeight: 700,
              fontFamily: FONT,
              color: "#000",
              lineHeight: 1.2,
              boxSizing: "border-box",
              height: "100%",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {col.name}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE ROW  — NO fixed height anywhere
// ─────────────────────────────────────────────────────────────────────────────

export function TableRow({ row, category, currency, scale, debug }) {
  const s = (v) => v * scale;
  const columns = category.columns || [];
  const baseWidths = resolveColumnWidths(columns);
  const colWidths = new Map([...baseWidths].map(([id, w]) => [id, w * scale]));
  const baseFontPx = s(TYPOGRAPHY.FONT_SIZE);
  const minFontPx = s(6.5);

  return (
    <div
      style={{
        // NO height, NO minHeight — row grows to fit its tallest cell
        display: "flex",
        alignItems: "stretch",
        background: "#FFFFFF",
        borderLeft: border(s),
        borderRight: border(s),
        borderBottom: border(s),
        boxSizing: "border-box",
        flexShrink: 0,
        outline: debug ? "1px dashed rgba(255,100,0,0.35)" : "none",
      }}
    >
      {columns.map((col, i) => {
        const colPx = colWidths.get(col.id) || s(60);
        const fontSize = csrFontSize(colPx, baseFontPx, minFontPx, scale);
        const isLast = i === columns.length - 1;
        const isText = col.type === "text";
        const isNum = col.type === "number" || col.type === "currency";

        // S.No is a special computed column (1-based index)
        const rawVal =
          col.id === "sno"
            ? (row.rowIndex ?? 0) + 1
            : (row.values?.[col.id] ?? null);

        const displayVal =
          col.id === "sno"
            ? String(rawVal)
            : formatCellValue(rawVal, col, currency);

        return (
          <div
            key={col.id}
            style={{
              // Cell has NO height — it sizes to its content
              width: colPx,
              flexShrink: 0,
              fontSize,
              fontFamily: FONT,
              color: "#000",
              fontWeight: col.isAmount ? 700 : 400,
              textAlign: isNum ? "center" : "left",
              // Vertical padding is the ONLY vertical sizing — matches TYPOGRAPHY.CELL_PAD_V
              paddingTop: s(TYPOGRAPHY.CELL_PAD_V),
              paddingBottom: s(TYPOGRAPHY.CELL_PAD_V),
              paddingLeft: s(4),
              paddingRight: s(4),
              borderRight: isLast ? "none" : border(s),
              boxSizing: "border-box",
              lineHeight: TYPOGRAPHY.LINE_HEIGHT, // matches estimator
              // Text columns wrap freely; number/currency stay single-line
              whiteSpace: isText ? "pre-wrap" : "nowrap",
              wordBreak: isText ? "break-word" : "normal",
              overflowWrap: isText ? "break-word" : "normal",
              overflow: isText ? "visible" : "hidden",
              textOverflow: isText ? "clip" : "ellipsis",
            }}
          >
            {displayVal}
          </div>
        );
      })}
    </div>
  );
}
