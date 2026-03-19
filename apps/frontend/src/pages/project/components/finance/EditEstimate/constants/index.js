import { Type, Hash, ImageIcon, DollarSign, Calculator } from "lucide-react";

// ==========================================
// CONSTANT SCALE RULE (CSR) CONFIGURATION
// ==========================================

// Base measurements (at scale = 1.0)
export const BASE_FONT_SIZE = 13; // px
export const BASE_PADDING = 12; // px
export const BASE_BORDER_WIDTH = 1; // px

// A4 Page Configuration
// Used as the CSR scale target — the table is always scaled so its visual
// width matches the live container width (category card inner width).
export const A4_CONTENT_WIDTH_PX = 760; // ~170mm content width in pixels

// ── Table width limits ────────────────────────────────────────────────────────
export const MIN_COL_WIDTH = 60; // minimum individual column width (px)
export const MAX_COL_WIDTH = 940; // maximum individual column width (px)
export const MAX_TABLE_WIDTH = 1400; // ← slightly reduced from 2400
export const MAX_COLUMNS = 8;
export const A4_WIDTH_PX = 794;
// 794px ≈ 210mm at 96dpi (standard screen A4 width)
// MIN_TABLE_WIDTH is the hard floor enforced during resize.
// A table can never be dragged narrower than this.
// Set slightly smaller than A4 so very simple single-column tables
// still look reasonable while remaining close to A4 width.
export const MIN_TABLE_WIDTH = 940; // ← slightly increased from 600

// Auxiliary column widths (edit mode only — never counted in data widths)
export const DRAG_HANDLE_WIDTH = 50;
export const ACTIONS_COLUMN_WIDTH = 80;

// ==========================================
// CSR SCALE UTILITY
// ==========================================

/**
 * calculateScaleFactor
 *
 * Returns the CSS transform scale that fits `tableWidth` inside
 * `containerWidth` without a scrollbar.
 *
 * Always ∈ (0, 1] — we never scale UP.
 *
 * How the container width is determined in CSR mode:
 *   CategoryTable places a ResizeObserver on its own outermost wrapper div.
 *   That div IS the category card's inner content area, so its measured width
 *   is exactly the space the table has available on screen — i.e. the "A4
 *   space" for that category.  The result is that scaleFactor always maps the
 *   table to fill that exact space proportionally.
 *
 * @param {number} tableWidth      - sum of all column widths (px)
 * @param {number} containerWidth  - live category-card inner width from ResizeObserver (px)
 * @returns {number} scale factor ∈ (0, 1]
 */
export const calculateScaleFactor = (tableWidth, containerWidth) => {
  if (!tableWidth || !containerWidth) return 1;

  return Math.min(1, containerWidth / tableWidth);
};

// ==========================================
// COLUMN WIDTH UTILITIES
// ==========================================

export const initializeColumnPercentages = (columns) => {
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
  return columns.map((col) => ({
    ...col,
    width: col.width || 100,
    widthPercent: (col.width || 100) / totalWidth,
  }));
};

export const recalculateColumnPercentages = (columns) => {
  const totalWidth = columns.reduce((sum, col) => sum + (col.width || 100), 0);
  return columns.map((col) => ({
    ...col,
    widthPercent: (col.width || 100) / totalWidth,
  }));
};

export const getTableWidth = (columns) =>
  columns.reduce((sum, col) => sum + (col.width || 100), 0);

/**
 * getValidatedColumnWidth
 *
 * Clamps a proposed column width during resize, enforcing:
 *   1. Individual column floor  : MIN_COL_WIDTH  (60px)
 *   2. Individual column ceiling: MAX_COL_WIDTH  (500px)
 *   3. Table total ceiling      : MAX_TABLE_WIDTH (1800px)
 *   4. Table total floor        : MIN_TABLE_WIDTH (640px)
 *      Shrinking below the floor is blocked — the column cannot go
 *      narrower than whatever keeps the total at exactly MIN_TABLE_WIDTH.
 *
 * @param {Array}  columns        - all columns in the category
 * @param {string} resizingColId  - id of the column being dragged
 * @param {number} newWidth       - raw proposed width from mouse delta (px)
 * @returns {number} validated width (px)
 */
export const getValidatedColumnWidth = (columns, resizingColId, newWidth) => {
  // 1 & 2 — per-column limits
  let validWidth = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, newWidth));

  const otherColumnsWidth = columns
    .filter((c) => c.id !== resizingColId)
    .reduce((sum, col) => sum + (col.width || 100), 0);

  // 3 — table ceiling
  if (otherColumnsWidth + validWidth > MAX_TABLE_WIDTH) {
    validWidth = Math.max(MIN_COL_WIDTH, MAX_TABLE_WIDTH - otherColumnsWidth);
  }

  // 4 — table floor: block shrink below MIN_TABLE_WIDTH
  if (otherColumnsWidth + validWidth < MIN_TABLE_WIDTH) {
    validWidth = Math.max(MIN_COL_WIDTH, MIN_TABLE_WIDTH - otherColumnsWidth);
  }

  return validWidth;
};

// ==========================================
// DEFAULT SCHEMA
// ==========================================

export const DEFAULT_COLUMNS = [
  {
    id: "sno",
    name: "S.No",
    type: "number",
    fixed: true,
    width: 60,
    required: true,
  },
  {
    id: "name",
    name: "Item Description",
    type: "text",
    width: 250,
    required: true,
  },
  { id: "image", name: "Image", type: "image", width: 100 },
  { id: "height", name: "H", type: "number", width: 100 },
  { id: "width", name: "W", type: "number", width: 100 },
  { id: "square", name: "Area", type: "number", width: 100, calculated: true },
  { id: "rate", name: "Rate", type: "currency", width: 120 },
  {
    id: "total",
    name: "Amount",
    type: "currency",
    width: 140,
    calculated: true,
  },
];

export const createEmptyEstimateData = () => ({
  estimateName: "",
  projectName: "",
  clientName: "",
  date: new Date().toLocaleDateString("en-GB"),
  status: "Draft",
  type: "PhaseItem",
  includedInTotal: true,
  gst: 18,
  notes: "",
  categories: [],
});

export const COLUMN_TYPES = [
  { id: "text", name: "Text Field", icon: Type },
  { id: "number", name: "Number Field", icon: Hash },
  { id: "image", name: "Image/Ref", icon: ImageIcon },
  { id: "currency", name: "Price Field", icon: DollarSign },
  { id: "pricing", name: "Rate-Qty-Total", icon: Calculator },
];
