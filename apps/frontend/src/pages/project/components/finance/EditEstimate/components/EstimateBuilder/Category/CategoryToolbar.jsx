import React, { useMemo, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Table,
  Plus,
  ClipboardPaste,
} from "lucide-react";
import { ColumnTypeMenu } from "../Dialogs/ColumnTypeMenu";
import { MAX_COLUMNS } from "../../../constants";

export const CategoryToolbar = ({
  catIdx,
  category,
  currentSelection,
  applyFormat,
  copyTableData,
  setShowColumnTypeMenu,
  showColumnTypeMenu,
  addNewColumn,
  setPasteTarget,
  getTableJSON,
  setPasteData,
  setShowPasteDialog,
}) => {
  const menuRef = useRef(null);

  // ─────────────────────────────────────────────
  // Close menu when clicking outside
  // ─────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showColumnTypeMenu &&
        menuRef.current &&
        !menuRef.current.contains(event.target)
      ) {
        setShowColumnTypeMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColumnTypeMenu, setShowColumnTypeMenu]);

  // Count user columns (exclude sno)
  const userColumnCount = useMemo(() => {
    return category.columns.filter((col) => col.id !== "sno").length;
  }, [category.columns]);

  const isMaxColumnsReached = userColumnCount >= MAX_COLUMNS;

  return (
    <div className="absolute top-0 right-0 -translate-y-full w-full flex justify-end z-10">
      <div className="bg-white border-x border-t border-indigo-400 p-1.5 flex items-center gap-4 rounded-t-lg shadow-lg">
        {/* Formatting */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded px-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              applyFormat("bold");
            }}
            disabled={!currentSelection}
            className={`p-1.5 hover:bg-white rounded transition-colors ${
              currentSelection
                ? "text-slate-600 hover:text-indigo-600"
                : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <Bold size={16} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              applyFormat("italic");
            }}
            disabled={!currentSelection}
            className={`p-1.5 hover:bg-white rounded border-l border-slate-200 transition-colors ${
              currentSelection
                ? "text-slate-600 hover:text-indigo-600"
                : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <Italic size={16} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              applyFormat("underline");
            }}
            disabled={!currentSelection}
            className={`p-1.5 hover:bg-white rounded border-l border-slate-200 transition-colors ${
              currentSelection
                ? "text-slate-600 hover:text-indigo-600"
                : "text-slate-300 cursor-not-allowed"
            }`}
          >
            <Underline size={16} />
          </button>
        </div>

        {/* Copy */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            copyTableData(catIdx);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Table size={14} /> Copy Table
        </button>

        {/* Column Controls */}
        <div className="flex gap-2 border-l border-slate-200 pl-4">
          {/* Add S.No */}
          {!category.columns.some((col) => col.id === "sno") && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addNewColumn("sno", catIdx);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold text-indigo-600 hover:bg-slate-50 transition-colors"
            >
              Add S.No
            </button>
          )}

          {/* Add Field + Menu */}
          <div className="relative flex-1" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isMaxColumnsReached) {
                  setShowColumnTypeMenu(!showColumnTypeMenu);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                isMaxColumnsReached
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-indigo-600 hover:bg-slate-50"
              }`}
              disabled={isMaxColumnsReached}
            >
              <Plus size={14} /> Add Field
            </button>

            <ColumnTypeMenu
              showColumnTypeMenu={showColumnTypeMenu}
              addNewColumn={addNewColumn}
              catIdx={catIdx}
            />
          </div>

          {/* Paste */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const json = getTableJSON(catIdx);
              setPasteTarget(catIdx);
              setPasteData(json);
              setShowPasteDialog(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors"
          >
            <ClipboardPaste size={14} /> Paste
          </button>
        </div>

        {/* Counter */}
        <div className="h-4 w-px bg-slate-200" />
        <div className="text-[10px] font-bold text-slate-400 px-2 uppercase">
          {userColumnCount}/{MAX_COLUMNS} Fields
        </div>
      </div>
    </div>
  );
};
