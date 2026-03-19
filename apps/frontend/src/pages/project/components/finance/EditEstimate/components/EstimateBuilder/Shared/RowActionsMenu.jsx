import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Plus, Copy, Trash2 } from "lucide-react";

/**
 * RowActionsMenu
 *
 * Parent rows  → Add Sub-Item | Duplicate | Delete
 * Child rows   → Delete only
 */
export const RowActionsMenu = ({ isChild, onAddSub, onDuplicate, onDelete }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAction = (cb) => {
    setOpen(false);
    cb?.();
  };

  return (
    <div className="relative flex items-center justify-center" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`
          p-1 rounded transition-colors
          text-slate-400 hover:text-slate-700 hover:bg-slate-100
          opacity-0 group-hover:opacity-100 focus:opacity-100
          ${open ? "!opacity-100 bg-slate-100 text-slate-700" : ""}
        `}
        title="Row actions"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          className="
            absolute right-full top-1/2 -translate-y-1/2 mr-1 z-50
            bg-white border border-slate-200 rounded-lg shadow-xl
            py-1 min-w-[160px]
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Parent-only actions ─────────────────────────── */}
          {!isChild && (
            <>
              {onAddSub && (
                <button
                  onClick={() => handleAction(onAddSub)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm
                             text-slate-700 hover:bg-indigo-50 hover:text-indigo-700
                             transition-colors"
                >
                  <Plus size={14} className="text-indigo-500" />
                  Add Sub-Item
                </button>
              )}

              <button
                onClick={() => handleAction(onDuplicate)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm
                           text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Copy size={14} className="text-slate-400" />
                Duplicate
              </button>

              <div className="mx-2 my-1 border-t border-slate-100" />
            </>
          )}

          {/* ── Delete (always shown) ───────────────────────── */}
          <button
            onClick={() => handleAction(onDelete)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm
                       text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
};