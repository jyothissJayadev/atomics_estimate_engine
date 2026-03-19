/**
 * ControlBar.jsx
 *
 * Top document control bar.
 * Adds Header / Footer edit buttons alongside the existing Debug + Export PDF actions.
 */

const FONT = "Calibri, 'Trebuchet MS', Arial, sans-serif";

export default function DocumentControlBar({
  projectId,
  totalPages,
  exporting,
  debugMode,
  onExport,
  onToggleDebug,
  onEditHeader,
  onEditFooter,
  scale,
  disabled,
}) {
  const btn = (label, onClick, opts = {}) => (
    <button
      onClick={onClick}
      disabled={opts.disabled || disabled}
      style={{
        padding: "5px 12px",
        fontSize: 11,
        fontFamily: FONT,
        background: opts.active ? "#3d5a78" : "transparent",
        color: opts.active ? "#9ec8e8" : "#7faabf",
        border: `1px solid ${opts.active ? "#9ec8e8" : "#3d5a78"}`,
        borderRadius: 3,
        cursor: opts.disabled || disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        background: "#2E4057",
        color: "#fff",
        gap: 16,
        flexWrap: "wrap",
        borderBottom: "3px solid #1a2a3a",
        flexShrink: 0,
      }}
    >
      {/* Left: title + meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          Estimate Document
        </span>
        <span style={{ fontSize: 11, color: "#aac4d8", fontFamily: FONT }}>
          {totalPages} {totalPages === 1 ? "page" : "pages"} · A4 ·{" "}
          {(scale * 100).toFixed(0)}% zoom
        </span>
      </div>

      {/* Right: actions */}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Edit section */}
        <div
          style={{
            display: "flex",
            gap: 6,
            paddingRight: 12,
            borderRight: "1px solid #3d5a78",
            marginRight: 4,
          }}
        >
          {btn("✏ Header", onEditHeader)}
          {btn("✏ Footer", onEditFooter)}
        </div>

        {/* Utility section */}
        {btn("Debug", onToggleDebug, { active: debugMode })}

        <button
          onClick={onExport}
          disabled={exporting || disabled}
          style={{
            padding: "7px 20px",
            fontSize: 11,
            fontFamily: FONT,
            fontWeight: 700,
            background: exporting || disabled ? "#3d5a78" : "#217346",
            color: exporting || disabled ? "#7faabf" : "#fff",
            border: "none",
            borderRadius: 3,
            cursor: exporting || disabled ? "not-allowed" : "pointer",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          {exporting ? "Generating PDF…" : "⬇ Export PDF"}
        </button>
      </div>
    </div>
  );
}
