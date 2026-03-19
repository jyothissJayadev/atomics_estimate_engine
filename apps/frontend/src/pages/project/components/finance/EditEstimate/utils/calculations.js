/**
 * Calculate subtotal from all categories.
 *
 * Double-count prevention:
 *   - If a row HAS children, only the parent's auto-computed total is counted
 *     (which is already the sum of its children).
 *   - Child rows are NOT summed separately.
 *   - Leaf rows (no children) contribute their own total.
 */
export const calculateSubtotal = (categories) => {
  const getRowTotal = (row) => {
    // Engine rows use 'subtotal' (sell price pre-GST)
    // Manual/legacy rows use 'total'
    // Use whichever is non-zero, preferring subtotal
    if (Number(row.subtotal) > 0) return Number(row.subtotal);
    if (Number(row.total) > 0)    return Number(row.total);
    return 0;
  };

  const sumTopLevelRows = (rows) =>
    rows.reduce((sum, row) => {
      // Parent row: its value is the rolled-up children sum — count once.
      return sum + getRowTotal(row);
    }, 0);

  return categories.reduce(
    (sum, cat) => sum + sumTopLevelRows(cat.phases || []),
    0,
  );
};

// Calculate grand total with GST
export const calculateGrandTotal = (subtotal, gstPercentage) => {
  return subtotal + (subtotal * gstPercentage) / 100;
};

// Calculate area from height and width
export const calculateArea = (height, width) => {
  return (parseFloat(height) || 0) * (parseFloat(width) || 0);
};

// Calculate total from area and rate
export const calculateTotal = (area, rate) => {
  return area * (parseFloat(rate) || 0);
};

// Calculate pricing total (rate * qty)
export const calculatePricingTotal = (rate, qty) => {
  return (parseFloat(rate) || 0) * (parseFloat(qty) || 0);
};

// Get table width from columns
export const getTableWidth = (columns) => {
  return columns.reduce((sum, col) => sum + (col.width || 100), 0);
};