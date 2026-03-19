/**
 * index.jsx
 *
 * EstimateDocumentViewer — root component.
 *
 * Data flow:
 *   1. Fetch estimate data  →  getFinancePreviewApi(projectId)
 *   2. Fetch layout data    →  getFinanceLayoutApi(projectId)
 *      (header: companyName, phone, email, location, quotationDate, logoUrl)
 *      (footer: notes[])
 *   3. Merge both into internal financeData via transformApiData()
 *   4. financeData → buildDocumentPages() → pages[]
 *   5. financeData → computeTotals() → totals
 *   6. Header/Footer edits call updateFinanceHeaderApi / updateFinanceFooterApi
 *      and update financeData in-place (no re-fetch needed).
 *
 * Props:
 *   estimateId     {string}   ID for the estimates API
 *   projectId      {string}   ID for the finance layout API + PDF filename
 *   projectMeta    {object}   { projectName, clientName, currency }
 *   refreshKey     {number}   increment to force a data re-fetch
 *   marginTopPx    {number}
 *   marginBottomPx {number}
 *   debugMode      {boolean}
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

import {
  DEFAULT_MARGIN_TOP_PX,
  DEFAULT_MARGIN_BOTTOM_PX,
  computePreviewScale,
} from "./engine/measurementModel.js";
import { buildDocumentPages } from "./engine/layoutEngine.js";
import { computeTotals } from "./engine/totals.js";
import { transformApiData } from "./engine/transformApiData.js";
import { exportToPDF } from "./export/pdfExport.js";

import DocumentControlBar from "./ui/ControlBar.jsx";
import PreviewShell from "./ui/PreviewShell.jsx";
import HeaderFooterEditor from "./ui/HeaderFooterEditor.jsx";
import { useHeaderFooter } from "./ui/useHeaderFooter.js";

import { getFinancePreviewApi } from "../../../../../Api/financeApi.js";
import { getFinanceLayoutApi } from "../../../../../Api/financeApi.js";

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#E8E8E8",
        fontFamily: "Calibri, Arial, sans-serif",
      }}
    >
      {[1, 2].map((n) => (
        <div
          key={n}
          style={{
            width: 600,
            height: 140,
            background: "#fff",
            borderRadius: 2,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {[80, 60, 100, 45].map((w, i) => (
            <div
              key={i}
              style={{
                height: 10,
                width: `${w}%`,
                background: "#e0e0e0",
                borderRadius: 3,
                animation: "pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      ))}
      <span style={{ color: "#888", marginTop: 8, fontSize: 13 }}>
        Loading estimate…
      </span>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#E8E8E8",
        fontFamily: "Calibri, Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid #e0b0b0",
          borderRadius: 4,
          padding: "24px 32px",
          textAlign: "center",
          maxWidth: 420,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#842029",
            marginBottom: 6,
          }}
        >
          Failed to load estimate
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
          {message || "An unexpected error occurred."}
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: "7px 20px",
              fontSize: 12,
              fontFamily: "Calibri, Arial, sans-serif",
              background: "#2E4057",
              color: "#fff",
              border: "none",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function EstimateDocumentViewer({
  estimateId,
  projectId,
  projectMeta = {},
  refreshKey = 0,
  marginTopPx = DEFAULT_MARGIN_TOP_PX,
  marginBottomPx = DEFAULT_MARGIN_BOTTOM_PX,
  debugMode: initialDebug = false,
}) {
  // ── Data state ────────────────────────────────────────────────────────────
  const [financeData, setFinanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [debugMode, setDebugMode] = useState(initialDebug);

  const containerRef = useRef(null);
  const scale = useMemo(() => computePreviewScale(), []);

  // ── Header / Footer editor ────────────────────────────────────────────────
  const hf = useHeaderFooter(projectId, financeData, setFinanceData);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setFetchError(null);

    try {
      // Parallel fetch: estimate data + layout (header/footer)
      const [estimateResp, layoutResp] = await Promise.all([
        getFinancePreviewApi(projectId),
        getFinanceLayoutApi(projectId).catch(() => ({ data: {} })), // non-fatal
      ]);

      const rawEstimate = estimateResp?.data ?? estimateResp ?? {};
      const rawLayout = layoutResp?.data ?? layoutResp ?? {};

      // Merge: layout provides header + footer; estimate provides estimates + totals + gst
      const merged = {
        ...rawEstimate,
        header: rawLayout.header || {},
        footer: rawLayout.footer || rawEstimate.footer || {},
      };

      const transformed = transformApiData(merged, projectMeta);
      setFinanceData(transformed);
    } catch (err) {
      console.error("[EstimateDocumentViewer] fetch failed:", err);
      setFetchError(err?.message || "Failed to load estimate data.");
    } finally {
      setLoading(false);
    }
  }, [projectId, JSON.stringify(projectMeta)]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const config = useMemo(
    () => ({ marginTopPx, marginBottomPx, scale }),
    [marginTopPx, marginBottomPx, scale],
  );

  const pages = useMemo(
    () => (financeData ? buildDocumentPages(financeData, config) : []),
    [financeData, config],
  );

  const totals = useMemo(
    () => (financeData ? computeTotals(financeData) : null),
    [financeData],
  );

  // ── PDF Export ────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!financeData) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportToPDF({ totalPages: pages.length, projectId, financeData });
    } catch (err) {
      console.error("PDF export failed:", err);
      setExportError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [pages.length, projectId, financeData]);

  const handleToggleDebug = useCallback(() => setDebugMode((d) => !d), []);

  // ─────────────────────────────────────────────────────────────────────────
  const isReady = !loading && !fetchError && financeData && totals;

  return (
    <div
      style={{
        fontFamily: "Calibri, 'Trebuchet MS', Arial, sans-serif",
        background: "#E8E8E8",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Control bar */}
      <DocumentControlBar
        projectId={projectId}
        totalPages={isReady ? pages.length : 0}
        exporting={exporting}
        debugMode={debugMode}
        onExport={handleExport}
        onToggleDebug={handleToggleDebug}
        onEditHeader={() => hf.openEditor("header")}
        onEditFooter={() => hf.openEditor("footer")}
        scale={scale}
        disabled={!isReady}
      />

      {/* Export error */}
      {exportError && (
        <div
          style={{
            background: "#f8d7da",
            color: "#842029",
            padding: "8px 24px",
            fontSize: 12,
            fontFamily: "Calibri, Arial, sans-serif",
            borderBottom: "1px solid #f5c2c7",
          }}
        >
          ⚠ Export error: {exportError}
        </div>
      )}

      {/* Main content */}
      {loading && <LoadingState />}
      {!loading && fetchError && (
        <ErrorState message={fetchError} onRetry={fetchData} />
      )}

      {isReady && (
        <PreviewShell
          pages={pages}
          financeData={financeData}
          totals={totals}
          marginTopPx={marginTopPx}
          marginBottomPx={marginBottomPx}
          scale={scale}
          debugMode={debugMode}
          containerRef={containerRef}
        />
      )}

      {/* Header / Footer editor modal */}
      {hf.showEditor && (
        <HeaderFooterEditor
          mode={hf.editorMode}
          financeData={financeData}
          onSaveHeader={hf.handleHeaderUpdate}
          onSaveFooter={hf.handleFooterUpdate}
          onClose={hf.closeEditor}
          saving={hf.saving}
          saveError={hf.saveError}
        />
      )}
    </div>
  );
}
