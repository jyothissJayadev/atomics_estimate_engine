import React from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { DragHandle } from "../Shared/DragHandle";
import { formatCurrency } from "../../../utils/formatters";

export const CategoryHeader = ({
  category,
  catIdx,
  isEditMode,
  estimateData,
  setEstimateData,
  setDraggedCatIdx,
  deleteCategory,
}) => {
  // Compute live section total from phase subtotals (engine) or totals (legacy)
  const sectionTotal = (category.phases || []).reduce((sum, phase) => {
    const v =
      Number(phase.subtotal) > 0
        ? Number(phase.subtotal)
        : Number(phase.total) > 0
          ? Number(phase.total)
          : 0;
    return sum + v;
  }, 0);
  const toggleExpanded = (e) => {
    e.stopPropagation();
    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id ? { ...c, expanded: !c.expanded } : c,
      ),
    });
  };

  const handleNameChange = (e) => {
    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id ? { ...c, name: e.target.value } : c,
      ),
    });
  };

  return (
    <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center group/cat">
      <div className="flex items-center gap-4">
        {isEditMode && (
          <DragHandle onDragStart={(e) => setDraggedCatIdx(catIdx)} />
        )}
        <button onClick={toggleExpanded}>
          {category.expanded ? (
            <ChevronDown size={20} className="text-slate-400" />
          ) : (
            <ChevronRight size={20} className="text-slate-400" />
          )}
        </button>
        {isEditMode ? (
          <input
            className="bg-white border border-slate-200 px-2 py-1 font-bold text-slate-900 uppercase tracking-wide text-sm outline-none w-64 focus:ring-2 focus:ring-indigo-100"
            value={category.name}
            onChange={handleNameChange}
          />
        ) : (
          <h2 className="font-bold text-slate-900 uppercase tracking-wide text-sm">
            {category.name}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-3">
        {sectionTotal > 0 && (
          <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full">
            {formatCurrency(sectionTotal)}
          </span>
        )}
        {isEditMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteCategory(category._id);
            }}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
