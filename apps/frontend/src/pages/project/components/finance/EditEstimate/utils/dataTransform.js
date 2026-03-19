/**
 * Copy complete table (columns + rows) as JSON
 */
export const tableToClipboardJSON = (category) => {
  const data = {
    columns: category.columns.map((col) => ({
      id: col.id,
      name: col.name,
      type: col.type,
      width: col.width,
      calculated: !!col.calculated,
      link: col.link || null,
    })),

    rows: category.phases.map((phase) => {
      const row = {};
      category.columns.forEach((col) => {
        row[col.id] = phase[col.id] ?? null;
      });
      return row;
    }),
  };

  return JSON.stringify(data, null, 2);
};

/**
 * Parse pasted TSV data to phase objects
 */
/**
 * Parse pasted JSON table data (columns + rows)
 */
export const parsePastedJSONData = (pasteData, category) => {
  if (!pasteData.trim()) return { columns: null, rows: [] };

  let parsed;
  try {
    parsed = JSON.parse(pasteData);
  } catch {
    throw new Error("Invalid JSON format");
  }

  const incomingColumns = parsed.columns || [];
  const incomingRows = parsed.rows || [];

  const newRows = incomingRows.map((row, idx) => {
    const phase = { _id: `p_${Date.now()}_${idx}` };

    category.columns.forEach((col) => {
      if (col.calculated || col.type === "image") return;

      const value = row[col.id];

      if (col.type === "number" || col.type === "currency") {
        const num = parseFloat(value);
        phase[col.id] = isNaN(num) ? 0 : num;
      } else {
        phase[col.id] = value ?? "";
      }
    });

    // Derived fields
    if (phase.height && phase.width) {
      phase.square = phase.height * phase.width;
    }
    if (phase.square && phase.rate) {
      phase.total = phase.square * phase.rate;
    }

    return phase;
  });

  return {
    columns: incomingColumns,
    rows: newRows,
  };
};
