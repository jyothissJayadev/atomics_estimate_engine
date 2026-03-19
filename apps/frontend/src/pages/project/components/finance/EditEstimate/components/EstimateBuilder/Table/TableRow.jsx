import React, { useCallback, useState } from "react";
import { DragHandle } from "../Shared/DragHandle";
import { TableCell } from "./TableCell";
import { RowActionsMenu } from "../Shared/RowActionsMenu";

const CONFIDENCE_STYLES = {
  high: { label: "Your rate", bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  medium: {
    label: "Estimated",
    bg: "#fffbeb",
    color: "#92400e",
    dot: "#f59e0b",
  },
  low: { label: "Demo rate", bg: "#fff7ed", color: "#9a3412", dot: "#f97316" },
};

function ConfidenceBadge({ confidence }) {
  if (!confidence || confidence === "none" || !CONFIDENCE_STYLES[confidence])
    return null;
  const s = CONFIDENCE_STYLES[confidence];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "1px 7px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 600,
        background: s.bg,
        color: s.color,
        whiteSpace: "nowrap",
        border: `1px solid ${s.dot}44`,
        lineHeight: "18px",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.dot,
          flexShrink: 0,
        }}
      />
      {s.label}
    </span>
  );
}

export const TableRow = ({
  phase,
  pIdx,
  catIdx,
  category,
  isEditMode,
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
  estimateData,
  setEstimateData,
  scaleFactor = 1.0,
  onNavigateRow,
  snoLabel,
  // NEW props forwarded from CategoryTable
  zebraIndex,
  isCSRMode = false,
}) => {
  const [dropEdge, setDropEdge] = useState(null);

  const isBeingDragged =
    draggedItemInfo?.catIdx === catIdx && draggedItemInfo?.phaseIdx === pIdx;
  const isDragOver =
    dragOverItemInfo?.catIdx === catIdx &&
    dragOverItemInfo?.phaseIdx === pIdx &&
    !isBeingDragged;

  const isParent = phase.isParent && (phase.children?.length ?? 0) > 0;
  const isChild = phase.isChild === true;

  const nameColId = category.columns.find(
    (c) => c.id === "name" || (c.type === "text" && c.id !== "sno"),
  )?.id;

  const totalColId = category.columns.find(
    (c) =>
      c.id === "total" || (c.type === "currency" && !c.link && c.id !== "sno"),
  )?.id;

  const isParentVisibleCol = (col) =>
    col.id === "sno" || col.id === nameColId || col.id === totalColId;

  // ── Row mutations ─────────────────────────────────────────────────────────
  const addSubRow = () => {
    const newChild = {
      _id: `p_${Date.now()}`,
      name: "New Sub Item",
      total: 0,
      isChild: true,
      isParent: false,
      children: [],
    };

    const clearParentValues = (row) => {
      const cleared = { _id: row._id, name: row.name };
      category.columns.forEach((col) => {
        if (col.id === "sno" || col.id === nameColId) return;
        cleared[col.id] =
          col.type === "currency" || col.type === "number" ? 0 : "";
      });
      return cleared;
    };

    const updateRows = (rows) =>
      rows.map((row) => {
        if (row._id === phase._id) {
          return {
            ...clearParentValues(row),
            isParent: true,
            isChild: row.isChild ?? false,
            children: [...(row.children || []), newChild],
            total: 0,
          };
        }
        if (row.children?.length)
          return { ...row, children: updateRows(row.children) };
        return row;
      });

    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id ? { ...c, phases: updateRows(c.phases) } : c,
      ),
    });
  };

  const duplicateRow = () => {
    const newItem = { ...phase, _id: `p_${Date.now()}` };
    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id ? { ...c, phases: [...c.phases, newItem] } : c,
      ),
    });
  };

  const deleteRow = () => {
    const removeAndMaybeRevertParent = (rows) =>
      rows
        .map((row) => {
          if (!row.children?.length) return row;
          const newChildren = row.children.filter((c) => c._id !== phase._id);
          if (newChildren.length !== row.children.length) {
            if (newChildren.length === 0)
              return { ...row, isParent: false, children: [] };
            return { ...row, children: newChildren };
          }
          return { ...row, children: removeAndMaybeRevertParent(row.children) };
        })
        .filter((r) => r._id !== phase._id);

    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id
          ? { ...c, phases: removeAndMaybeRevertParent(c.phases) }
          : c,
      ),
    });
  };

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleNavigate = useCallback(
    (colIdx, direction) => {
      if (!direction) return;
      const cols = category.columns;
      const totalCols = cols.length;

      if (direction === "ArrowRight") {
        if (colIdx < totalCols - 1) {
          setSelectedCells(new Set([`${phase._id}_${cols[colIdx + 1].id}`]));
          setEditingCell(null);
        } else {
          if (onNavigateRow) onNavigateRow(pIdx, 0, "ArrowDown");
        }
      } else if (direction === "ArrowLeft") {
        if (colIdx > 0) {
          setSelectedCells(new Set([`${phase._id}_${cols[colIdx - 1].id}`]));
          setEditingCell(null);
        } else {
          if (onNavigateRow) onNavigateRow(pIdx, totalCols - 1, "ArrowUp");
        }
      } else if (direction === "ArrowDown") {
        if (onNavigateRow) onNavigateRow(pIdx, colIdx, "ArrowDown");
      } else if (direction === "ArrowUp") {
        if (onNavigateRow) onNavigateRow(pIdx, colIdx, "ArrowUp");
      }
    },
    [
      category.columns,
      phase._id,
      pIdx,
      setSelectedCells,
      setEditingCell,
      onNavigateRow,
    ],
  );

  // ── Drag & drop handlers ──────────────────────────────────────────────────
  const handleDragOver = (e) => {
    if (!isEditMode || !draggedItemInfo || isBeingDragged) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const edge = e.clientY < midY ? "above" : "below";
    setDropEdge(edge);
    if (
      dragOverItemInfo?.catIdx !== catIdx ||
      dragOverItemInfo?.phaseIdx !== pIdx
    ) {
      setDragOverItemInfo({ catIdx, phaseIdx: pIdx });
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDropEdge(null);
  };

  const handleDrop = (e) => {
    if (!isEditMode || !draggedItemInfo) return;
    e.preventDefault();
    e.stopPropagation();
    const insertIdx = dropEdge === "below" ? pIdx + 1 : pIdx;
    setDropEdge(null);
    handleItemDrop(catIdx, insertIdx);
  };

  const handleDragEnd = () => {
    setDraggedItemInfo(null);
    setDragOverItemInfo(null);
    setDropEdge(null);
  };

  const showLineAbove = isDragOver && dropEdge === "above";
  const showLineBelow = isDragOver && dropEdge === "below";

  return (
    <>
      {showLineAbove && (
        <tr className="pointer-events-none" aria-hidden>
          <td
            colSpan={category.columns.length + (isEditMode ? 2 : 0)}
            className="p-0 h-0"
          >
            <div className="h-[3px] bg-indigo-500 rounded-full mx-1 shadow-sm shadow-indigo-300" />
          </td>
        </tr>
      )}

      <tr
        className={`
          group relative transition-all duration-150
          ${isParent ? "bg-slate-100/80 font-semibold" : ""}
          ${isChild ? "bg-white" : ""}
          ${/* CSR: no hover; Edit: subtle hover */ isCSRMode ? "" : !isParent && !isChild ? "hover:bg-slate-50/60" : ""}
          ${isBeingDragged ? "opacity-20 scale-[0.99] blur-[0.5px]" : "opacity-100"}
          ${isDragOver ? "bg-indigo-50/40" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* ── Drag handle ─────────────────────────────────────── */}
        {isEditMode && (
          <td className="text-center border-r border-b border-slate-300 bg-slate-50/60 w-[40px]">
            {!isChild && (
              <DragHandle
                onDragStart={() => {
                  setDraggedItemInfo({ catIdx, phaseIdx: pIdx });
                  setDragOverItemInfo({ catIdx, phaseIdx: pIdx });
                }}
                onDragEnd={handleDragEnd}
                className="p-2"
              />
            )}
          </td>
        )}

        {/* ── Data cells ──────────────────────────────────────── */}

        {category.columns.map((col, colIdx) => {
          if (isParent && !isParentVisibleCol(col)) {
            return (
              <td
                key={col.id}
                style={{
                  width: `${col.width}px`,
                  minWidth: `${col.width}px`,
                  maxWidth: `${col.width}px`,
                }}
                className="border-b border-slate-200 bg-slate-100/80"
              />
            );
          }

          return (
            <td
              key={col.id}
              style={{ position: "relative", padding: 0, border: "none" }}
            >
              {colIdx === 0 &&
                !isEditMode &&
                !isChild &&
                phase.confidence &&
                phase.confidence !== "none" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: -8,
                      transform: "translateY(-50%)",
                      zIndex: 5,
                      pointerEvents: "none",
                      // offset to float over subsequent cells without affecting layout
                      marginRight: -120,
                    }}
                  >
                    <ConfidenceBadge confidence={phase.confidence} />
                  </div>
                )}
              <TableCell
                col={col}
                phase={phase}
                catIdx={catIdx}
                pIdx={pIdx}
                isEditMode={
                  isParent ? isEditMode && col.id === nameColId : isEditMode
                }
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
                scaleFactor={scaleFactor}
                onNavigate={(direction) => handleNavigate(colIdx, direction)}
                snoOverride={col.id === "sno" ? snoLabel : undefined}
                hideImage={isParent && col.type === "image"}
                isParentRow={isParent}
                isChildRow={isChild}
                isCSRMode={isCSRMode}
                zebraIndex={zebraIndex}
              />
            </td>
          );
        })}

        {/* ── Actions menu ─────────────────────────────────────── */}
        {isEditMode && (
          <td className="px-2 border-l border-b border-slate-300 bg-slate-50/60 w-[50px]">
            <RowActionsMenu
              isChild={isChild}
              onAddSub={!isChild ? addSubRow : undefined}
              onDuplicate={!isChild ? duplicateRow : undefined}
              onDelete={deleteRow}
            />
          </td>
        )}
      </tr>

      {showLineBelow && (
        <tr className="pointer-events-none" aria-hidden>
          <td
            colSpan={category.columns.length + (isEditMode ? 2 : 0)}
            className="p-0 h-0"
          >
            <div className="h-[3px] bg-indigo-500 rounded-full mx-1 shadow-sm shadow-indigo-300" />
          </td>
        </tr>
      )}

      {/* ── Child rows ──────────────────────────────────────────── */}
      {phase.children?.map((child, childIdx) => (
        <TableRow
          key={child._id}
          phase={child}
          pIdx={childIdx}
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
          scaleFactor={scaleFactor}
          onNavigateRow={onNavigateRow}
          estimateData={estimateData}
          setEstimateData={setEstimateData}
          snoLabel={`${snoLabel}.${childIdx + 1}`}
          zebraIndex={zebraIndex}
          isCSRMode={isCSRMode}
        />
      ))}
    </>
  );
};
