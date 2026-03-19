/**
 * A4Renderer.jsx
 *
 * Renders a single A4 page from its chunk array.
 *
 * SLOT MODEL:
 *   Every chunk is wrapped in a slot <div> whose height equals the engine's
 *   _height budget. This is the contract between engine and renderer:
 *
 *   - Fixed chunks (headers, gaps, footer lines, summary):
 *       slot height = _height exactly, overflow:hidden clips any rounding error.
 *
 *   - tableRow chunks:
 *       The slot has NO height and NO minHeight.
 *       The row div itself has NO height — it sizes purely to its cell content
 *       (text wrapping + padding). The engine's estimatedHeight was computed
 *       from the same typography constants so it will match closely, but we
 *       let the browser be the final authority.
 *       The page outer overflow:hidden is the only safety boundary.
 *
 * This means no data field (height, width, quantity…) can ever influence
 * the visual row height — only text content × column width (CSR) does.
 */

import {
  A4_WIDTH_PX,
  A4_HEIGHT_PX,
  MARGIN_H_PX,
  PAGE_NUMBER_ZONE_PX,
} from "../engine/measurementModel.js";
import { CategoryHeader, TableHeader, TableRow } from "./TableRenderer.jsx";
import {
  PageHeader,
  EstimateHeader,
  GrandSummary,
  FooterLine,
  PageNumber,
  DebugOverlay,
} from "./SectionRenderer.jsx";

export default function A4Page({
  chunks,
  pageNum,
  totalPages,
  financeData,
  totals,
  marginTopPx,
  marginBottomPx,
  scale,
  debugMode,
}) {
  const s = (v) => v * scale;
  const currency = financeData.currency || "₹";
  const estimates = financeData.estimates || [];

  // ── Chunk → React element ─────────────────────────────────────────────────

  const renderInner = (chunk, idx) => {
    switch (chunk.type) {
      case "pageHeader":
        return <PageHeader key={idx} financeData={financeData} scale={scale} />;

      case "estimateHeader": {
        const est = estimates[chunk.estimateIndex];
        return est ? (
          <EstimateHeader key={idx} estimate={est} scale={scale} />
        ) : null;
      }

      case "categoryHeader": {
        const cat =
          estimates[chunk.estimateIndex]?.categories[chunk.categoryIndex];
        return cat ? (
          <CategoryHeader
            key={idx}
            category={cat}
            isContinued={chunk.isContinued}
            scale={scale}
          />
        ) : null;
      }

      case "tableHeader": {
        const cat =
          estimates[chunk.estimateIndex]?.categories[chunk.categoryIndex];
        return cat ? (
          <TableHeader key={idx} category={cat} scale={scale} />
        ) : null;
      }

      case "tableRow": {
        const cat =
          estimates[chunk.estimateIndex]?.categories[chunk.categoryIndex];
        const row = cat?.rows[chunk.rowIndex];
        return cat && row ? (
          <TableRow
            key={idx}
            row={row}
            category={cat}
            currency={currency}
            scale={scale}
            debug={debugMode}
          />
        ) : null;
      }

      case "summary":
        return (
          <GrandSummary
            key={idx}
            financeData={financeData}
            totals={totals}
            scale={scale}
          />
        );

      case "footerLine":
        return (
          <FooterLine
            key={idx}
            text={chunk.text}
            lineIndex={chunk.lineIndex}
            scale={scale}
          />
        );

      case "gap":
        return (
          <div key={idx} style={{ height: s(chunk.height), flexShrink: 0 }} />
        );

      default:
        return null;
    }
  };

  // ── Slot wrapper ──────────────────────────────────────────────────────────
  // chunk._height is in UNSCALED base px — multiply by scale for screen px.

  const renderChunk = (chunk, idx) => {
    const isRow = chunk.type === "tableRow";

    if (isRow) {
      return (
        <div key={idx} style={{ flexShrink: 0 }}>
          {renderInner(chunk, idx)}
        </div>
      );
    }

    const h = chunk._height != null ? s(chunk._height) : null;
    if (!h) return renderInner(chunk, idx);

    return (
      <div key={idx} style={{ height: h, flexShrink: 0, overflow: "hidden" }}>
        {renderInner(chunk, idx)}
      </div>
    );
  };

  // ── Page shell ────────────────────────────────────────────────────────────
  // Physical size = base A4 × scale. All paddings also scaled.
  // This is the actual DOM size — no CSS transform involved.

  return (
    <div
      style={{
        position: "relative",
        width: s(A4_WIDTH_PX),
        height: s(A4_HEIGHT_PX),
        paddingLeft: s(MARGIN_H_PX),
        paddingRight: s(MARGIN_H_PX),
        paddingTop: s(marginTopPx),
        paddingBottom: s(marginBottomPx),
        boxSizing: "border-box",
        background: "#fff",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: s(
            A4_HEIGHT_PX - marginTopPx - marginBottomPx - PAGE_NUMBER_ZONE_PX,
          ),
          overflow: "hidden",
        }}
      >
        {chunks.map(renderChunk)}
      </div>

      <PageNumber pageNum={pageNum} totalPages={totalPages} scale={scale} />

      {debugMode && (
        <DebugOverlay
          scale={scale}
          marginTopPx={s(marginTopPx)}
          marginBottomPx={s(marginBottomPx)}
        />
      )}
    </div>
  );
}
