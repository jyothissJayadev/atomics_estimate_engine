import React, {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
} from "react";
import { TableHeader } from "../Table/TableHeader";
import { TableRow } from "../Table/TableRow";
import { AddRowButton } from "../Table/AddRowButton";
import {
  calculateScaleFactor,
  DRAG_HANDLE_WIDTH,
  ACTIONS_COLUMN_WIDTH,
  MIN_TABLE_WIDTH,
} from "../../../constants";
import { formatCurrency } from "../../../utils/formatters";

// ─── Recursively sum a currency column through all rows + children ────────────
const sumCurrencyCol = (phases, colId) => {
  let total = 0;
  const recurse = (rows) =>
    rows.forEach((r) => {
      const v = parseFloat(r[colId]);
      if (!isNaN(v)) total += v;
      if (r.children?.length) recurse(r.children);
    });
  recurse(phases);
  return total;
};

export const CategoryTable = ({
  category,
  catIdx,
  isEditMode,
  editingHeader,
  setEditingHeader,
  estimateData,
  setEstimateData,
  replicateColumn,
  deleteColumn,
  draggedColumnInfo,
  setDraggedColumnInfo,
  dragOverColumnInfo,
  setDragOverColumnInfo,
  handleColumnDrop,
  handleResizeStart,
  draggedItemInfo,
  setDraggedItemInfo,
  dragOverItemInfo,
  setDragOverItemInfo,
  handleItemDrop,
  selectedCells,
  setSelectedCells,
  editingCell,
  setEditingCell,
  editInputRef,
  handleCellChange,
  handleTextSelect,
  setCurrentSelection,
  handleImageUpload,
  cellFormats,
  saveToUndoStack,
}) => {
  // ── 1. Measure the exact inner content width of the container ─────────────
  //
  //  el.clientWidth excludes the border-2 (4px total) so the scale target
  //  is the true pixel budget the table has to fill — no overflow, no gap.
  //
  const outerRef = useRef(null);
  const tableRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setContainerWidth(el.clientWidth);
    measure(); // seed immediately — no flash on first render
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 2. Columns ────────────────────────────────────────────────────────────
  const structuralColumns = useMemo(() => category.columns, [category.columns]);

  // ── 3. Width + scaleFactor ────────────────────────────────────────────────
  //
  //  dataWidth   = sum of column widths, floored at MIN_TABLE_WIDTH.
  //  fullWidth   = dataWidth + edit-only auxiliary columns.
  //
  //  scaleFactor
  //    Edit mode → 1.  Full text; scroll handles overflow.
  //    CSR mode  → clientWidth / dataWidth, clamped to (0, 1].
  //                Table fills the container exactly; text shrinks with it.
  //
  const { dataWidth, fullWidth, scaleFactor } = useMemo(() => {
    const raw = structuralColumns.reduce(
      (sum, col) => sum + (col.width || 100),
      0,
    );
    const dw = Math.max(raw, MIN_TABLE_WIDTH);
    const fw = isEditMode ? dw + DRAG_HANDLE_WIDTH + ACTIONS_COLUMN_WIDTH : dw;
    const sf = isEditMode
      ? 1
      : containerWidth > 0
        ? calculateScaleFactor(dw, containerWidth)
        : 1;
    return { dataWidth: dw, fullWidth: fw, scaleFactor: sf };
  }, [structuralColumns, isEditMode, containerWidth]);

  // ── 4. Phantom-height correction ──────────────────────────────────────────
  //
  //  transform:scale() shrinks the visual but the element still occupies its
  //  original (unscaled) layout height in the document flow.
  //
  //  Fix: apply a negative marginBottom to the <table> itself equal to the
  //  space that becomes empty after scaling:
  //
  //    phantomSpace = offsetHeight × (1 − scaleFactor)
  //
  //  We use offsetHeight (pre-transform, always accurate) measured AFTER the
  //  table has fully painted via a no-dep useEffect.  This is safe because
  //  we never set a height constraint on any wrapper — so no row is ever
  //  clipped.  The outer div's overflow-hidden handles any sub-pixel overshoot.
  //
  const [marginBottom, setMarginBottom] = useState(0);

  useEffect(() => {
    if (isEditMode || !tableRef.current || scaleFactor >= 1) {
      setMarginBottom(0);
      return;
    }
    // offsetHeight is the pre-transform DOM height — reliable regardless of CSS transform
    const h = tableRef.current.offsetHeight;
    setMarginBottom(h * (1 - scaleFactor));
  }); // intentionally no deps — re-measure after every render

  // ── 5. Section subtotal ───────────────────────────────────────────────────
  const totalCol = useMemo(() => {
    const reversed = [...structuralColumns].reverse();
    return (
      reversed.find(
        (c) => c.id === "total" || (c.type === "currency" && c.calculated),
      ) ?? reversed.find((c) => c.type === "currency")
    );
  }, [structuralColumns]);

  const sectionSubtotal = useMemo(
    () => (totalCol ? sumCurrencyCol(category.phases, totalCol.id) : null),
    [category.phases, totalCol],
  );

  const subtotalLeadingCols = useMemo(() => {
    if (!totalCol) return structuralColumns.length;
    const idx = structuralColumns.findIndex((c) => c.id === totalCol.id);
    return idx >= 0 ? idx : structuralColumns.length - 1;
  }, [structuralColumns, totalCol]);

  // ── 6. Keyboard navigation ────────────────────────────────────────────────
  const flatRows = useMemo(() => {
    const result = [];
    category.phases.forEach((phase) => {
      result.push(phase);
      phase.children?.forEach((c) => result.push(c));
    });
    return result;
  }, [category.phases]);

  const handleNavigateRow = useCallback(
    (currentRowId, colIdx, direction) => {
      const currentIdx = flatRows.findIndex((r) => r._id === currentRowId);
      if (currentIdx === -1) return;
      const targetIdx =
        direction === "ArrowDown" ? currentIdx + 1 : currentIdx - 1;
      if (targetIdx < 0 || targetIdx >= flatRows.length) return;
      const targetRow = flatRows[targetIdx];
      const col =
        structuralColumns[
          Math.max(0, Math.min(colIdx, structuralColumns.length - 1))
        ];
      setSelectedCells(new Set([`${targetRow._id}_${col.id}`]));
      setEditingCell(null);
    },
    [flatRows, structuralColumns, setSelectedCells, setEditingCell],
  );

  const makeNavigateForRow = useCallback(
    (rowId) => (pIdx, colIdx, direction) =>
      handleNavigateRow(rowId, colIdx, direction),
    [handleNavigateRow],
  );

  // ── 7. Misc ───────────────────────────────────────────────────────────────
  const isEmpty = category.phases.length === 0;
  const totalColSpan = structuralColumns.length + (isEditMode ? 2 : 0);

  // ── Render ────────────────────────────────────────────────────────────────
  //
  //  Edit mode:
  //    outerRef (overflow-x-auto) → <table> at fullWidth px, no transform.
  //    Horizontal scroll for wide tables; full text size for editing.
  //
  //  CSR mode:
  //    outerRef (overflow-hidden, clientWidth measured)
  //      └─ <table> at fullWidth px
  //           transform: scale(sf) + transformOrigin: top left
  //           marginBottom: -(offsetHeight × (1−sf))   ← collapses phantom space
  //
  //  No inner wrapper div with overflow:hidden or explicit height — that was
  //  what was clipping the bottom rows and the subtotal row in CSR mode.
  //
  return (
    <div
      ref={outerRef}
      className={`w-full border-2 border-slate-300 rounded-lg shadow-sm ${
        isEditMode ? "overflow-x-auto" : "overflow-hidden flex justify-center"
      }`}
    >
      <table
        ref={tableRef}
        className="border-collapse"
        style={{
          tableLayout: "fixed",
          borderSpacing: 0,
          // Identical pixel width in both modes — column proportions always match
          width: `${fullWidth}px`,
          // CSR: scale everything (columns + text) proportionally to fit container
          ...(!isEditMode
            ? {
                transform: `scale(${scaleFactor})`,
                transformOrigin: "top center",
                ...(scaleFactor < 1 && {
                  marginBottom: `-${marginBottom}px`,
                }),
              }
            : {}),
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <TableHeader
          columns={structuralColumns}
          catIdx={catIdx}
          isEditMode={isEditMode}
          editingHeader={editingHeader}
          setEditingHeader={setEditingHeader}
          estimateData={estimateData}
          setEstimateData={setEstimateData}
          replicateColumn={replicateColumn}
          deleteColumn={deleteColumn}
          draggedColumnInfo={draggedColumnInfo}
          setDraggedColumnInfo={setDraggedColumnInfo}
          dragOverColumnInfo={dragOverColumnInfo}
          setDragOverColumnInfo={setDragOverColumnInfo}
          handleColumnDrop={handleColumnDrop}
          handleResizeStart={handleResizeStart}
          scaleFactor={scaleFactor}
          setSelectedCells={setSelectedCells}
          setEditingCell={setEditingCell}
          isCSRMode={!isEditMode}
        />

        <tbody>
          {/* ── Empty state ────────────────────────────────────── */}
          {isEmpty && (
            <tr>
              <td
                colSpan={totalColSpan}
                className="text-center text-slate-400 py-10 text-sm italic select-none"
              >
                No items added yet
              </td>
            </tr>
          )}

          {/* ── Data rows ──────────────────────────────────────── */}
          {category.phases.map((phase, pIdx) => (
            <TableRow
              key={phase._id}
              phase={phase}
              pIdx={pIdx}
              catIdx={catIdx}
              category={category}
              isEditMode={isEditMode}
              draggedItemInfo={draggedItemInfo}
              setDraggedItemInfo={setDraggedItemInfo}
              dragOverItemInfo={dragOverItemInfo}
              setDragOverItemInfo={setDragOverItemInfo}
              handleItemDrop={handleItemDrop}
              selectedCells={selectedCells}
              setSelectedCells={setSelectedCells}
              editingCell={editingCell}
              setEditingCell={setEditingCell}
              editInputRef={editInputRef}
              handleCellChange={handleCellChange}
              handleTextSelect={handleTextSelect}
              setCurrentSelection={setCurrentSelection}
              handleImageUpload={handleImageUpload}
              cellFormats={cellFormats}
              saveToUndoStack={saveToUndoStack}
              estimateData={estimateData}
              setEstimateData={setEstimateData}
              scaleFactor={scaleFactor}
              onNavigateRow={makeNavigateForRow(phase._id)}
              snoLabel={String(pIdx + 1)}
              zebraIndex={pIdx}
              isCSRMode={!isEditMode}
            />
          ))}

          {/* ── Add row (edit only) ────────────────────────────── */}
          {isEditMode && (
            <AddRowButton
              category={category}
              catIdx={catIdx}
              estimateData={estimateData}
              setEstimateData={setEstimateData}
              saveToUndoStack={saveToUndoStack}
              columnsCount={structuralColumns.length + 2}
            />
          )}

          {/* ── Section subtotal ───────────────────────────────── */}
          {!isEmpty && sectionSubtotal !== null && (
            <tr className="bg-slate-100 border-t-2 border-slate-300">
              {isEditMode && (
                <td
                  style={{ width: DRAG_HANDLE_WIDTH }}
                  className="border-r border-slate-200 bg-slate-100"
                />
              )}
              <td
                colSpan={subtotalLeadingCols}
                className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase tracking-widest select-none"
              >
                Section Total
              </td>
              <td className="px-3 py-2 text-right font-black text-slate-800 text-sm border-l border-slate-200">
                {formatCurrency(sectionSubtotal)}
              </td>
              {structuralColumns.length - subtotalLeadingCols - 1 > 0 && (
                <td
                  colSpan={structuralColumns.length - subtotalLeadingCols - 1}
                  className="bg-slate-100 border-l border-slate-200"
                />
              )}
              {isEditMode && (
                <td
                  style={{ width: ACTIONS_COLUMN_WIDTH }}
                  className="border-l border-slate-200 bg-slate-100"
                />
              )}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
