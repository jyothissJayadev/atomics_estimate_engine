import React, { useState, useMemo, useRef, useEffect } from "react";
import { LOCALITY_TIERS, INTERIOR_TYPES, LOCATION_OPTIONS } from "../../../constants/projectConfig";

const FL = ({ children }) => (
  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
    {children}
  </label>
);

const TIER_INSIGHTS = {
  Premium: "High-end locality — factor in ~30% cost uplift.",
  "Mid-Market": "Balanced quality-to-cost ratio across most zones.",
  Budget: "Smart value engineering recommended.",
};

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

function Hint({ children }) {
  return (
    <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 12,
      background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
      <span style={{ color: "var(--accent-2)", fontSize: 12 }}>✦</span>
      <span style={{ fontSize: 12, color: "var(--accent-2)", fontWeight: 500 }}>{children}</span>
    </div>
  );
}

export default function Step2({ projectData, setProjectData }) {
  const [showDrop, setShowDrop] = useState(false);
  const [hlIdx, setHlIdx] = useState(0);
  const [showTier, setShowTier] = useState(false);
  const [showArea, setShowArea] = useState(false);
  const [showInterior, setShowInterior] = useState(false);
  const [thinkTier, setThinkTier] = useState(false);
  const dropRef = useRef(null);

  const tierIdx = LOCALITY_TIERS.findIndex((t) => t.id === projectData.localityTier);
  const safeTierIdx = tierIdx === -1 ? 0 : tierIdx;

  const filtered = useMemo(() => {
    if (!projectData.city) return LOCATION_OPTIONS.slice(0, 8);
    return LOCATION_OPTIONS.filter((o) =>
      o.label.toLowerCase().includes(projectData.city.toLowerCase())
    ).slice(0, 8);
  }, [projectData.city]);

  useEffect(() => {
    if ((projectData.city || "").length > 1) {
      setTimeout(() => setShowTier(true), 100);
    } else { setShowTier(false); }
  }, [projectData.city]);

  useEffect(() => {
    if (projectData.localityTier) {
      setThinkTier(true); setShowArea(false); setShowInterior(false);
      const t1 = setTimeout(() => { setThinkTier(false); setShowArea(true); }, 600);
      const t2 = setTimeout(() => setShowInterior(true), 800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else { setShowArea(false); setShowInterior(false); }
  }, [projectData.localityTier]);

  useEffect(() => {
    const h = (e) => { if (!dropRef.current?.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleKeyDown = (e) => {
    if (!showDrop) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHlIdx((p) => Math.min(p + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHlIdx((p) => Math.max(p - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); if (filtered[hlIdx]) { setProjectData((p) => ({ ...p, city: filtered[hlIdx].label })); setShowDrop(false); } }
    if (e.key === "Escape") setShowDrop(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>
      {/* Header */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)",
          textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
          Step 2 of 6 — Location & Scope
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 8 }}>
          Where is this project?
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
          Location shapes the entire cost model.
        </p>
      </div>

      {/* Two columns: location left, tier right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        {/* City search */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <FL>City / Locality *</FL>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 0, top: 3, fontSize: 16, pointerEvents: "none" }}>📍</span>
            <input
              autoFocus type="text"
              placeholder="Search city or locality…"
              value={projectData.city}
              onChange={(e) => { setProjectData((p) => ({ ...p, city: e.target.value })); setShowDrop(true); setHlIdx(0); }}
              onFocus={() => setShowDrop(true)}
              onKeyDown={handleKeyDown}
              style={{ width: "100%", fontSize: 18, fontWeight: 600,
                fontFamily: "var(--font-body)",
                background: "transparent", border: "none",
                borderBottom: "2px solid var(--border)", outline: "none",
                paddingBottom: 10, paddingLeft: 24,
                color: "var(--text-primary)", transition: "border-color 0.2s" }}
              onFocus2={(e) => (e.target.style.borderBottomColor = "var(--accent-2)")}
              onBlur={(e) => (e.target.style.borderBottomColor = "var(--border)")}
            />
          </div>
          {showDrop && filtered.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 14, boxShadow: "var(--shadow-float)",
              zIndex: 50, overflow: "hidden" }}>
              {filtered.map((opt, i) => (
                <button key={opt.id}
                  onMouseDown={() => { setProjectData((p) => ({ ...p, city: opt.label })); setShowDrop(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left",
                    padding: "10px 16px", fontSize: 13, fontWeight: 500,
                    color: i === hlIdx ? "var(--accent-2)" : "var(--text-secondary)",
                    background: i === hlIdx ? "var(--accent-subtle)" : "transparent",
                    border: "none", cursor: "pointer", fontFamily: "var(--font-body)",
                    transition: "background 0.1s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-subtle)"; e.currentTarget.style.color = "var(--accent-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = i === hlIdx ? "var(--accent-subtle)" : "transparent"; e.currentTarget.style.color = i === hlIdx ? "var(--accent-2)" : "var(--text-secondary)"; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Locality Tier */}
        {showTier && (
          <div className="fade-up">
            <FL>Locality tier *</FL>
            <div style={{ display: "flex", background: "var(--surface-3)",
              borderRadius: 24, padding: 4, gap: 3, height: 46 }}>
              {/* Animated pill */}
              <div style={{ position: "relative", display: "flex", flex: 1 }}>
                <div style={{
                  position: "absolute", top: 0, bottom: 0, borderRadius: 20,
                  background: "var(--accent)", boxShadow: "0 2px 10px rgba(26,26,46,0.25)",
                  width: "calc(33.33% - 2px)",
                  left: `calc(${safeTierIdx * 33.33}% + 1px)`,
                  transition: "left 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                }} />
                {LOCALITY_TIERS.map((tier, i) => {
                  const active = safeTierIdx === i;
                  return (
                    <button key={tier.id}
                      onClick={() => setProjectData((p) => ({ ...p, localityTier: tier.id }))}
                      style={{ flex: 1, position: "relative", zIndex: 1,
                        background: "transparent", border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 700,
                        color: active ? "#fff" : "var(--text-muted)",
                        fontFamily: "var(--font-body)", transition: "color 0.2s" }}>
                      {tier.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {projectData.localityTier && !thinkTier && TIER_INSIGHTS[projectData.localityTier] && (
              <div style={{ marginTop: 10 }}>
                <Hint>{TIER_INSIGHTS[projectData.localityTier]}</Hint>
              </div>
            )}
          </div>
        )}
      </div>

      <ThinkDots on={thinkTier} label="Calculating area model…" />

      {/* Area + Interior side by side */}
      {showArea && (
        <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          {/* Total area */}
          <div>
            <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />
            <FL>Total carpet area *</FL>
            <div style={{ display: "flex", alignItems: "center",
              padding: "16px 20px", borderRadius: 16,
              background: "var(--surface)", border: "1.5px solid var(--border)",
              boxShadow: "var(--shadow-card)" }}>
              <input
                type="number" placeholder="1200"
                value={projectData.totalArea || ""}
                onChange={(e) => setProjectData((p) => ({ ...p, totalArea: e.target.value }))}
                style={{ flex: 1, fontSize: 28, fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  background: "transparent", border: "none", outline: "none",
                  color: "var(--text-primary)", width: "100%" }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                sq ft
              </span>
            </div>
            {Number(projectData.totalArea) > 0 && (
              <p className="fade-up" style={{ fontSize: 11, color: "var(--accent-2)",
                fontWeight: 600, marginTop: 8 }}>
                ≈ {Math.round(Number(projectData.totalArea) * 0.85)}–{Math.round(Number(projectData.totalArea) * 1.1)} ft² effective
              </p>
            )}
          </div>

          {/* Spacer (interior type below) */}
          <div />
        </div>
      )}

      {/* Interior Type - full width */}
      {showInterior && (
        <div className="fade-up">
          <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />
          <FL>Interior type / scope *</FL>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {INTERIOR_TYPES.map((type, i) => {
              const sel = projectData.interiorType === type.id;
              return (
                <button key={type.id} className="fade-up"
                  style={{ animationDelay: `${i * 40}ms`,
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "14px 16px", borderRadius: 14, cursor: "pointer",
                    textAlign: "left", fontFamily: "var(--font-body)",
                    background: sel ? "var(--accent-subtle)" : "var(--surface)",
                    border: `1.5px solid ${sel ? "var(--accent-2)" : "var(--border)"}`,
                    boxShadow: sel ? "0 0 0 1px var(--accent-2)" : "var(--shadow-card)",
                    transition: "all 0.18s" }}
                  onClick={() => setProjectData((p) => ({ ...p, interiorType: type.id }))}
                >
                  <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                    background: sel ? "var(--accent-2)" : "var(--border-2)", transition: "background 0.2s" }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700,
                      color: sel ? "var(--accent-2)" : "var(--text-primary)" }}>{type.label}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, lineHeight: 1.4 }}>
                      {type.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
