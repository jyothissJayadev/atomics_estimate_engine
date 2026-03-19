/**
 * Validate number input
 */
export const isValidNumber = (value) => {
  if (value === "") return true;
  return /^-?\d*\.?\d*$/.test(value);
};

/**
 * Validate column count
 */
export const canAddColumn = (currentColumns, maxColumns) => {
  return currentColumns < maxColumns;
};

/**
 * Validate pricing column addition (adds 3 columns)
 */
export const canAddPricingColumn = (currentColumns, maxColumns) => {
  return currentColumns + 3 <= maxColumns;
};
