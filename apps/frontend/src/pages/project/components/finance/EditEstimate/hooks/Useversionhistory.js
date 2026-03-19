import { useState, useCallback } from "react";

export const useVersionHistory = (showToast) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [viewMode, setViewMode] = useState("editing"); // 'editing' | 'preview'

  const safeClone = (data) => {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      console.error("Error cloning data:", error);
      return data;
    }
  };

  // ── Load versions from backend ─────────────────────────────────────────────
  // silent=true → only update the versions list, do NOT touch selectedVersionId.
  // Use silent=true after a save so the preview useEffect never fires.
  // Use silent=false (default) only on initial page load.
  const loadVersions = useCallback((backendVersions, silent = false) => {
    if (!Array.isArray(backendVersions)) {
      console.error("Invalid versions data received");
      return;
    }

    const transformedVersions = backendVersions.map((v, index) => {
      const transformedFormats = {};
      if (Array.isArray(v.cellFormatting)) {
        v.cellFormatting.forEach((fmt) => {
          if (fmt.itemId && fmt.columnId) {
            const cellId = `${fmt.itemId}_${fmt.columnId}`;
            transformedFormats[cellId] = Array.isArray(fmt.ranges)
              ? fmt.ranges
              : [];
          }
        });
      }

      return {
        id: v._id || `v${index}`,
        number: v.version || index + 1,
        status: v.isActive ? "active" : "archived",
        isActive: Boolean(v.isActive),
        createdAt: v.createdAt || new Date().toISOString(),
        createdBy: v.createdBy?.name || "Unknown User",
        summary: v.summary || `Version ${v.version || index + 1}`,
      };
    });

    setVersions(transformedVersions);

    // ── KEY FIX ───────────────────────────────────────────────────────────────
    // Only auto-select the active version on INITIAL load (silent=false).
    // After a save we call loadVersions(data, true) so selectedVersionId is
    // NOT changed — preventing the preview useEffect from firing and wiping
    // estimateData.categories.
    if (!silent) {
      const activeVersion = transformedVersions.find((v) => v.isActive);
      if (activeVersion) {
        setSelectedVersionId(activeVersion.id);
      }
    }
  }, []);

  // ── Select a version for preview ───────────────────────────────────────────
  const selectVersion = useCallback(
    (versionId) => {
      if (!versionId) {
        // null → exit preview, go back to editing
        setSelectedVersionId(null);
        setViewMode("editing");
        return;
      }
      const version = versions.find((v) => v.id === versionId);
      if (version) {
        setSelectedVersionId(versionId);
        setViewMode(version.isActive ? "editing" : "preview");
      }
    },
    [versions],
  );

  // ── Exit preview, return to editing ───────────────────────────────────────
  const exitPreview = useCallback(() => {
    const activeVersion = versions.find((v) => v.isActive);
    if (activeVersion) {
      setSelectedVersionId(activeVersion.id);
    }
    setViewMode("editing");
  }, [versions]);

  // ── Getters ────────────────────────────────────────────────────────────────
  const getActiveVersion = useCallback(
    () => versions.find((v) => v.isActive),
    [versions],
  );

  const getSelectedVersion = useCallback(
    () => versions.find((v) => v.id === selectedVersionId),
    [versions, selectedVersionId],
  );

  return {
    versions,
    selectedVersionId,
    viewMode,
    loadVersions,      // call with (data, true) after save; (data) on initial load
    getActiveVersion,
    getSelectedVersion,
    selectVersion,
    exitPreview,
    setViewMode,
  };
};