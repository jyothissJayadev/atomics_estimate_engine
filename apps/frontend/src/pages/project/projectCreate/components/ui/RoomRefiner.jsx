import React, { useState } from "react";
import { Search, X, DollarSign } from "lucide-react";
import { QUALITY_LEVELS, ITEM_CATALOG } from "../../constants/projectConfig";

/**
 * RoomRefiner
 * Lets the user set quality level, optional budget, and tagged items for a single room.
 *
 * Props:
 *  - room: { id, name, quality, budget, items }
 *  - onUpdate: (updatedRoom) => void
 */
export default function RoomRefiner({ room, onUpdate }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = ITEM_CATALOG.filter(
    (item) =>
      item.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !room.items.includes(item),
  );

  const addItem = (item) => {
    onUpdate({ ...room, items: [...room.items, item] });
    setSearchTerm("");
  };

  const removeItem = (item) => {
    onUpdate({ ...room, items: room.items.filter((i) => i !== item) });
  };

  return (
    <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm space-y-6 mb-6 last:mb-0 transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex justify-between items-start">
        <h4 className="text-xl font-bold text-slate-800">{room.name}</h4>
        <div className="relative">
          <DollarSign
            className="absolute left-3 top-2.5 text-slate-300"
            size={16}
          />
          <input
            type="number"
            placeholder="Room Budget (Optional)"
            className="pl-8 pr-4 py-2 bg-slate-50 rounded-xl text-sm border-none focus:ring-2 focus:ring-indigo-100 outline-none w-48 transition-all"
            value={room.budget || ""}
            onChange={(e) => onUpdate({ ...room, budget: e.target.value })}
          />
        </div>
      </div>

      {/* Quality Selector */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Quality Level
        </p>
        <div className="flex p-1 bg-slate-50 rounded-2xl w-full max-w-sm">
          {QUALITY_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => onUpdate({ ...room, quality: level })}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all
                ${
                  room.quality === level
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-600"
                }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Item Search & Tags */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Included Items (Optional)
        </p>

        <div className="relative">
          <Search
            className="absolute left-3 top-2.5 text-slate-300"
            size={16}
          />
          <input
            type="text"
            placeholder="Search items (e.g. Wardrobe, False Ceiling)"
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-indigo-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && filteredItems.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto">
              {filteredItems.map((item) => (
                <button
                  key={item}
                  onClick={() => addItem(item)}
                  className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm font-medium text-slate-700"
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {room.items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-100"
            >
              {item}
              <button onClick={() => removeItem(item)}>
                <X size={12} className="hover:text-red-500" />
              </button>
            </span>
          ))}
          {room.items.length === 0 && (
            <p className="text-xs text-slate-300 italic">No items added yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
