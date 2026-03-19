import React, { useState, useEffect, useMemo, useCallback } from "react";
import { X, Plus, Search, Check, ChevronDown, ChevronUp,
  Brain, Loader2, AlertCircle, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { getCanonicalItemsApi } from "../../../../../../../Api/projectApi";

const fINR = (v) => {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const CONFIDENCE_STYLE = {
  high:   { label: "Your rate",  bg: "#ecfdf5", color: "#065f46", dot: "#10b981" },
  medium: { label: "Estimated",  bg: "#fffbeb", color: "#92400e", dot: "#f59e0b" },
  low:    { label: "Demo rate",  bg: "#fff7ed", color: "#9a3412", dot: "#f97316" },
  none:   null,
};

function ConfidenceDot({ confidence }) {
  const s = CONFIDENCE_STYLE[confidence];
  if (!s) return null;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"1px 7px",
      borderRadius:20, fontSize:10, fontWeight:600, background:s.bg, color:s.color,
      border:`1px solid ${s.dot}44` }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  );
}

/* ── Add Item Picker — fetches from DB API ────────────────────────────────── */
function AddItemPicker({ sectionRef, projectType, city, tier, confirmedItemRefs, onAdd, onClose }) {
  const [query, setQuery]         = useState("");
  const [items, setItems]         = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const params = { level: 3, parentId: sectionRef, status: "active" };
    if (projectType) params.projectType = projectType;
    if (tier) params.tier = tier;
    if (city) params.city = city;

    getCanonicalItemsApi(params)
      .then(res => {
        if (!cancelled) setItems(res.data?.items || []);
      })
      .catch(err => {
        if (!cancelled) setError("Could not load items from server.");
        console.error("AddItemPicker fetch error:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [sectionRef, projectType, tier, city]);

  const confirmedSet = new Set(confirmedItemRefs);
  const filtered = items.filter(i =>
    !confirmedSet.has(i.canonicalId) &&
    i.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,0.45)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:460,
        maxHeight:"75vh", display:"flex", flexDirection:"column",
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding:"16px 18px 10px", borderBottom:"1px solid #e5e7eb" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Add Item to Section</h3>
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#f9fafb",
            border:"1px solid #e5e7eb", borderRadius:10, padding:"7px 12px" }}>
            <Search size={13} style={{ color:"#9ca3af", flexShrink:0 }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search all canonical items…"
              style={{ flex:1, fontSize:13, background:"transparent", border:"none", outline:"none" }} />
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"6px 10px" }}>
          {isLoading ? (
            <div style={{ display:"flex", justifyContent:"center", padding:24 }}>
              <Loader2 size={18} style={{ color:"#4361ee", animation:"spin 1s linear infinite" }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : error ? (
            <p style={{ textAlign:"center", color:"#ef4444", fontSize:13, padding:20 }}>{error}</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign:"center", color:"#9ca3af", fontSize:13, padding:20 }}>
              {items.length === 0 ? "No items found in database for this section"
                : confirmedItemRefs.length > 0 && filtered.length === 0
                  ? "All available items already added"
                  : "No items match your search"}
            </p>
          ) : filtered.map(i => (
            <button key={i.canonicalId}
              onClick={() => { onAdd(sectionRef, i.canonicalId); onClose(); }}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                width:"100%", padding:"9px 10px", borderRadius:9, border:"none",
                background:"transparent", cursor:"pointer", textAlign:"left" }}
              onMouseEnter={e => e.currentTarget.style.background="#f3f4f6"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}
            >
              <div>
                <p style={{ fontSize:13, fontWeight:600, margin:0 }}>{i.label}</p>
                <p style={{ fontSize:11, color:"#9ca3af", margin:"1px 0 0" }}>
                  {i.unit}
                  {i.indicativeRate > 0 && ` · ~₹${i.indicativeRate.toLocaleString("en-IN")}/unit`}
                </p>
              </div>
              <Plus size={13} style={{ color:"#4361ee", flexShrink:0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tier Switcher ────────────────────────────────────────────────────────── */
function TierSwitcher({ activeTier, onChange }) {
  const tiers = [
    { id:"budget",   label:"Budget",   color:"#16a34a" },
    { id:"balanced", label:"Balanced", color:"#4361ee" },
    { id:"premium",  label:"Premium",  color:"#9333ea" },
  ];
  return (
    <div style={{ display:"flex", gap:6, padding:"4px", borderRadius:12,
      background:"var(--surface-3)", border:"1px solid var(--border)" }}>
      {tiers.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{ padding:"6px 14px", borderRadius:9, border:"none", cursor:"pointer",
            fontSize:12, fontWeight:700, transition:"all 0.2s", fontFamily:"var(--font-body)",
            background: activeTier === t.id ? "#fff" : "transparent",
            color: activeTier === t.id ? t.color : "var(--text-muted)",
            boxShadow: activeTier === t.id ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Section Block ────────────────────────────────────────────────────────── */
function SectionBlock({ section, confirmedItemRefs, projectType, city, tier,
  allAvailableItems, toggleItem, addItem, isRecalculating }) {
  const [expanded, setExpanded]   = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const predictedItems  = section.items || [];
  const confirmedSet    = new Set(confirmedItemRefs);

  // Build all item refs: predicted + user-added (from confirmedItemRefs not in prediction)
  const allItemRefs = useMemo(() => {
    const predictedRefs = new Set(predictedItems.map(i => i.canonicalRef));
    const allRefs = [...predictedRefs];
    for (const ref of confirmedItemRefs) {
      if (!predictedRefs.has(ref)) allRefs.push(ref);
    }
    return allRefs;
  }, [predictedItems, confirmedItemRefs]);

  // Build display items: predicted ones get full data, user-added get data from allAvailableItems
  const displayItems = allItemRefs.map(ref => {
    const predicted = predictedItems.find(i => i.canonicalRef === ref);
    if (predicted) return { ...predicted, isPredicted: true };
    // User-added item — look up in allAvailableItems (from DB via Level 2 response)
    const available = (allAvailableItems?.[section.canonicalRef] || []);
    const found     = available.find(i => i.canonicalRef === ref);
    return {
      canonicalRef: ref,
      label:        found?.label || ref,
      unit:         found?.unit  || "",
      subtotal: 0, finalTotal: 0,
      rateSource: "unrated", confidence: "none",
      isPredicted: false, userAdded: true,
    };
  });

  const confirmedItems  = displayItems.filter(i => confirmedSet.has(i.canonicalRef));
  const sectionSubtotal = confirmedItems.reduce((s, i) => s + (i.subtotal || 0), 0);

  return (
    <div style={{ borderRadius:16, border:"1.5px solid var(--border)",
      background:"var(--surface)", overflow:"hidden", boxShadow:"var(--shadow-card)" }}>

      {/* Section header */}
      <button onClick={() => setExpanded(e => !e)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          width:"100%", padding:"14px 18px", background:"var(--surface-2)", border:"none",
          cursor:"pointer", borderBottom: expanded ? "1px solid var(--border)" : "none",
          fontFamily:"var(--font-body)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>
            {section.label}
          </span>
          <span style={{ fontSize:11, fontWeight:600, padding:"2px 9px", borderRadius:20,
            background:"#f0f3ff", color:"#4361ee", border:"1px solid #d0d9ff" }}>
            {confirmedSet.size} items
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {isRecalculating && (
            <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:10,
              color:"#9ca3af", fontWeight:600 }}>
              <RefreshCw size={10} style={{ animation:"spin 1s linear infinite" }} />
              Recalculating…
            </span>
          )}
          {!isRecalculating && sectionSubtotal > 0 && (
            <span style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)" }}>
              {fINR(sectionSubtotal)}
            </span>
          )}
          {expanded
            ? <ChevronUp size={16} style={{ color:"var(--text-muted)" }} />
            : <ChevronDown size={16} style={{ color:"var(--text-muted)" }} />}
        </div>
      </button>

      {expanded && (
        <div style={{ padding:"12px 16px 16px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {displayItems.map(item => {
              const isOn = confirmedSet.has(item.canonicalRef);
              return (
                <div key={item.canonicalRef}
                  onClick={() => toggleItem(section.canonicalRef, item.canonicalRef)}
                  style={{ display:"flex", alignItems:"center", gap:10,
                    padding:"10px 14px", borderRadius:10, cursor:"pointer",
                    background: isOn ? "#f8faff" : "var(--surface-3)",
                    border:`1.5px solid ${isOn ? "#c7d7ff" : "transparent"}`,
                    opacity: isOn ? 1 : 0.45, transition:"all 0.15s" }}>

                  {/* Checkbox */}
                  <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: isOn ? "#4361ee" : "var(--border)",
                    border:`1.5px solid ${isOn ? "#4361ee" : "var(--border-2)"}`,
                    transition:"all 0.2s" }}>
                    {isOn && <Check size={11} style={{ color:"#fff" }} />}
                  </div>

                  {/* Label + meta */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:13, fontWeight:600, margin:0,
                      color: isOn ? "var(--text-primary)" : "var(--text-muted)",
                      whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {item.label}
                    </p>
                    {(item.unit || item.userAdded) && (
                      <p style={{ fontSize:10, color:"var(--text-faint)", margin:"1px 0 0" }}>
                        {item.unit}{item.quantity ? ` · qty ${item.quantity}` : ""}
                        {item.userAdded ? " · Added by you" : ""}
                      </p>
                    )}
                  </div>

                  {/* Confidence + cost */}
                  {isOn && item.confidence && item.confidence !== "none" && (
                    <ConfidenceDot confidence={item.confidence} />
                  )}
                  {isOn && (
                    isRecalculating
                      ? <span style={{ fontSize:12, color:"#9ca3af" }}>…</span>
                      : item.subtotal > 0
                        ? <span style={{ fontSize:13, fontWeight:700, color:"#4361ee", flexShrink:0 }}>
                            {fINR(item.subtotal)}
                          </span>
                        : null
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => setShowPicker(true)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
              marginTop:10, borderRadius:10, border:"1.5px dashed var(--accent-2)",
              background:"var(--accent-subtle)", color:"var(--accent-2)",
              fontSize:12, fontWeight:700, cursor:"pointer",
              fontFamily:"var(--font-body)", width:"100%", justifyContent:"center" }}>
            <Plus size={13} /> Add Item from Catalogue
          </button>
        </div>
      )}

      {showPicker && (
        <AddItemPicker
          sectionRef={section.canonicalRef}
          projectType={projectType}
          city={city}
          tier={tier}
          confirmedItemRefs={confirmedItemRefs}
          onAdd={addItem}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

/* ── Main Step5 ─────────────────────────────────────────────────────────── */
export default function Step5({
  projectData, toggleItem, addItem,
  isLoadingItems, isRecalculating, engineError,
}) {
  const {
    predictedItems = [], confirmedItems = {}, projectTotals = null,
    confirmedSections = [], projectType = "", allAvailableItems = {},
    city = "", totalBudget: rawBudget = "",
  } = projectData;

  const totalBudget = Number(rawBudget) || 0;

  // Infer current tier from budget/area for tier switcher
  const inferTierLocal = () => {
    const area = Number(projectData.totalArea) || 0;
    if (!area) return "balanced";
    const rate = totalBudget / area;
    if (rate < 800) return "budget";
    if (rate < 1400) return "balanced";
    return "premium";
  };
  const [activeTier, setActiveTier] = useState(inferTierLocal);

  // Live project total from confirmed items
  const liveTotal = useMemo(() => {
    return predictedItems.reduce((total, sec) => {
      const confirmedRefs = new Set(confirmedItems[sec.canonicalRef] || []);
      return total + (sec.items || [])
        .filter(i => confirmedRefs.has(i.canonicalRef))
        .reduce((s, i) => s + (i.subtotal || 0), 0);
    }, 0);
  }, [predictedItems, confirmedItems]);

  const deviation = totalBudget > 0 ? ((liveTotal - totalBudget) / totalBudget) * 100 : null;
  const isOver    = deviation !== null && deviation > 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div>
        <p style={{ fontSize:12, fontWeight:600, color:"var(--accent-2)",
          textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:8 }}>
          Step 5 of 6 — Items
        </p>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:"clamp(2rem,4vw,2.75rem)",
          fontWeight:400, color:"var(--text-primary)", lineHeight:1.1, marginBottom:8 }}>
          Confirm your items
        </h1>
        <p style={{ fontSize:15, color:"var(--text-muted)" }}>
          Toggle items on/off. Add from the full catalogue. Costs update automatically.
        </p>
      </div>

      {/* Loading */}
      {isLoadingItems && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
          gap:12, padding:"40px 24px", borderRadius:16,
          background:"#f0f3ff", border:"1.5px solid #d0d9ff" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Loader2 size={18} style={{ color:"#4361ee", animation:"spin 1s linear infinite" }} />
            <Brain size={18} style={{ color:"#4361ee" }} />
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:"#4361ee", margin:0 }}>
            AI is predicting items & costs…
          </p>
          <p style={{ fontSize:12, color:"#6b7280", margin:0 }}>
            Running rates and quantities for each section
          </p>
        </div>
      )}

      {/* Engine error */}
      {engineError && (
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 16px",
          borderRadius:12, background:"#fffbeb", border:"1px solid #fde68a" }}>
          <AlertCircle size={16} style={{ color:"#d97706", flexShrink:0, marginTop:1 }} />
          <p style={{ fontSize:13, color:"#92400e", margin:0 }}>{engineError}</p>
        </div>
      )}

      {/* Tier switcher + live total banner */}
      {!isLoadingItems && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Tier switcher */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <p style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)", margin:0 }}>
              Pricing Tier
            </p>
            <TierSwitcher activeTier={activeTier} onChange={setActiveTier} />
          </div>

          {/* Live totals */}
          {liveTotal > 0 && (
            <div style={{ padding:"18px 22px", borderRadius:16,
              background: isOver ? "#fff7ed" : "#f0fdf4",
              border:`1.5px solid ${isOver ? "#fed7aa" : "#a7f3d0"}`,
              boxShadow:"var(--shadow-card)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:"var(--text-muted)",
                    textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 4px" }}>
                    Estimated Project Total
                  </p>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <p style={{ fontSize:28, fontWeight:700, fontFamily:"var(--font-display)",
                      color: isOver ? "#9a3412" : "#166534", margin:0 }}>
                      {fINR(liveTotal)}
                    </p>
                    {isRecalculating && (
                      <RefreshCw size={14} style={{ color:"#9ca3af", animation:"spin 1s linear infinite" }} />
                    )}
                  </div>
                  {totalBudget > 0 && (
                    <p style={{ fontSize:12, color:"var(--text-muted)", margin:"4px 0 0" }}>
                      Budget: {fINR(totalBudget)}
                    </p>
                  )}
                </div>
                {deviation !== null && Math.abs(deviation) > 0.5 && (
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px",
                      borderRadius:12, background: isOver ? "#fee2e2" : "#dcfce7",
                      color: isOver ? "#dc2626" : "#16a34a" }}>
                      {isOver ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      <span style={{ fontSize:13, fontWeight:700 }}>
                        {isOver ? "+" : ""}{deviation.toFixed(1)}%
                      </span>
                    </div>
                    <p style={{ fontSize:11, color:"var(--text-muted)", margin:0 }}>
                      vs budget
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section blocks */}
      {!isLoadingItems && (
        predictedItems.length > 0 ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {predictedItems.map(section => (
              <SectionBlock
                key={section.canonicalRef}
                section={section}
                confirmedItemRefs={confirmedItems[section.canonicalRef] || []}
                projectType={projectType}
                city={city}
                tier={activeTier}
                allAvailableItems={allAvailableItems}
                toggleItem={toggleItem}
                addItem={addItem}
                isRecalculating={isRecalculating}
              />
            ))}
          </div>
        ) : confirmedSections.length > 0 ? (
          <div style={{ padding:"32px 24px", textAlign:"center", borderRadius:16,
            background:"var(--surface-2)", border:"1.5px dashed var(--border-2)" }}>
            <Brain size={24} style={{ color:"var(--text-faint)", marginBottom:10 }} />
            <p style={{ fontSize:14, color:"var(--text-muted)" }}>
              No item predictions yet — go back and confirm your sections.
            </p>
          </div>
        ) : (
          <div style={{ padding:"32px 24px", textAlign:"center", borderRadius:16,
            background:"var(--surface-2)", border:"1.5px dashed var(--border-2)" }}>
            <p style={{ fontSize:14, color:"var(--text-muted)" }}>
              Select sections in Step 4 first.
            </p>
          </div>
        )
      )}
    </div>
  );
}
