/**
 * measurementModel.js
 *
 * All unit constants, A4 dimensions, margin values, and base height definitions.
 * Single source of truth for the layout engine's measurement system.
 *
 * Excel-style table: ROW_HEIGHT is a minimum — rows expand with content.
 * CATEGORY_HEADER matches the sky-blue section bars from the reference image.
 */

// ─────────────────────────────────────────────────────────────────────────────
// UNIT CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

export const MM_TO_PX = 96 / 25.4; // ≈ 3.7795

// ─────────────────────────────────────────────────────────────────────────────
// A4 DIMENSIONS
// ─────────────────────────────────────────────────────────────────────────────

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX; // ≈ 793.7 px
export const A4_HEIGHT_PX = A4_HEIGHT_MM * MM_TO_PX; // ≈ 1122.5 px

// ─────────────────────────────────────────────────────────────────────────────
// MARGIN CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const MARGIN_H_MM = 15; // tighter horizontal margin for Excel-style wide table
export const MARGIN_H_PX = MARGIN_H_MM * MM_TO_PX;

export const PAGE_NUMBER_ZONE_MM = 10;
export const PAGE_NUMBER_ZONE_PX = PAGE_NUMBER_ZONE_MM * MM_TO_PX;

export const DEFAULT_MARGIN_TOP_PX = Math.round(15 * MM_TO_PX);
export const DEFAULT_MARGIN_BOTTOM_PX = Math.round(15 * MM_TO_PX);

// ─────────────────────────────────────────────────────────────────────────────
// BASE HEIGHT CONSTANTS  (all in px, before CSR scale)
// ─────────────────────────────────────────────────────────────────────────────

export const BASE = {
  ROW_HEIGHT: 22, // minimum row height in base px (content-driven above this)
  CATEGORY_HEADER: 28,
  TABLE_HEADER: 30,
  ESTIMATE_HEADER: 40,
  SUMMARY_BLOCK: 180,
  FOOTER_LINE: 18,
  GAP: 8,
  PAGE_HEADER: 64,
};

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW SCALE
// ─────────────────────────────────────────────────────────────────────────────

// Horizontal padding inside the preview shell (left + right combined)
export const PREVIEW_SHELL_PADDING_H = 48; // px

/**
 * Compute CSR scale so the A4 page fills the given container width.
 *
 * @param {number} containerWidth  actual available px width (e.g. from ResizeObserver)
 * @returns {number}               scale factor  (0 < scale ≤ 1)
 */
export function computePreviewScale(containerWidth) {
  const available =
    (containerWidth || window.innerWidth) - PREVIEW_SHELL_PADDING_H;
  return Math.min(1, available / A4_WIDTH_PX);
}
