import React, { useRef, useEffect } from "react";
import { History, Check, ChevronDown, Clock } from "lucide-react";

const Badge = ({ type, children }) => {
  const styles = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    locked: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${styles[type] || styles.archived}`}
    >
      {children}
    </span>
  );
};

export const VersionHistoryPanel = ({
  versions,
  selectedVersionId,
  viewMode,
  onSelectVersion,
  isOpen,
  onToggle,
}) => {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const selectedVersion = Array.isArray(versions)
    ? versions.find((v) => v.id === selectedVersionId)
    : null;

  if (!selectedVersion) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Excel-style Toggle Button */}
      <button
        onClick={() => onToggle(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all text-xs font-semibold shadow-sm ${
          isOpen
            ? "bg-emerald-50 border-emerald-500 text-emerald-700"
            : "bg-white border-slate-200 text-slate-600 hover:border-emerald-300"
        }`}
      >
        <History
          size={14}
          className={isOpen ? "text-emerald-600" : "text-slate-400"}
        />
        <span>V.{selectedVersion.number}</span>
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <>
          {/* Subtle Backdrop */}
          <div
            className="fixed inset-0 z-[40] bg-slate-900/5 backdrop-blur-[1px]"
            onClick={() => onToggle(false)}
          />

          {/* Dropdown - Viewport Constrained */}
          <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-[50] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-2 bg-emerald-700 text-white flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                <Clock size={12} /> Version Log
              </span>
              <span className="text-[9px] opacity-70 italic">
                Internal Use Only
              </span>
            </div>

            {/* Internal Scrollable Area */}
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
              {!Array.isArray(versions) || versions.length === 0 ? (
                <div className="p-8 text-center text-[10px] text-slate-400">
                  No revisions found.
                </div>
              ) : (
                versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      onSelectVersion(v.id);
                      onToggle(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-emerald-50/50 transition-colors flex items-center justify-between group ${
                      selectedVersionId === v.id ? "bg-emerald-50/30" : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-xs font-bold ${selectedVersionId === v.id ? "text-emerald-700" : "text-slate-700"}`}
                        >
                          v{v.number}.0
                        </span>
                        <Badge type={v.status}>{v.status}</Badge>
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {new Date(v.createdAt).toLocaleDateString()} •{" "}
                        {v.createdBy}
                      </span>
                    </div>

                    {selectedVersionId === v.id && (
                      <Check size={14} className="text-emerald-600" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer Action */}
            <div className="bg-slate-50 p-2 border-t border-slate-100">
              <button
                onClick={() => onToggle(false)}
                className="w-full py-1 text-[9px] font-bold text-slate-400 hover:text-emerald-600 uppercase tracking-tighter"
              >
                Done Viewing History
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
