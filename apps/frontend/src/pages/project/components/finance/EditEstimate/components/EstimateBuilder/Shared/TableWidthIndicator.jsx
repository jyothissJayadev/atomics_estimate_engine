import React from "react";
import { Ruler, AlertTriangle } from "lucide-react";
import { MAX_TABLE_WIDTH, A4_CONTENT_WIDTH_PX } from "../../../constants";

export const TableWidthIndicator = ({ totalWidth, isEditMode }) => {
  if (!isEditMode) return null;

  const percentage = (totalWidth / MAX_TABLE_WIDTH) * 100;
  const isNearLimit = percentage > 90;
  const isAtLimit = percentage >= 100;
  const a4Percentage = (totalWidth / A4_CONTENT_WIDTH_PX) * 100;
  const exceedsA4 = totalWidth > A4_CONTENT_WIDTH_PX;

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-2">
        <Ruler size={14} className="text-slate-400" />
        <span className="text-slate-600 font-medium">Table Width:</span>
        <span
          className={`font-bold ${
            isAtLimit
              ? "text-red-600"
              : isNearLimit
                ? "text-orange-600"
                : "text-slate-700"
          }`}
        >
          {totalWidth}px
        </span>
        <span className="text-slate-400">/ {MAX_TABLE_WIDTH}px max</span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 max-w-[200px] h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            isAtLimit
              ? "bg-red-500"
              : isNearLimit
                ? "bg-orange-500"
                : "bg-indigo-500"
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* A4 Indicator */}
      {exceedsA4 && (
        <div className="flex items-center gap-1 text-amber-600">
          <AlertTriangle size={12} />
          <span className="text-xs font-medium">
            Exceeds A4 ({a4Percentage.toFixed(0)}%)
          </span>
        </div>
      )}

      {/* Limit Warning */}
      {isAtLimit && (
        <div className="flex items-center gap-1 text-red-600">
          <AlertTriangle size={12} />
          <span className="text-xs font-bold">Max limit reached</span>
        </div>
      )}
    </div>
  );
};
