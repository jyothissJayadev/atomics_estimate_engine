import React, { useRef, useEffect } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { renderFormattedText, formatCurrency } from "../../../utils/formatters";
import { BASE_FONT_SIZE, BASE_PADDING } from "../../../constants";

// ── Alignment helper ──────────────────────────────────────────────────────────
const getAlignClass = (col) => {
  if (col.id === "sno") return "text-center";
  if (col.type === "currency") return "text-right";
  if (col.type === "number") return "text-right";
  if (col.type === "formula") return "text-right";
  return "text-left";
};

export const TableCell = ({
  col,
  phase,
  catIdx,
  isEditMode,
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
  pIdx,
  scaleFactor = 1.0,
  onNavigate,
  snoOverride,
  hideImage,
  isParentRow,
  isChildRow,
  // CSR mode flag — disables hover glow, enables text wrap
  isCSRMode = false,
  // Zebra stripe index (even = tinted)
  zebraIndex,
}) => {
  const cellId = `${phase._id}_${col.id}`;
  const isSelected = selectedCells.has(cellId);
  const isEditing = editingCell === cellId;

  const scaledFontSize = BASE_FONT_SIZE * scaleFactor;
  const scaledPadding = BASE_PADDING * scaleFactor;
  const tdRef = useRef(null);

  const getImageSize = () => {
    const baseSize = 48;
    const imagePadding = scaledPadding * 4;
    const maxSize = col.width
      ? Math.min(col.width - imagePadding, 200)
      : baseSize;
    return Math.max(baseSize, Math.min(maxSize, col.width * 0.7));
  };
  const imageSize = getImageSize();

  useEffect(() => {
    if (isEditing && editInputRef?.current) {
      editInputRef.current.focus();
      const len = (phase[col.id] ?? "").toString().length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isSelected && !isEditing && tdRef.current) {
      tdRef.current.focus({ preventScroll: true });
    }
  }, [isSelected, isEditing]);

  const handleClick = (e) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setSelectedCells(new Set([cellId]));
    if (!col.calculated && col.type !== "image" && col.id !== "sno") {
      setEditingCell(cellId);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditingCell(null);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setEditingCell(null);
      if (onNavigate) onNavigate("ArrowDown");
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setEditingCell(null);
      if (onNavigate) onNavigate(e.shiftKey ? "ArrowLeft" : "ArrowRight");
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setEditingCell(null);
      if (onNavigate) onNavigate(e.key);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const input = editInputRef?.current;
      if (!input) return;
      const { selectionStart, selectionEnd, value } = input;
      const atStart = selectionStart === 0 && selectionEnd === 0;
      const atEnd =
        selectionStart === value.length && selectionEnd === value.length;
      if (e.key === "ArrowLeft" && atStart) {
        e.preventDefault();
        setEditingCell(null);
        if (onNavigate) onNavigate("ArrowLeft");
      } else if (e.key === "ArrowRight" && atEnd) {
        e.preventDefault();
        setEditingCell(null);
        if (onNavigate) onNavigate("ArrowRight");
      }
    }
  };

  const handleTdKeyDown = (e) => {
    if (!isEditMode) return;
    if (e.key === "Tab") {
      e.preventDefault();
      if (onNavigate) onNavigate(e.shiftKey ? "ArrowLeft" : "ArrowRight");
      return;
    }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      if (onNavigate) onNavigate(e.key);
      return;
    }
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (!col.calculated && col.type !== "image" && col.id !== "sno") {
        setEditingCell(cellId);
      }
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (!col.calculated && col.type !== "image" && col.id !== "sno") {
        handleCellChange(catIdx, phase._id, col.id, "", col.type);
      }
      return;
    }
    if (
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !col.calculated &&
      col.type !== "image" &&
      col.id !== "sno"
    ) {
      handleCellChange(catIdx, phase._id, col.id, "", col.type);
      setEditingCell(cellId);
    }
  };

  // ── Child row left indent for name column ─────────────────────────────────
  const nameIndentStyle =
    isChildRow && (col.id === "name" || col.type === "text")
      ? { paddingLeft: `${scaledPadding + 20}px` }
      : {};

  // ── Parent row name: uppercase + bold ─────────────────────────────────────
  const parentNameClass =
    isParentRow && (col.id === "name" || col.type === "text")
      ? "uppercase font-semibold tracking-wide text-slate-800"
      : "";

  // ── Zebra stripe background (CSR only, non-parent rows) ──────────────────
  const zebraClass =
    isCSRMode && !isParentRow && typeof zebraIndex === "number"
      ? zebraIndex % 2 === 0
        ? "bg-white"
        : "bg-slate-50"
      : "";

  // ── Hover class — suppressed in CSR ──────────────────────────────────────
  const hoverClass =
    isEditMode && !isEditing && !isSelected && !isParentRow
      ? "hover:bg-blue-50/30 cursor-default"
      : "";

  // ── Alignment ─────────────────────────────────────────────────────────────
  const alignClass = getAlignClass(col);

  return (
    <td
      ref={tdRef}
      tabIndex={isEditMode && isSelected && !isEditing ? 0 : -1}
      style={{
        width: `${col.width}px`,
        minWidth: `${col.width}px`,
        maxWidth: `${col.width}px`,
        padding: isEditing ? "0px" : `${scaledPadding}px`,
        outline: "none",
        ...nameIndentStyle,
      }}
      className={`
        relative align-middle
        border-r border-b border-slate-300 last:border-r-0
        transition-colors
        ${zebraClass}
        ${
          isEditing
            ? "bg-white z-20 ring-2 ring-inset ring-indigo-500"
            : isSelected && isEditMode
              ? "bg-blue-50 z-10 ring-2 ring-inset ring-indigo-500"
              : isParentRow
                ? "bg-slate-100/80"
                : "z-0"
        }
        ${hoverClass}
      `}
      onClick={handleClick}
      onKeyDown={!isEditing ? handleTdKeyDown : undefined}
    >
      <div
        className="w-full h-full flex items-center"
        style={{ minHeight: "32px" }}
      >
        {/* ── Serial number ──────────────────────────────────────── */}
        {col.id === "sno" ? (
          <div className="w-full text-center">
            <span
              className="text-slate-500 font-mono select-none"
              style={{ fontSize: `${scaledFontSize * 0.85}px` }}
            >
              {snoOverride ?? pIdx + 1}
            </span>
          </div>
        ) : col.type === "image" ? (
          /* ── Image column ─────────────────────────────────────── */
          hideImage ? null : (
            <div className="w-full flex justify-center">
              <div
                className="bg-slate-50 rounded border border-slate-200 relative group/img overflow-hidden flex items-center justify-center"
                style={{ width: `${imageSize}px`, height: `${imageSize}px` }}
              >
                {phase[col.id] ? (
                  <img
                    src={phase[col.id]}
                    className="w-full h-full object-cover"
                    alt="Item"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-200">
                    <ImageIcon size={imageSize * 0.33} />
                  </div>
                )}
                {isEditMode && (
                  <div
                    className="absolute inset-0 bg-indigo-600/80 opacity-0 group-hover/img:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageUpload(catIdx, phase._id, col.id);
                    }}
                  >
                    <Upload size={imageSize * 0.25} className="text-white" />
                  </div>
                )}
              </div>
            </div>
          )
        ) : isEditing ? (
          /* ── Editing input ─────────────────────────────────────── */
          <input
            ref={editInputRef}
            autoFocus
            type="text"
            inputMode={
              col.type === "number" || col.type === "currency"
                ? "decimal"
                : "text"
            }
            className={`
              w-full h-full bg-transparent
              outline-none border-none ring-0 shadow-none
              focus:outline-none focus:border-none focus:ring-0 focus:shadow-none
              p-0 m-0 text-slate-900
              ${col.type === "currency" || col.type === "number" ? "text-right font-bold" : "text-left font-medium"}
            `}
            style={{
              fontSize: `${scaledFontSize}px`,
              padding: `${scaledPadding}px`,
              boxSizing: "border-box",
              minHeight: "32px",
              WebkitAppearance: "none",
              MozAppearance: "none",
              appearance: "none",
            }}
            value={phase[col.id] ?? ""}
            onChange={(e) =>
              handleCellChange(
                catIdx,
                phase._id,
                col.id,
                e.target.value,
                col.type,
              )
            }
            onKeyDown={handleInputKeyDown}
            onSelect={handleTextSelect}
            onMouseUp={handleTextSelect}
            onKeyUp={handleTextSelect}
            onBlur={() => {
              setEditingCell(null);
              setCurrentSelection(null);
            }}
          />
        ) : (
          /* ── Read-only display ─────────────────────────────────── */
          <div className={`w-full ${alignClass}`}>
            <span
              className={`
                leading-relaxed select-none
                ${
                  /* CSR: wrap text; Edit: truncate */
                  isCSRMode
                    ? "whitespace-normal break-words block"
                    : "truncate block"
                }
                ${
                  col.type === "currency"
                    ? "font-bold text-slate-900"
                    : col.type === "number"
                      ? "font-mono text-slate-800"
                      : "text-slate-700"
                }
                ${parentNameClass}
              `}
              style={{ fontSize: `${scaledFontSize}px` }}
            >
              {(col.type === "currency" || col.type === "formula") && phase[col.id]
                ? formatCurrency(phase[col.id])
                : renderFormattedText(phase[col.id], cellId, cellFormats)}
            </span>
          </div>
        )}
      </div>
    </td>
  );
};
