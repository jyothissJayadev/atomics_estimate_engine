import React from "react";
import { CheckCircle2, MapPin, DollarSign, Home, Wrench, Layers, TrendingUp, TrendingDown } from "lucide-react";
import { PROJECT_TYPES, ADDITIONAL_WORK, ROOM_CONFIG_OPTIONS } from "../../../constants/projectConfig";

const fINR = (v) => {
  const n = Number(v);
  if (!n) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const HUES = ["#4361ee","#7c3aed","#0ea5e9","#10b981","#f59e0b","#ef4444","#ec4899","#14b8a6","#f97316","#84cc16"];

function SCard({ icon, title, children }) {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden",
      border: "1.5px solid var(--border)", background: "var(--surface)",
      boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)" }}>
        <div style={{ width: 30, height: 30, borderRadius: 9,
          background: "var(--accent-subtle)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--accent-2)" }}>{icon}</div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "baseline", padding: "7px 0",
      borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
        textAlign: "right", maxWidth: "60%" }}>{value || "—"}</span>
    </div>
  );
}

export default function ReviewSection({ projectData }) {
  const ptLabel = PROJECT_TYPES.find(t => t.id === projectData.projectType)?.label || projectData.projectType;
  const configOptions = ROOM_CONFIG_OPTIONS[projectData.projectType] || [];
  const rcLabel = configOptions.find(c => c.id === projectData.roomConfig)?.label || projectData.roomConfig;

  const predictedSections  = projectData.predictedSections  || [];
  const confirmedSections  = projectData.confirmedSections  || [];
  const predictedItems     = projectData.predictedItems     || [];
  const confirmedItems     = projectData.confirmedItems     || {};
  const projectTotals      = projectData.projectTotals      || null;

  const totalBudget = Number(projectData.totalBudget) || 0;

  // Live estimate total
  const liveTotal = predictedItems.reduce((total, sec) => {
    const refs = new Set(confirmedItems[sec.canonicalRef] || []);
    return total + (sec.items || [])
      .filter(i => refs.has(i.canonicalRef))
      .reduce((s, i) => s + (i.subtotal || 0), 0);
  }, 0);

  const deviation = totalBudget > 0 ? ((liveTotal - totalBudget) / totalBudget) * 100 : null;
  const isOver    = deviation !== null && deviation > 0;

  const confirmedCount = confirmedSections.length;
  const totalItemCount = Object.values(confirmedItems).reduce((s, arr) => s + arr.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)",
          textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
          Step 6 of 6 — Review
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 8 }}>
          Review & launch
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
          Everything looks good? Hit Launch to create your estimate.
        </p>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", alignItems: "center", gap: 20,
        padding: "24px 28px", borderRadius: 20,
        background: "linear-gradient(135deg, var(--accent-subtle), #f0fdf4)",
        border: "1.5px solid var(--accent-border)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14,
          background: "var(--accent)", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle2 size={22} style={{ color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
            fontFamily: "var(--font-display)", marginBottom: 4 }}>
            {projectData.projectName || "Untitled Project"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {projectData.clientName ? `for ${projectData.clientName}` : "No client"}
            {ptLabel ? ` · ${ptLabel}` : ""}
            {rcLabel ? ` · ${rcLabel}` : ""}
          </p>
        </div>
        {projectData.coverImagePreview && (
          <img src={projectData.coverImagePreview} alt=""
            style={{ width: 56, height: 56, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
        )}
      </div>

      {/* Budget + deviation */}
      {liveTotal > 0 && (
        <div style={{ padding: "18px 22px", borderRadius: 16,
          background: isOver ? "#fff7ed" : "#f0fdf4",
          border: `1.5px solid ${isOver ? "#fed7aa" : "#a7f3d0"}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)",
                textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
                Estimated Total
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, color: isOver ? "#9a3412" : "#166534",
                fontFamily: "var(--font-display)", margin: 0 }}>
                {fINR(liveTotal)}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "3px 0 0" }}>
                Budget: {fINR(totalBudget)} · {confirmedCount} sections · {totalItemCount} items
              </p>
            </div>
            {deviation !== null && Math.abs(deviation) > 0.5 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 12,
                background: isOver ? "#fee2e2" : "#dcfce7",
                color: isOver ? "#dc2626" : "#16a34a" }}>
                {isOver ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span style={{ fontSize: 14, fontWeight: 700 }}>
                  {isOver ? "+" : ""}{deviation.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Two-col: location + budget */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <SCard icon={<MapPin size={14} />} title="Location & Scope">
          <Row label="City" value={projectData.city} />
          <Row label="Locality Tier" value={projectData.localityTier} />
          <Row label="Area" value={projectData.totalArea ? `${projectData.totalArea} sq ft` : ""} />
          <Row label="Interior Type" value={projectData.interiorType} />
        </SCard>
        <SCard icon={<DollarSign size={14} />} title="Budget">
          <Row label="Total Budget" value={fINR(projectData.totalBudget)} />
          <Row label="Tier" value={projectData.budgetTier} />
          {projectData.budgetTier === "Moderate" && projectData.flexibilityPercent && (
            <Row label="Buffer" value={`${projectData.flexibilityPercent}%`} />
          )}
        </SCard>
      </div>

      {/* Confirmed sections + item count */}
      {confirmedCount > 0 && (
        <SCard icon={<Layers size={14} />} title={`Sections (${confirmedCount})`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {predictedSections
              .filter(s => confirmedSections.includes(s.canonicalRef))
              .map((sec, idx) => {
                const itemCount = (confirmedItems[sec.canonicalRef] || []).length;
                // Get section total from predictedItems
                const secData = predictedItems.find(p => p.canonicalRef === sec.canonicalRef);
                const refs = new Set(confirmedItems[sec.canonicalRef] || []);
                const secTotal = (secData?.items || [])
                  .filter(i => refs.has(i.canonicalRef))
                  .reduce((s, i) => s + (i.subtotal || 0), 0);
                return (
                  <div key={sec.canonicalRef} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 14px", borderRadius: 10,
                    background: HUES[idx % HUES.length] + "12",
                    border: `1px solid ${HUES[idx % HUES.length]}28`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%",
                        background: HUES[idx % HUES.length] }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                        {sec.label}
                      </span>
                      {itemCount > 0 && (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          · {itemCount} items
                        </span>
                      )}
                    </div>
                    {secTotal > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#4361ee" }}>
                        {fINR(secTotal)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </SCard>
      )}

      {/* Additional work */}
      {(projectData.additionalWork || []).length > 0 && (
        <SCard icon={<Wrench size={14} />} title="Additional Work">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(projectData.additionalWork || []).map(id => {
              const w = ADDITIONAL_WORK.find(x => x.id === id);
              return w ? (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 20,
                  background: "var(--surface-2)", border: "1.5px solid var(--border)" }}>
                  <span style={{ fontSize: 14 }}>{w.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    {w.label}
                  </span>
                </div>
              ) : null;
            })}
          </div>
        </SCard>
      )}

      {/* Launch note */}
      <div style={{ padding: "16px 20px", borderRadius: 14,
        background: "#f0fdf4", border: "1px solid #a7f3d0",
        fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
        ✓ Review complete. Click <strong>Launch Project</strong> — your estimate will open immediately.
      </div>
    </div>
  );
}
