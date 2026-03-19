/**
 * useHeaderFooter.js
 *
 * Manages header/footer editor modal state and handles API updates.
 * Keeps financeData.header and financeData.footer in sync with the server.
 *
 * Usage:
 *   const hf = useHeaderFooter(projectId, financeData, setFinanceData);
 *   <button onClick={() => hf.openEditor('header')}>Edit Header</button>
 *   <button onClick={() => hf.openEditor('footer')}>Edit Footer</button>
 *   {hf.showEditor && (
 *     <HeaderFooterEditor
 *       mode={hf.editorMode}
 *       financeData={financeData}
 *       onSaveHeader={hf.handleHeaderUpdate}
 *       onSaveFooter={hf.handleFooterUpdate}
 *       onClose={hf.closeEditor}
 *       saving={hf.saving}
 *     />
 *   )}
 */

import { useState, useCallback } from "react";
import {
  updateFinanceHeaderApi,
  updateFinanceFooterApi,
} from "../../../../../../Api/financeApi";

export function useHeaderFooter(projectId, financeData, setFinanceData) {
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState(null); // 'header' | 'footer'
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const openEditor = useCallback((mode) => {
    setEditorMode(mode);
    setShowEditor(true);
    setSaveError(null);
  }, []);

  const closeEditor = useCallback(() => {
    setShowEditor(false);
    setEditorMode(null);
    setSaveError(null);
  }, []);

  // ── Header ──────────────────────────────────────────────────────────────

  const handleHeaderUpdate = useCallback(
    async (data) => {
      setSaving(true);
      setSaveError(null);
      try {
        await updateFinanceHeaderApi(projectId, data);
        setFinanceData((prev) => ({
          ...prev,
          header: { ...(prev.header || {}), ...data },
          // Mirror fields that PageHeader reads directly off financeData
          preparedBy: data.companyName ?? prev.preparedBy,
          date: data.quotationDate
            ? new Date(data.quotationDate).toISOString().slice(0, 10)
            : prev.date,
        }));
        setShowEditor(false);
      } catch (err) {
        console.error("[useHeaderFooter] header update failed:", err);
        setSaveError(err?.message || "Failed to save header.");
      } finally {
        setSaving(false);
      }
    },
    [projectId, setFinanceData],
  );

  // ── Footer ──────────────────────────────────────────────────────────────

  const handleFooterUpdate = useCallback(
    async (data) => {
      setSaving(true);
      setSaveError(null);
      try {
        await updateFinanceFooterApi(projectId, data);
        setFinanceData((prev) => ({
          ...prev,
          footer: { ...(prev.footer || {}), ...data },
          footerNotes: data.notes ?? prev.footerNotes,
        }));
        setShowEditor(false);
      } catch (err) {
        console.error("[useHeaderFooter] footer update failed:", err);
        setSaveError(err?.message || "Failed to save footer.");
      } finally {
        setSaving(false);
      }
    },
    [projectId, setFinanceData],
  );

  return {
    showEditor,
    editorMode,
    saving,
    saveError,
    openEditor,
    closeEditor,
    handleHeaderUpdate,
    handleFooterUpdate,
  };
}
