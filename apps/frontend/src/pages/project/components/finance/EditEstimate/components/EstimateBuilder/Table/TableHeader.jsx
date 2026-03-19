import React, { useRef, useEffect } from "react";
import { Trash2, GripVertical } from "lucide-react";
import { BASE_FONT_SIZE, BASE_PADDING } from "../../../constants";

export const TableHeader = ({
  columns,
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
  setDragOverColumnInfo,
  handleColumnDrop,
  handleResizeStart,
  scaleFactor = 1.0,
  setSelectedCells,
  setEditingCell,
  // When true the header row becomes sticky so it stays visible while scrolling
  isCSRMode = false,
}) => {
  const fontSize = BASE_FONT_SIZE * 0.82 * scaleFactor;
  const padding = BASE_PADDING * scaleFactor;

  const activateHeader = (colId) => {
    if (!isEditMode) return;
    if (setSelectedCells) setSelectedCells(new Set());
    if (setEditingCell) setEditingCell(null);
    setEditingHeader({ catIdx, colId });
  };

  const deactivateHeader = () => setEditingHeader(null);

  return (
    <thead style={isCSRMode ? { position: "sticky", top: 0, zIndex: 10 } : {}}>
      <tr
        className="border-b-2 border-slate-300"
        style={{ background: "linear-gradient(to bottom, #f1f5f9, #e8edf3)" }}
      >
        {/* ── Leading spacer (edit mode) ───────────────────────── */}
        {isEditMode && (
          <th className="w-[40px] border-r border-slate-300 bg-slate-100/80" />
        )}

        {columns.map((col, colIdx) => {
          const isEditingThisHeader =
            editingHeader?.catIdx === catIdx && editingHeader?.colId === col.id;

          return (
            <HeaderCell
              key={col.id}
              col={col}
              colIdx={colIdx}
              catIdx={catIdx}
              isEditMode={isEditMode}
              isEditing={isEditingThisHeader}
              fontSize={fontSize}
              padding={padding}
              estimateData={estimateData}
              setEstimateData={setEstimateData}
              deleteColumn={deleteColumn}
              draggedColumnInfo={draggedColumnInfo}
              setDraggedColumnInfo={setDraggedColumnInfo}
              setDragOverColumnInfo={setDragOverColumnInfo}
              handleColumnDrop={handleColumnDrop}
              handleResizeStart={handleResizeStart}
              activateHeader={activateHeader}
              deactivateHeader={deactivateHeader}
              allColumns={columns}
              onNavigate={(direction) => {
                let nextIdx = colIdx;
                if (direction === "ArrowRight") nextIdx = colIdx + 1;
                else if (direction === "ArrowLeft") nextIdx = colIdx - 1;
                else {
                  deactivateHeader();
                  return;
                }
                if (nextIdx < 0 || nextIdx >= columns.length) {
                  deactivateHeader();
                  return;
                }
                setEditingHeader({ catIdx, colId: columns[nextIdx].id });
              }}
            />
          );
        })}

        {/* ── Trailing spacer (edit mode) ──────────────────────── */}
        {isEditMode && (
          <th className="w-[60px] border-l border-slate-300 bg-slate-100/80" />
        )}
      </tr>
    </thead>
  );
};

/* ─────────────────────────────────────────────────────────────────────────
   HeaderCell — individual <th>
──────────────────────────────────────────────────────────────────────────── */
function HeaderCell({
  col,
  colIdx,
  catIdx,
  isEditMode,
  isEditing,
  fontSize,
  padding,
  estimateData,
  setEstimateData,
  deleteColumn,
  draggedColumnInfo,
  setDraggedColumnInfo,
  setDragOverColumnInfo,
  handleColumnDrop,
  handleResizeStart,
  activateHeader,
  deactivateHeader,
  allColumns,
  onNavigate,
}) {
  const thRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const len = (col.name || "").length;
          inputRef.current.setSelectionRange(len, len);
        }
      });
    } else if (thRef.current && document.activeElement === inputRef.current) {
      thRef.current.focus({ preventScroll: true });
    }
  }, [isEditing]);

  const handleInputKeyDown = (e) => {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      onNavigate(e.key);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      onNavigate(e.shiftKey ? "ArrowLeft" : "ArrowRight");
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const input = inputRef.current;
      if (!input) return;
      const { selectionStart, selectionEnd, value } = input;
      const atStart = selectionStart === 0 && selectionEnd === 0;
      const atEnd =
        selectionStart === value.length && selectionEnd === value.length;
      if (e.key === "ArrowLeft" && atStart) {
        e.preventDefault();
        onNavigate("ArrowLeft");
      } else if (e.key === "ArrowRight" && atEnd) {
        e.preventDefault();
        onNavigate("ArrowRight");
      }
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      onNavigate(e.key);
    }
  };

  const handleThKeyDown = (e) => {
    if (!isEditMode || isEditing) return;
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      activateHeader(col.id);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      deactivateHeader();
    }
  };

  return (
    <th
      ref={thRef}
      tabIndex={isEditMode ? 0 : -1}
      style={{
        width: col.width,
        minWidth: col.width,
        maxWidth: col.width,
        padding: isEditing ? "0px" : `${padding * 1.1}px ${padding}px`,
        outline: "none",
        userSelect: "none",
      }}
      className={`
        relative group transition-colors
        border-r border-slate-300 last:border-r-0
        ${
          isEditing
            ? "bg-white z-20 ring-2 ring-inset ring-indigo-500"
            : "hover:bg-slate-200/60"
        }
      `}
      onDragOver={(e) => {
        if (!isEditMode || isEditing || !draggedColumnInfo) return;
        e.preventDefault();
        setDragOverColumnInfo({ catIdx, colIdx });
      }}
      onDrop={(e) => {
        if (!isEditMode || isEditing) return;
        e.preventDefault();
        handleColumnDrop(catIdx, colIdx);
      }}
      onClick={() => {
        if (isEditMode && !isEditing) activateHeader(col.id);
      }}
      onKeyDown={handleThKeyDown}
    >
      {/* ── Grip + delete actions ────────────────────────────── */}
      {isEditMode && !isEditing && (
        <div className="absolute top-0.5 left-0 right-0 px-1 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {!col.fixed ? (
            <div
              className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-indigo-600 transition-colors"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDraggedColumnInfo({ catIdx, colIdx });
              }}
            >
              <GripVertical size={11} />
            </div>
          ) : (
            <div />
          )}
          {!col.required && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteColumn(catIdx, col.id);
              }}
              className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}

      {/* ── Label / editable input ───────────────────────────── */}
      <div
        className={`flex items-center w-full ${isEditMode && !isEditing ? "mt-3" : "mt-0"}`}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={col.name}
            style={{
              fontSize,
              padding: `${padding * 1.1}px ${padding}px`,
              boxSizing: "border-box",
              width: "100%",
              outline: "none",
              border: "none",
              boxShadow: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
              background: "transparent",
            }}
            className="font-semibold text-slate-800 ring-0 focus:ring-0 focus:outline-none focus:border-none shadow-none"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const cats = [...estimateData.categories];
              cats[catIdx].columns[colIdx].name = e.target.value;
              setEstimateData({ ...estimateData, categories: cats });
            }}
            onBlur={deactivateHeader}
            onKeyDown={handleInputKeyDown}
          />
        ) : (
          <div
            style={{ fontSize, padding: 0 }}
            className="w-full text-left font-semibold text-slate-600 tracking-wide uppercase truncate"
          >
            {col.name}
          </div>
        )}
      </div>

      {/* ── Resize handle (edit mode only) ───────────────────── */}
      {isEditMode && !isEditing && (
        <div
          onMouseDown={(e) => handleResizeStart(e, catIdx, col.id)}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize group-hover:bg-indigo-300/60 hover:!bg-indigo-500 transition-colors z-20"
        />
      )}
    </th>
  );
}
