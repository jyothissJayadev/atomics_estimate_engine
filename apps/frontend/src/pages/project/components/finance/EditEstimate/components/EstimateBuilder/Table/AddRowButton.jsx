import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, X, Loader2 } from "lucide-react";
import { searchCanonicalItemsApi } from "../../../../../../../../../Api/projectApi";

/**
 * AddRowButton
 *
 * Appends a new line item to a category.
 * Shows a canonical search picker so the new row gets a canonicalRef,
 * enabling rate prediction and learning when the estimate is locked.
 * Designer can also type a free-form name if no canonical match is needed.
 */
export const AddRowButton = ({
  category,
  catIdx,
  estimateData,
  setEstimateData,
  columnsCount,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  // Infer project type from category canonicalRef prefix if available
  const inferProjectType = () => {
    const ref = category.canonicalRef || "";
    if (ref.startsWith("apt_") || ref.startsWith("kit_") || ref.startsWith("wr_") ||
        ref.startsWith("fc_")  || ref.startsWith("tv_")  || ref.startsWith("fl_") ||
        ref.startsWith("wt_")  || ref.startsWith("el_"))  return "residential_apartment";
    if (ref.startsWith("off_")) return "commercial_office";
    if (ref.startsWith("ret_")) return "retail_shop";
    if (ref.startsWith("hos_")) return "hospitality";
    if (ref.startsWith("cli_")) return "clinic_healthcare";
    if (ref.startsWith("edu_")) return "education";
    if (ref.startsWith("ind_")) return "industrial_warehouse";
    if (ref.startsWith("vl_") || ref.startsWith("villa_")) return "villa";
    return null;
  };

  useEffect(() => {
    if (!showPicker) return;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [showPicker]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = { q: query, level: 3, limit: 12 };
        const pt = inferProjectType();
        if (pt) params.projectType = pt;
        if (category.canonicalRef) params.parentId = category.canonicalRef;
        const res = await searchCanonicalItemsApi(params);
        setResults(res.data?.items || []);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const addRow = (label, canonicalId, unit, materialRate, laborRate) => {
    const newRow = {
      _id:           `p_${Date.now()}`,
      description:   label,
      canonicalRef:  canonicalId || null,
      canonicalStatus: canonicalId ? "resolved" : "unresolved",
      rateSource:    "unrated",
      confidence:    "none",
      unit:          unit || "",
      quantity:      null,
      materialRate:  materialRate || "",
      laborRate:     laborRate    || "",
      subtotal:      0,
      finalTotal:    0,
      total:         0,
      children:      [],
    };

    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.map((c) =>
        c._id === category._id
          ? { ...c, phases: [...c.phases, newRow] }
          : c
      ),
    });

    setShowPicker(false);
    setQuery("");
    setResults([]);
  };

  const handleFreeform = () => {
    if (!query.trim()) return;
    addRow(query.trim(), null, "", 0, 0);
  };

  return (
    <>
      <tr>
        <td colSpan={columnsCount} className="p-0 border-t border-slate-100">
          <button
            onClick={() => setShowPicker(true)}
            className="w-full py-4 bg-slate-50/30 hover:bg-slate-50 text-indigo-600 text-[11px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border-dashed border-t border-slate-200"
          >
            <Plus size={14} /> Append Line Item
          </button>
        </td>
      </tr>

      {showPicker && (
        <tr>
          <td colSpan={columnsCount} className="p-0">
            <div className="bg-white border border-indigo-200 shadow-lg rounded-b-lg overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Search size={14} className="text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && query.trim() && results.length === 0) handleFreeform();
                    if (e.key === "Escape") { setShowPicker(false); setQuery(""); setResults([]); }
                  }}
                  placeholder="Search canonical items, or type a name and press Enter…"
                  className="flex-1 text-xs outline-none bg-transparent text-slate-800 placeholder-slate-400"
                />
                {isSearching && <Loader2 size={12} className="animate-spin text-indigo-400" />}
                <button
                  onClick={() => { setShowPicker(false); setQuery(""); setResults([]); }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-52 overflow-y-auto">
                {results.length > 0 ? (
                  results.map(item => (
                    <button
                      key={item.canonicalId}
                      onClick={() => addRow(item.label, item.canonicalId, item.unit, item.materialRate, item.laborRate)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {item.canonicalId}
                          {item.unit && ` · ${item.unit}`}
                          {item.indicativeRate > 0 && ` · ~₹${item.indicativeRate.toLocaleString("en-IN")}/unit`}
                        </p>
                      </div>
                      <Plus size={12} className="text-indigo-400 flex-shrink-0 ml-3" />
                    </button>
                  ))
                ) : query.trim() ? (
                  <div className="px-4 py-3">
                    <p className="text-[11px] text-slate-400 mb-2">No canonical match found.</p>
                    <button
                      onClick={handleFreeform}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      <Plus size={11} /> Add "{query}" as custom item
                    </button>
                  </div>
                ) : (
                  <p className="px-4 py-3 text-[11px] text-slate-400">
                    Type to search canonical items — or type any name and press Enter.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};
