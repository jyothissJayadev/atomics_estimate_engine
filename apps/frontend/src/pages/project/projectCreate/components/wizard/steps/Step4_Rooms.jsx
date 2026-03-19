import React, { useState } from "react";
import { X, Plus, Search, Check, Brain, Loader2, AlertCircle } from "lucide-react";
import { getCanonicalItemsApi } from "../../../../../../../Api/projectApi";

const fINR = (v) => {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const HUES = ["#4361ee","#7c3aed","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#84cc16"];

/* ── Add Section Picker ─────────────────────────────────────────────────── */
function AddSectionPicker({ projectType, confirmedRefs, onAdd, onClose }) {
  const [query, setQuery]         = useState("");
  const [sections, setSections]   = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getCanonicalItemsApi({ level: 2, projectType, status: "active" })
      .then(res => { if (!cancelled) setSections(res.data?.items || []); })
      .catch(err => console.error("Section picker fetch error:", err))
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [projectType]);

  const confirmedSet = new Set(confirmedRefs);
  const filtered = sections.filter(s =>
    !confirmedSet.has(s.canonicalId) &&
    s.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.45)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480,
        maxHeight: "80vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Add a Section</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8,
            background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px" }}>
            <Search size={14} style={{ color: "#9ca3af", flexShrink: 0 }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search sections…"
              style={{ flex: 1, fontSize: 13, background: "transparent", border: "none", outline: "none" }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
          {filtered.length === 0
            ? <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 24 }}>No sections found</p>
            : filtered.map(s => (
              <button key={s.canonicalId} onClick={() => { onAdd(s.canonicalId, s.label); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "10px 12px", borderRadius: 10, border: "none",
                  background: "transparent", cursor: "pointer", textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f3f4f6"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#111" }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
                    {s.canonicalId}
                  </p>
                </div>
                <Plus size={14} style={{ color: "#4361ee", flexShrink: 0 }} />
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

/* ── Main Step4 ─────────────────────────────────────────────────────────── */
export default function Step4({
  projectData, toggleSection, addSection,
  isLoadingSections, engineError,
}) {
  const [showPicker, setShowPicker] = useState(false);

  const { predictedSections = [], confirmedSections = [],
    allAvailableSections = [], projectType = "" } = projectData;

  const totalBudget = Number(projectData.totalBudget) || 0;
  const allocatedTotal = predictedSections
    .filter(s => confirmedSections.includes(s.canonicalRef))
    .reduce((s, sec) => s + (sec.allocatedBudget || 0), 0);
  const confirmedCount = confirmedSections.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <style>{`@keyframes pulse3{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

      {/* Header */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)",
          textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
          Step 4 of 6 — Sections
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 8 }}>
          Confirm your sections
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
          The engine predicted these sections. Toggle to remove, or add from the canonical list.
        </p>
      </div>

      {/* Engine loading state */}
      {isLoadingSections && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          gap: 12, padding: "40px 24px", borderRadius: 16,
          background: "#f0f3ff", border: "1.5px solid #d0d9ff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={18} style={{ color: "#4361ee", animation: "spin 1s linear infinite" }} />
            <Brain size={18} style={{ color: "#4361ee" }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#4361ee", margin: 0 }}>
            AI is predicting your sections…
          </p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
            Analysing your project type, budget & area
          </p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Engine error */}
      {engineError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
          borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a" }}>
          <AlertCircle size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "#92400e", margin: 0 }}>{engineError}</p>
        </div>
      )}

      {/* Budget allocation summary */}
      {!isLoadingSections && confirmedCount > 0 && totalBudget > 0 && (
        <div style={{ padding: "18px 22px", borderRadius: 16,
          background: "var(--surface)", border: "1.5px solid var(--border)",
          boxShadow: "var(--shadow-card)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-display)",
                color: "var(--text-primary)" }}>{fINR(allocatedTotal)}</span>
              <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 6 }}>
                / {fINR(totalBudget)}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 20,
              background: "#f0fdf4", color: "#166534", border: "1px solid #a7f3d0" }}>
              {confirmedCount} section{confirmedCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 6, background: "#f1f5f9",
            overflow: "hidden", display: "flex", gap: 1 }}>
            {predictedSections.filter(s => confirmedSections.includes(s.canonicalRef) && s.allocatedBudget > 0)
              .map((s, i) => (
              <div key={s.canonicalRef} style={{
                height: "100%", background: HUES[i % HUES.length],
                width: `${(s.allocatedBudget / (totalBudget || 1)) * 100}%`,
                transition: "width 0.5s ease",
              }} title={`${s.label}: ${fINR(s.allocatedBudget)}`} />
            ))}
          </div>
        </div>
      )}

      {/* Sections list */}
      {!isLoadingSections && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.1em" }}>
              AI-Predicted Sections
            </label>
            <button onClick={() => setShowPicker(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 10, border: "1.5px dashed var(--accent-2)",
                background: "var(--accent-subtle)", color: "var(--accent-2)",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "var(--font-body)" }}>
              <Plus size={13} /> Add Section
            </button>
          </div>

          {predictedSections.length === 0 ? (
            <div style={{ padding: "32px 24px", textAlign: "center", borderRadius: 16,
              background: "var(--surface-2)", border: "1.5px dashed var(--border-2)" }}>
              <Brain size={24} style={{ color: "var(--text-faint)", marginBottom: 10 }} />
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                No predictions yet. Go back to step 3 and confirm your budget.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {predictedSections.map((sec, idx) => {
                const isOn = confirmedSections.includes(sec.canonicalRef);
                return (
                  <button key={sec.canonicalRef}
                    onClick={() => toggleSection(sec.canonicalRef)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 18px", borderRadius: 14, cursor: "pointer",
                      textAlign: "left", fontFamily: "var(--font-body)", width: "100%",
                      background: isOn ? "var(--surface)" : "var(--surface-3)",
                      border: `1.5px solid ${isOn ? (sec.userAdded ? "#10b981" : "var(--border)") : "transparent"}`,
                      opacity: isOn ? 1 : 0.45, transition: "all 0.2s",
                      boxShadow: isOn ? "var(--shadow-card)" : "none",
                    }}
                  >
                    {/* Toggle indicator */}
                    <div style={{
                      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isOn ? (sec.userAdded ? "#10b981" : HUES[idx % HUES.length]) : "var(--border)",
                      transition: "background 0.2s",
                    }}>
                      {isOn && <Check size={12} style={{ color: "#fff" }} />}
                    </div>

                    {/* Label */}
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0,
                        color: isOn ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {sec.label}
                      </p>
                      <p style={{ fontSize: 11, margin: "2px 0 0", color: "var(--text-faint)" }}>
                        {sec.canonicalRef}
                        {sec.userAdded && <span style={{ marginLeft: 6, color: "#10b981", fontWeight: 700 }}>· Added by you</span>}
                      </p>
                    </div>

                    {/* Budget pill */}
                    {isOn && sec.allocatedBudget > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px",
                        borderRadius: 20, background: "#f0f3ff", color: "#4361ee",
                        border: "1px solid #d0d9ff", flexShrink: 0 }}>
                        {fINR(sec.allocatedBudget)}
                      </span>
                    )}

                    {/* Anchor badge */}
                    {!sec.isFlexible && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: 20, background: "#fef3c7", color: "#92400e",
                        border: "1px solid #fde68a", flexShrink: 0 }}>
                        Core
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add section picker modal */}
      {showPicker && (
        <AddSectionPicker
          projectType={projectType}
          confirmedRefs={confirmedSections}
          onAdd={addSection}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
