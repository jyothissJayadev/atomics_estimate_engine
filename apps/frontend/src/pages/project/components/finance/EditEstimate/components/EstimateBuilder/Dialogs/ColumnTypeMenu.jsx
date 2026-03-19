import React from "react";
import { COLUMN_TYPES } from "../../../constants";

export const ColumnTypeMenu = ({
  showColumnTypeMenu,
  addNewColumn,
  catIdx,
}) => {
  if (!showColumnTypeMenu) return null;

  return (
    <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-slate-200 shadow-2xl rounded p-1 z-50 text-slate-800 animate-in zoom-in-95">
      {COLUMN_TYPES.map((type) => (
        <button
          key={type.id}
          onClick={() => addNewColumn(type.id, catIdx)}
          className="w-full text-left p-2.5 flex items-center gap-3 hover:bg-indigo-50 rounded transition-colors text-xs font-bold"
        >
          <type.icon size={14} className="text-slate-400" /> {type.name}
        </button>
      ))}
    </div>
  );
};
