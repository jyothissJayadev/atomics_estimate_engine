/**
 * SectionRenderer.jsx
 *
 * Document-level section components (Excel-style formal).
 *
 * Changes from previous version:
 *   - PageHeader: removed fixed height, switched to flex-start alignment,
 *     contact line only rendered when data exists, both sides top-align.
 *   - GrandSummary now shows a GST row when gstEnabled and lists
 *     per-estimate subtotals using the new financeData shape.
 *   - EstimateHeader uses estimate.title from transformed shape.
 */

import {
  BASE,
  MARGIN_H_PX,
  PAGE_NUMBER_ZONE_PX,
} from "../engine/measurementModel.js";
import { formatCurrency } from "../engine/totals.js";

const FONT = "Calibri, 'Trebuchet MS', Arial, sans-serif";
const BORDER_COLOR = "#7F7F7F";
const SECTION_BG = "#BDD7EE";
const HEADER_BG = "#D9D9D9";

const border = (s) => `${s(0.75)}px solid ${BORDER_COLOR}`;

// ─────────────────────────────────────────────────────────────────────────────
// PAGE HEADER
// ─────────────────────────────────────────────────────────────────────────────

export function PageHeader({ financeData, scale }) {
  const s = (v) => v * scale;
  const h = financeData.header || {};
  const contactLine = [h.phone, h.email, h.location]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: s(16), // hard gap so sides never touch
        borderBottom: `${s(2)}px solid #000`,
        paddingTop: s(6),
        paddingBottom: s(8),
        marginBottom: s(4),
        boxSizing: "border-box",
        flexShrink: 0,
        minHeight: s(BASE.PAGE_HEADER),
      }}
    >
      {/* ── Left: company identity — grows to fill available space ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: s(8),
          flex: "1 1 0", // grows, can shrink, base 0 so gap is honest
          minWidth: 0, // allow text truncation rather than overflow
          overflow: "hidden",
        }}
      >
        {h.logoUrl && (
          <img
            src={h.logoUrl}
            alt="logo"
            style={{
              height: s(36),
              width: "auto",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: s(15),
              fontWeight: 700,
              color: "#000",
              letterSpacing: s(0.2),
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {financeData.preparedBy || h.companyName || "Studio Interiors"}
          </div>

          {contactLine && (
            <div
              style={{
                fontSize: s(7.5),
                color: "#555",
                marginTop: s(4),
                fontFamily: FONT,
                lineHeight: 1.5,
                whiteSpace: "nowrap",
              }}
            >
              {contactLine}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: document meta — fixed width, never shrinks ──────── */}
      <div
        style={{
          textAlign: "right",
          flexShrink: 0,
          flexGrow: 0,
          minWidth: s(140), // enough for "PROJECT ESTIMATE" + date at any scale
        }}
      >
        <div
          style={{
            fontSize: s(10),
            fontWeight: 700,
            color: "#000",
            fontFamily: FONT,
            letterSpacing: s(0.5),
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Project Estimate
        </div>

        {financeData.clientName && (
          <div
            style={{
              fontSize: s(8),
              color: "#333",
              marginTop: s(4),
              fontFamily: FONT,
              whiteSpace: "nowrap",
            }}
          >
            {financeData.clientName}
          </div>
        )}
        {financeData.projectName && (
          <div
            style={{
              fontSize: s(7.5),
              color: "#555",
              fontFamily: FONT,
              whiteSpace: "nowrap",
            }}
          >
            {financeData.projectName}
          </div>
        )}
        <div
          style={{
            fontSize: s(7.5),
            color: "#888",
            marginTop: s(3),
            fontFamily: FONT,
            whiteSpace: "nowrap",
          }}
        >
          Date: {financeData.date}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATE HEADER
// ─────────────────────────────────────────────────────────────────────────────

export function EstimateHeader({ estimate, scale }) {
  const s = (v) => v * scale;

  return (
    <div
      style={{
        height: s(BASE.ESTIMATE_HEADER),
        display: "flex",
        alignItems: "center",
        background: SECTION_BG,
        border: border(s),
        paddingLeft: s(8),
        paddingRight: s(8),
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: s(11),
          fontWeight: 700,
          color: "#000",
          textTransform: "uppercase",
          letterSpacing: s(0.5),
          fontFamily: FONT,
        }}
      >
        {estimate.title || estimate.id}
      </span>
      {estimate.version != null && (
        <span
          style={{
            fontSize: s(8.5),
            color: "#555",
            marginLeft: s(10),
            fontFamily: FONT,
          }}
        >
          v{estimate.version}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAND SUMMARY  (with GST row)
// ─────────────────────────────────────────────────────────────────────────────

export function GrandSummary({ financeData, totals, scale }) {
  const s = (v) => v * scale;
  const currency = financeData.currency || "₹";
  const { estimateTotals, grandTotal, gstAmount, grandTotalWithGst } = totals;
  const gstEnabled = financeData.gstEnabled;
  const gstPct = financeData.gstPercentage || 0;

  const rowStyle = (isBold = false, bg = "#fff") => ({
    display: "flex",
    borderBottom: border(s),
    background: isBold ? HEADER_BG : bg,
    flexShrink: 0,
  });

  const cellStyle = (flex, align = "left", extra = {}) => ({
    flex,
    padding: `${s(4)}px ${s(8)}px`,
    fontSize: s(9),
    fontFamily: FONT,
    color: "#000",
    textAlign: align,
    borderRight: border(s),
    boxSizing: "border-box",
    lineHeight: 1.4,
    ...extra,
  });

  return (
    <div
      style={{
        height: s(BASE.SUMMARY_BLOCK),
        boxSizing: "border-box",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        border: border(s),
        overflow: "hidden",
      }}
    >
      {/* Section title */}
      <div
        style={{
          background: SECTION_BG,
          borderBottom: border(s),
          padding: `${s(5)}px ${s(8)}px`,
          fontSize: s(9.5),
          fontWeight: 700,
          fontFamily: FONT,
          color: "#000",
          textTransform: "uppercase",
          letterSpacing: s(0.5),
          flexShrink: 0,
        }}
      >
        Estimate Summary
      </div>

      {/* Column headers */}
      <div style={rowStyle(true)}>
        <div style={{ ...cellStyle(3, "left", { fontWeight: 700 }) }}>
          Section
        </div>
        <div
          style={{
            ...cellStyle(1, "right", { fontWeight: 700, borderRight: "none" }),
          }}
        >
          Amount ({currency})
        </div>
      </div>

      {/* Per-estimate rows */}
      <div style={{ flex: 1, overflowY: "hidden" }}>
        {(financeData.estimates || []).map((est, i) => (
          <div key={est.id} style={rowStyle()}>
            <div style={cellStyle(3, "left")}>{est.title || est.id}</div>
            <div
              style={{
                ...cellStyle(1, "right", {
                  fontWeight: 500,
                  borderRight: "none",
                }),
              }}
            >
              {(estimateTotals[i]?.estTotal || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Subtotal */}
      <div style={rowStyle(true)}>
        <div style={{ ...cellStyle(3, "left", { fontWeight: 600 }) }}>
          Subtotal
        </div>
        <div
          style={{
            ...cellStyle(1, "right", { fontWeight: 600, borderRight: "none" }),
          }}
        >
          {formatCurrency(grandTotal, currency)}
        </div>
      </div>

      {/* GST row (conditional) */}
      {gstEnabled && (
        <div style={rowStyle()}>
          <div style={cellStyle(3, "left")}>GST @ {gstPct}%</div>
          <div style={{ ...cellStyle(1, "right", { borderRight: "none" }) }}>
            {formatCurrency(gstAmount, currency)}
          </div>
        </div>
      )}

      {/* Grand total */}
      <div style={{ ...rowStyle(true), borderTop: `${s(1.5)}px solid #000` }}>
        <div
          style={{
            ...cellStyle(3, "left", { fontWeight: 700, fontSize: s(10) }),
          }}
        >
          Grand Total {gstEnabled ? "(incl. GST)" : ""}
        </div>
        <div
          style={{
            ...cellStyle(1, "right", {
              fontWeight: 700,
              fontSize: s(11),
              borderRight: "none",
            }),
          }}
        >
          {formatCurrency(
            gstEnabled ? grandTotalWithGst : grandTotal,
            currency,
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER LINE
// ─────────────────────────────────────────────────────────────────────────────

export function FooterLine({ text, lineIndex, scale }) {
  const s = (v) => v * scale;

  return (
    <div
      style={{
        height: s(BASE.FOOTER_LINE),
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: s(7.5),
          color: "#555",
          fontFamily: FONT,
          lineHeight: 1.3,
        }}
      >
        {lineIndex + 1}.&nbsp;{text}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE NUMBER
// ─────────────────────────────────────────────────────────────────────────────

export function PageNumber({ pageNum, totalPages, scale }) {
  const s = (v) => v * scale;

  return (
    <div
      style={{
        position: "absolute",
        bottom: s(PAGE_NUMBER_ZONE_PX / 2) - s(6),
        left: 0,
        right: 0,
        textAlign: "center",
        fontSize: s(8),
        color: "#999",
        fontFamily: FONT,
        letterSpacing: s(0.5),
      }}
    >
      Page {pageNum} of {totalPages}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEBUG OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

// marginTopPx / marginBottomPx received here are ALREADY scaled (multiplied by
// scale in A4Renderer before being passed in). Do NOT scale them again.
export function DebugOverlay({ scale, marginTopPx, marginBottomPx }) {
  const s = (v) => v * scale;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 999,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: marginTopPx,
          left: s(MARGIN_H_PX),
          right: s(MARGIN_H_PX),
          bottom: marginBottomPx + s(PAGE_NUMBER_ZONE_PX),
          border: "1.5px dashed rgba(0,160,255,0.5)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: marginBottomPx,
          height: s(PAGE_NUMBER_ZONE_PX),
          background: "rgba(255,0,0,0.05)",
          borderTop: "1px dashed rgba(255,0,0,0.4)",
        }}
      >
        <span
          style={{ fontSize: s(7), color: "rgba(255,0,0,0.5)", marginLeft: 4 }}
        >
          PAGE NUMBER ZONE
        </span>
      </div>
    </div>
  );
}
