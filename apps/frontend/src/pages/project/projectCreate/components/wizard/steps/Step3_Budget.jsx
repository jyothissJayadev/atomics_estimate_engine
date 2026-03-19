import React, { useState, useEffect, useRef } from "react";
import { FLEXIBILITY_OPTIONS, getBudgetPositioning } from "../../../constants/projectConfig";

function fINR(v) {
  const n = Number(v);
  if (!n) return "";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const STRICTNESS = [
  { id: "Strict", label: "Strict", desc: "Hard ceiling — no overrun" },
  { id: "Moderate", label: "Moderate", desc: "Allow a small buffer" },
  { id: "Flexible", label: "Flexible", desc: "Quality over cost" },
];

const BUDGET_MARKS = [
  { l: "Under", p: 8 }, { l: "Budget", p: 28 }, { l: "Market", p: 52 },
  { l: "Premium", p: 74 }, { l: "Luxury", p: 92 },
];

function ThinkDots({ on, label }) {
  if (!on) return null;
  return (
    <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 12,
      background: "linear-gradient(135deg,#eef2ff,#f0fdf4)",
      border: "1px solid var(--accent-border)" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%",
            background: "var(--accent-2)",
            animation: "pulse3 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--accent-2)" }}>{label}</span>
    </div>
  );
}

function BudgetGauge({ budget, area, tier }) {
  const pos = getBudgetPositioning(budget, area, tier);
  if (!pos) return null;
  const psf = area > 0 ? Math.round(Number(budget) / Number(area)) : 0;
  return (
    <div className="fade-up" style={{ padding: "20px 24px", borderRadius: 16,
      background: "var(--surface)", border: "1.5px solid var(--border)",
      boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: pos.color, animation: "pulse3 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: pos.color,
            fontFamily: "var(--font-display)" }}>{pos.label}</span>
        </div>
        {psf > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>₹{psf}/ft²</span>
        )}
      </div>
      {/* Gradient track */}
      <div style={{ position: "relative", height: 28, display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%", height: 6, borderRadius: 6,
          background: "linear-gradient(to right,#ef4444 0%,#f59e0b 22%,#10b981 48%,#4361ee 72%,#7c3aed 100%)" }} />
        <div style={{
          position: "absolute", left: `calc(${pos.pct}% - 10px)`,
          width: 20, height: 20, borderRadius: "50%",
          background: "var(--surface)", border: `3px solid ${pos.color}`,
          boxShadow: `0 2px 10px ${pos.color}55`,
          transition: "left 0.8s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {BUDGET_MARKS.map((m, i) => (
          <span key={i} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: Math.abs((pos.pct || 0) - m.p) < 16 ? pos.color : "var(--text-faint)",
            transition: "color 0.3s" }}>{m.l}</span>
        ))}
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: pos.color, fontWeight: 500 }}>
        {pos.label === "Under Budget"
          ? "⚠ May fall short — consider increasing budget."
          : pos.label === "Budget Tier"
          ? "💡 Workable — keep a buffer for surprises."
          : "✓ Budget is well-matched to scope and location."}
      </p>
    </div>
  );
}

export default function Step3({ projectData, setProjectData }) {
  const [showTier, setShowTier] = useState(false);
  const [showFlex, setShowFlex] = useState(false);
  const [thinking, setThinking] = useState(false);
  const db = useRef(null);

  useEffect(() => {
    if (Number(projectData.totalBudget) > 0) {
      clearTimeout(db.current);
      setShowTier(false); setThinking(true);
      db.current = setTimeout(() => { setThinking(false); setShowTier(true); }, 700);
      return () => clearTimeout(db.current);
    } else { setShowTier(false); setThinking(false); }
  }, [projectData.totalBudget]);

  useEffect(() => {
    if (projectData.budgetTier === "Moderate") {
      setTimeout(() => setShowFlex(true), 200);
    } else { setShowFlex(false); }
  }, [projectData.budgetTier]);

  const maxSpend = projectData.budgetTier === "Moderate" && projectData.flexibilityPercent
    ? Number(projectData.totalBudget) * (1 + Number(projectData.flexibilityPercent) / 100)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)",
          textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
          Step 3 of 6 — Budget
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 8 }}>
          What's the target budget?
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
          We'll build a smart allocation model around this.
        </p>
      </div>

      {/* Budget input — large, prominent */}
      <div>
        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          Total project budget *
        </label>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "var(--accent-2)",
            fontFamily: "var(--font-display)", lineHeight: 1, paddingBottom: 10 }}>₹</span>
          <input
            autoFocus type="number" placeholder="25,00,000"
            value={projectData.totalBudget}
            onChange={(e) => setProjectData((p) => ({ ...p, totalBudget: e.target.value }))}
            style={{ flex: 1, fontSize: 36, fontWeight: 700,
              fontFamily: "var(--font-display)",
              background: "transparent", border: "none",
              borderBottom: "2px solid var(--border)", outline: "none",
              paddingBottom: 10, color: "var(--text-primary)", transition: "border-color 0.2s" }}
            onFocus={(e) => (e.target.style.borderBottomColor = "var(--accent-2)")}
            onBlur={(e) => (e.target.style.borderBottomColor = "var(--border)")}
          />
        </div>
        {projectData.totalBudget && (
          <p className="fade-up" style={{ fontSize: 18, fontWeight: 600,
            color: "var(--text-muted)", marginTop: 8,
            fontFamily: "var(--font-display)" }}>
            {fINR(projectData.totalBudget)}
          </p>
        )}
      </div>

      <ThinkDots on={thinking} label="Computing budget positioning…" />

      {showTier && (
        <>
          <BudgetGauge
            budget={projectData.totalBudget}
            area={projectData.totalArea}
            tier={projectData.localityTier}
          />

          <div className="fade-up">
            <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
              textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
              Budget flexibility *
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {STRICTNESS.map((s, i) => {
                const sel = projectData.budgetTier === s.id;
                return (
                  <button key={s.id} className="fade-up"
                    style={{ animationDelay: `${i * 50}ms`,
                      padding: "18px 16px", borderRadius: 14, cursor: "pointer",
                      textAlign: "center", fontFamily: "var(--font-body)",
                      background: sel ? "var(--accent-subtle)" : "var(--surface)",
                      border: `1.5px solid ${sel ? "var(--accent-2)" : "var(--border)"}`,
                      boxShadow: sel ? "0 0 0 1px var(--accent-2)" : "var(--shadow-card)",
                      transition: "all 0.18s" }}
                    onClick={() => setProjectData((p) => ({
                      ...p, budgetTier: s.id,
                      flexibilityPercent: s.id !== "Moderate" ? "" : p.flexibilityPercent,
                    }))}
                  >
                    <p style={{ fontSize: 14, fontWeight: 700,
                      color: sel ? "var(--accent-2)" : "var(--text-primary)",
                      fontFamily: "var(--font-display)", marginBottom: 4 }}>{s.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{s.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {showFlex && (
            <div className="fade-up">
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                Allowed buffer *
              </label>
              <div style={{ display: "flex", padding: 4, borderRadius: 24,
                background: "var(--surface-3)", gap: 4 }}>
                {FLEXIBILITY_OPTIONS.map((opt) => {
                  const sel = projectData.flexibilityPercent === opt.id;
                  return (
                    <button key={opt.id}
                      onClick={() => setProjectData((p) => ({ ...p, flexibilityPercent: opt.id }))}
                      style={{ flex: 1, padding: "10px 4px", borderRadius: 20,
                        fontSize: 13, fontWeight: 700, cursor: "pointer",
                        fontFamily: "var(--font-body)", border: "none",
                        background: sel ? "var(--surface)" : "transparent",
                        color: sel ? "var(--accent-2)" : "var(--text-muted)",
                        boxShadow: sel ? "0 1px 6px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.18s" }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {maxSpend && (
                <p className="fade-up" style={{ fontSize: 12, color: "var(--accent-2)",
                  fontWeight: 600, marginTop: 10 }}>
                  💡 Max spend: {fINR(maxSpend)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
