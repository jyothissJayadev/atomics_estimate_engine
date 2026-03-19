import React, { useState, useEffect } from "react";
import { Eye, RotateCcw, X, AlertTriangle, Check } from "lucide-react";

export const PreviewModeBanner = ({
  selectedVersion,
  onRestore,
  onExitPreview,
  estimateStatus,
  isRestoring,
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    setShowConfirm(false);
  }, [selectedVersion]);

  const handleRestoreClick = () => {
    if (!showConfirm) {
      setShowConfirm(true);
      const timer = setTimeout(() => setShowConfirm(false), 3000);
      return () => clearTimeout(timer);
    } else {
      onRestore();
      setShowConfirm(false);
    }
  };

  return (
    <div
      style={{ backgroundColor: "#f58d51" }}
      className="border-b border-black/10 px-6 py-2 flex items-center justify-between text-white sticky top-[3.5rem] z-[45] shadow-sm animate-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full backdrop-blur-sm">
          <Eye size={16} className="text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-[10px] uppercase tracking-widest text-white/90">
              Snapshot View
            </span>
            <span className="bg-black/10 border border-white/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
              v{selectedVersion?.number}.0
            </span>
          </div>
          <p className="text-[11px] text-white/90 font-medium leading-tight">
            You are viewing a historical version.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Restore Button - Glassy/Secondary Style */}
        <button
          onClick={handleRestoreClick}
          disabled={estimateStatus === "Locked" || isRestoring}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all duration-200
            ${
              showConfirm
                ? "bg-white text-[#f58d51] shadow-lg scale-95 ring-2 ring-white/50"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/30"
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
        >
          {isRestoring ? (
            <RotateCcw size={14} className="animate-spin" />
          ) : showConfirm ? (
            <Check size={14} strokeWidth={3} />
          ) : (
            <AlertTriangle size={14} className="opacity-80" />
          )}

          <span>
            {isRestoring
              ? "Restoring..."
              : showConfirm
                ? "Are you sure?"
                : "Restore Version"}
          </span>
        </button>

        {/* Exit Button - Bold Primary Focus (Dark Slate) */}
        <button
          onClick={onExitPreview}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-black active:scale-95 transition-all text-[11px] font-black shadow-xl ring-1 ring-black/20"
        >
          <X size={16} strokeWidth={3} />
          <span>EXIT PREVIEW</span>
        </button>
      </div>
    </div>
  );
};
