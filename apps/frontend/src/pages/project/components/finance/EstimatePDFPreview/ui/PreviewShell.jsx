/**
 * PreviewShell.jsx
 *
 * SCALE MODEL (the only rule):
 *   - The visible A4Page receives the real CSR `scale` prop.
 *     Every internal dimension (fonts, column widths, paddings) is multiplied
 *     by scale inside the component — no CSS transform is applied.
 *     The page's outer div is physically A4_WIDTH_PX*scale × A4_HEIGHT_PX*scale.
 *
 *   - The hidden export container renders at scale=1 (true A4 pixels) for PDF.
 *
 *   - Scale is derived live from the shell container's measured width via
 *     ResizeObserver, so the page always fills 100% of available horizontal space.
 */

import { useRef, useState, useEffect } from "react";
import {
  PREVIEW_SHELL_PADDING_H,
  computePreviewScale,
} from "../engine/measurementModel.js";
import A4Page from "../renderer/A4Renderer.jsx";

export default function PreviewShell({
  pages,
  financeData,
  totals,
  marginTopPx,
  marginBottomPx,
  debugMode,
  containerRef,
  onScaleChange, // optional — notifies parent of live scale
}) {
  const shellRef = useRef(null);
  const [scale, setScale] = useState(() =>
    computePreviewScale(window.innerWidth),
  );

  // ── Measure container width and recompute scale on every resize ───────────
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const compute = (width) => {
      const next = computePreviewScale(width);
      setScale(next);
      onScaleChange?.(next);
    };

    // Initial measurement
    compute(el.clientWidth);

    const ro = new ResizeObserver(([entry]) => {
      compute(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [onScaleChange]);

  const sharedPageProps = {
    totalPages: pages.length,
    financeData,
    totals,
    marginTopPx,
    marginBottomPx,
  };

  return (
    <div
      ref={shellRef}
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden", // page fills width — no horizontal scroll needed
        // Horizontal padding: PREVIEW_SHELL_PADDING_H / 2 each side
        padding: `28px ${PREVIEW_SHELL_PADDING_H / 2}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        background: "#E8E8E8",
        boxSizing: "border-box",
      }}
    >
      {/* ── Hidden 1:1 export container (off-screen, scale=1) ────────────── */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          left: -99999,
          top: 0,
          display: "flex",
          flexDirection: "column",
          gap: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        {pages.map((chunks, i) => (
          <div key={i} data-preview-page={i + 1}>
            <A4Page
              {...sharedPageProps}
              chunks={chunks}
              pageNum={i + 1}
              scale={1}
              debugMode={false}
            />
          </div>
        ))}
      </div>

      {/* ── Visible pages — A4Page renders at physical scaledWidth × scaledHeight ── */}
      {pages.map((chunks, i) => (
        <div
          key={i}
          style={{
            flexShrink: 0,
            position: "relative",
            lineHeight: 0, // kill any phantom whitespace gap below inline blocks
            boxShadow: "0 2px 16px rgba(0,0,0,0.22)",
          }}
        >
          <A4Page
            {...sharedPageProps}
            chunks={chunks}
            pageNum={i + 1}
            scale={scale}
            debugMode={debugMode}
          />
        </div>
      ))}

      {/* Footer label */}
      <div
        style={{
          fontSize: 11,
          color: "#999",
          textAlign: "center",
          paddingBottom: 28,
          fontFamily: "Calibri, Arial, sans-serif",
        }}
      >
        {pages.length} page{pages.length !== 1 ? "s" : ""} · A4 ·{" "}
        {(scale * 100).toFixed(0)}% zoom
      </div>
    </div>
  );
}
