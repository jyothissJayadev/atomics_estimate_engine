import React from "react";
import { formatCurrency } from "../../../utils/formatters";

export const TotalCalculation = ({
  subtotal,
  grandTotal,
  isEditMode,
  viewMode,
}) => {
  return (
    <div className="w-full flex justify-end">
      <div
        className={`min-w-[220px] bg-white border rounded shadow-sm overflow-hidden transition-colors duration-500 ${
          viewMode === "preview"
            ? "border-[#f58d51]"
            : isEditMode
              ? "border-indigo-200"
              : "border-emerald-200"
        }`}
      >
        {/* Net Amount */}
        <div className="p-2.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">
              Net Subtotal
            </span>
            <span className="text-xs font-bold text-slate-700">
              {formatCurrency(subtotal)}
            </span>
          </div>
        </div>

        {/* Total Amount */}
        <div
          className={`px-4 py-2.5 flex flex-col items-end transition-colors duration-500 ${
            viewMode === "preview"
              ? "bg-[#f58d51]"
              : isEditMode
                ? "bg-indigo-900"
                : "bg-[#107c41]"
          }`}
        >
          <span className="text-white/70 text-[8px] font-black uppercase tracking-[0.15em] leading-none mb-0.5">
            Total Amount (INR)
          </span>
          <span className="text-xl font-black text-white tracking-tight">
            {formatCurrency(grandTotal)}
          </span>
        </div>

        {/* Accent Line */}
        <div
          className={`h-1 w-full transition-colors duration-500 ${
            viewMode === "preview"
              ? "bg-[#cc6f35]"
              : isEditMode
                ? "bg-indigo-950"
                : "bg-emerald-800"
          }`}
        />
      </div>
    </div>
  );
};
