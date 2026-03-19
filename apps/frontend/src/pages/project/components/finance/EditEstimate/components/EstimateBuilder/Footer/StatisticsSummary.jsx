import React from "react";
import { ListTree, LayoutGrid } from "lucide-react";

export const StatisticsSummary = ({ estimateData, isEditMode, viewMode }) => {
  const totalItems =
    estimateData?.categories?.reduce(
      (acc, c) => acc + (c.phases?.length || 0),
      0,
    ) || 0;

  const totalSections = estimateData?.categories?.length || 0;

  // Confidence breakdown — counts how many items have user-rated rates
  const allPhases = (estimateData?.categories || []).flatMap(c => c.phases || []);
  const highConf   = allPhases.filter(p => p.confidence === "high").length;
  const medConf    = allPhases.filter(p => p.confidence === "medium").length;
  const lowConf    = allPhases.filter(p => p.confidence === "low" || p.confidence === "none" || !p.confidence).length;
  const hasEngineData = allPhases.some(p => p.confidence && p.confidence !== "none");

  const isPreview = viewMode === "preview";

  return (
    <div className="flex flex-col gap-2">
      {/* Formal Header */}
      <h3 className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
        <span
          className={`w-6 h-[1px] transition-colors duration-500 ${
            isPreview
              ? "bg-[#f58d51]"
              : isEditMode
                ? "bg-indigo-200"
                : "bg-emerald-200"
          }`}
        ></span>
        Workbook Statistics
      </h3>

      <div
        className={`flex items-stretch bg-white border rounded shadow-sm w-fit overflow-hidden transition-colors duration-500 ${
          isPreview
            ? "border-[#f58d51]"
            : isEditMode
              ? "border-indigo-200"
              : "border-emerald-200"
        }`}
      >
        {/* Section Count */}
        <div className="px-5 py-2 flex items-center gap-3 border-r border-slate-100">
          <div
            className={`p-1.5 rounded transition-colors duration-500 ${
              isPreview
                ? "bg-orange-50 text-[#f58d51]"
                : isEditMode
                  ? "bg-indigo-50 text-indigo-400"
                  : "bg-emerald-50 text-emerald-400"
            }`}
          >
            <LayoutGrid size={14} />
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none mb-1">
              Sections
            </span>
            <span className="text-base font-black text-slate-700 leading-none">
              {totalSections}
            </span>
          </div>
        </div>

        {/* Line Item Count */}
        <div className="px-5 py-2 flex items-center gap-3">
          <div
            className={`p-1.5 rounded transition-colors duration-500 ${
              isPreview
                ? "bg-orange-50 text-[#f58d51]"
                : isEditMode
                  ? "bg-indigo-50 text-indigo-400"
                  : "bg-emerald-50 text-emerald-400"
            }`}
          >
            <ListTree size={14} />
          </div>

          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight leading-none mb-1">
              Line Items
            </span>
            <span className="text-base font-black text-slate-700 leading-none">
              {totalItems}
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="bg-slate-50 px-2.5 flex items-center border-l border-slate-100">
          <div
            className={`w-1.5 h-1.5 rounded-full animate-pulse transition-colors duration-500 ${
              isPreview
                ? "bg-[#f58d51]"
                : isEditMode
                  ? "bg-indigo-500"
                  : "bg-emerald-500"
            }`}
          ></div>
        </div>
      </div>

      {/* Confidence breakdown — only shown for AI-generated estimates */}
      {hasEngineData && (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.15em]">
            Rate confidence:
          </span>
          {highConf > 0 && (
            <span style={{ display:"inline-flex",alignItems:"center",gap:3,padding:"1px 7px",
              borderRadius:20,fontSize:10,fontWeight:600,background:"#ecfdf5",color:"#065f46",
              border:"1px solid #10b98144" }}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#10b981",flexShrink:0}}/>
              {highConf} your rates
            </span>
          )}
          {medConf > 0 && (
            <span style={{ display:"inline-flex",alignItems:"center",gap:3,padding:"1px 7px",
              borderRadius:20,fontSize:10,fontWeight:600,background:"#fffbeb",color:"#92400e",
              border:"1px solid #f59e0b44" }}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#f59e0b",flexShrink:0}}/>
              {medConf} estimated
            </span>
          )}
          {lowConf > 0 && (
            <span style={{ display:"inline-flex",alignItems:"center",gap:3,padding:"1px 7px",
              borderRadius:20,fontSize:10,fontWeight:600,background:"#f1f5f9",color:"#475569",
              border:"1px solid #94a3b844" }}>
              <span style={{width:5,height:5,borderRadius:"50%",background:"#94a3b8",flexShrink:0}}/>
              {lowConf} no rate
            </span>
          )}
        </div>
      )}
    </div>
  );
};
