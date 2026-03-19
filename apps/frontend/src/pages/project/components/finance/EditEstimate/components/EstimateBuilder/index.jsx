import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layers, Loader2 } from "lucide-react";
import {
  DEFAULT_COLUMNS,
  MAX_COLUMNS,
  MIN_COL_WIDTH,
  MAX_COL_WIDTH,
  MAX_TABLE_WIDTH,
  MIN_TABLE_WIDTH,
  initializeColumnPercentages,
  recalculateColumnPercentages,
  getTableWidth,
  getValidatedColumnWidth,
} from "../../constants";
import {
  getEstimateByIdApi,
  getEstimateVersionsApi,
  getSingleEstimateVersionApi,
  updateEstimateMetaApi,
  saveEstimateVersionApi,
  lockEstimateApi,
  unlockEstimateApi,
  createEstimateApi,
  syncProjectFinanceApi,
  uploadEstimateItemImageApi,
} from "../../../../../../../Api/financeApi";
import { useToast } from "../../hooks/useToast";
import { useVersionHistory } from "../../hooks/useVersionHistory";
import { useDragAndDrop } from "../../hooks/useDragAndDrop";
import { useFormatting } from "../../hooks/useFormatting";
import {
  calculateSubtotal,
  calculateGrandTotal,
  calculateArea,
  calculateTotal,
  calculatePricingTotal,
} from "../../utils/calculations";
import {
  tableToClipboardJSON,
  parsePastedJSONData,
} from "../../utils/dataTransform";
import {
  isValidNumber,
  canAddColumn,
  canAddPricingColumn,
} from "../../utils/validators";
import { Toast } from "./Shared/Toast";
import { DocumentHeader } from "./Header/DocumentHeader";
import { PreviewModeBanner } from "./Header/PreviewModeBanner";
import { VersionComparisonInfo } from "./Header/VersionComparisonInfo";
import { PasteDialog } from "./Dialogs/PasteDialog";
import { CategorySection } from "./Category/CategorySection";
import { StatisticsSummary } from "./Footer/StatisticsSummary";
import { TotalCalculation } from "./Footer/TotalCalculation";
import { TableWidthIndicator } from "./Shared/TableWidthIndicator";

// ── Shared normalizer (pure function, no side effects) ─────────────────────
const normalizeBackendCategories = (categories = []) => {
  const normalizeItem = (item, isChild = false) => {
    const valuesRaw =
      item.values instanceof Map
        ? Object.fromEntries(item.values)
        : item.values || {};

    const computedRaw =
      item.computed instanceof Map
        ? Object.fromEntries(item.computed)
        : item.computed || {};

    return {
      _id: item._id,
      isParent: (item.children || []).length > 0,
      isChild,
      // Preserve engine metadata so learning data survives save/load cycles
      canonicalRef:   item.canonicalRef   || null,
      canonicalStatus: item.canonicalStatus || "unresolved",
      rateSource:     item.rateSource     || "unrated",
      confidence:     item.confidence     || "none",
      children: (item.children || []).map((child) =>
        normalizeItem(child, true),
      ),
      ...valuesRaw,
      ...computedRaw,
    };
  };

  return (categories || []).map((cat) => ({
    _id: cat._id,
    name: cat.name,
    canonicalRef: cat.canonicalRef || null,
    expanded: true,
    columns: (cat.columns || []).map((col) => ({ ...col })),
    phases: (cat.items || []).map((item) => normalizeItem(item)),
  }));
};

// ── Save-side transform: local state → backend shape ──────────────────────
const buildBackendCategories = (categories) =>
  categories.map((cat, catOrder) => ({
    _id: cat._id,
    name: cat.name,
    order: catOrder,
    canonicalRef: cat.canonicalRef || null,
    columns: cat.columns || [],
    items: (cat.phases || []).map((phase, itemOrder) => {
      const buildItem = (row, order) => {
        const values = {};
        const computed = {};

        const calculatedIds = new Set(
          (cat.columns || [])
            .filter((col) => col.calculated)
            .map((col) => col.id),
        );

        const columnIds = new Set((cat.columns || []).map((col) => col.id));
        const autoComputedKeys = new Set(["square", "area", "total", "subtotal", "finalTotal", "directCost", "directMaterial", "directLabor", "wastageCost", "businessCost", "profit", "taxAmount", "grossMarginPct"]);

        Object.entries(row).forEach(([key, val]) => {
          if (["_id", "sno", "children", "isParent", "isChild"].includes(key))
            return;

          if (autoComputedKeys.has(key) || calculatedIds.has(key)) {
            computed[key] = val ?? 0;
          } else if (columnIds.has(key)) {
            values[key] = val ?? "";
          } else if (
            key.endsWith("_total") ||
            key.endsWith("_qty") ||
            key.endsWith("_rate")
          ) {
            values[key] = val ?? "";
          } else {
            computed[key] = val ?? 0;
          }
        });

        return {
          _id: row._id,
          order,
          values,
          computed,
          imageRefs: [],
          // Preserve engine learning metadata through every save cycle
          canonicalRef:    row.canonicalRef    || null,
          canonicalStatus: row.canonicalStatus || "unresolved",
          rateSource:      row.rateSource      || "unrated",
          confidence:      row.confidence      || "none",
          children: (row.children || []).map((child, idx) =>
            buildItem(child, idx),
          ),
        };
      };

      return buildItem(phase, itemOrder);
    }),
  }));

// ────────────────────────────────────────────────────────────────────────────

export default function EstimateBuilder() {
  const { projectId, estimateId } = useParams();
  const navigate = useNavigate();

  const [estimateData, setEstimateData] = useState(null);
  const [activeVersionData, setActiveVersionData] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [estimateInfo, setEstimateInfo] = useState(null);
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);

  const [editingCell, setEditingCell] = useState(null);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [cellFormats, setCellFormats] = useState({});
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(null);
  const [showColumnTypeMenu, setShowColumnTypeMenu] = useState(false);
  const [editingHeader, setEditingHeader] = useState(null);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteData, setPasteData] = useState("");
  const [pasteTarget, setPasteTarget] = useState(null);

  const { toast, showToast } = useToast();

  const {
    versions,
    selectedVersionId,
    viewMode,
    loadVersions,
    getActiveVersion,
    getSelectedVersion,
    selectVersion,
    exitPreview,
  } = useVersionHistory(showToast);

  const {
    draggedItemInfo,
    setDraggedItemInfo,
    dragOverItemInfo,
    setDragOverItemInfo,
    resetRowDrag,
    draggedCatIdx,
    setDraggedCatIdx,
    dragOverCatId,
    setDragOverCatId,
    resetCategoryDrag,
    draggedColumnInfo,
    setDraggedColumnInfo,
    dragOverColumnInfo,
    setDragOverColumnInfo,
    resetColumnDrag,
  } = useDragAndDrop();

  const {
    currentSelection,
    setCurrentSelection,
    editInputRef,
    applyFormat,
    handleTextSelect,
  } = useFormatting(
    editingCell,
    cellFormats,
    setCellFormats,
    () => {},
    showToast,
  );

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    const loadEstimate = async () => {
      if (!estimateId || estimateId === "new") {
        setEstimateData({
          estimateName: "",
          projectName: "",
          clientName: "",
          date: new Date().toLocaleDateString("en-GB"),
          status: "Draft",
          type: "PhaseItem",
          gst: 0,
          includedInTotal: false,
          notes: "",
          categories: [],
        });
        setIsEditMode(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await getEstimateByIdApi(estimateId);
        const { estimate, activeVersion } = response.data;

        if (!activeVersion) {
          // No active version yet — show empty state
          setEstimateData({
            estimateName: estimate.estimateName || "",
            projectName: estimate.projectId?.name || "",
            clientName: estimate.projectId?.clientName || "",
            date: new Date(estimate.createdAt).toLocaleDateString("en-GB"),
            status: estimate.status,
            type: "PhaseItem",
            gst: estimate.gst ?? 0,
            includedInTotal: estimate.includedInTotal ?? false,
            notes: "",
            categories: [],
          });
          setEstimateInfo(estimate);
          setIsLoading(false);
          return;
        }

        const normalizedCategories = normalizeBackendCategories(
          activeVersion.categories || [],
        );

        setActiveVersionData(normalizedCategories);
        setEstimateInfo(estimate);
        setEstimateData({
          estimateName: estimate.estimateName || "",
          projectName: estimate.projectId?.name || "",
          clientName: estimate.projectId?.clientName || "",
          date: new Date(estimate.createdAt).toLocaleDateString("en-GB"),
          status: estimate.status,
          type: "PhaseItem",
          gst: estimate.gst ?? 0,
          includedInTotal: estimate.includedInTotal ?? false,
          notes: "",
          categories: normalizedCategories,
        });

        setCellFormats(activeVersion.cellFormatting || {});
        setIsEditMode(false);

        // Load version metadata — NOT silent on initial load so active version is auto-selected
        const versionsResponse = await getEstimateVersionsApi(estimateId);
        loadVersions(versionsResponse.data);
      } catch (err) {
        console.error("Failed to load estimate:", err);
        showToast("Failed to load estimate", "error");
      } finally {
        setIsLoading(false);
      }
    };

    loadEstimate();
  }, [estimateId]);

  // ── Preview mode: load selected historical version ────────────────────────
  // ONLY runs when explicitly entering preview mode (not after save)
  useEffect(() => {
    if (!selectedVersionId || viewMode !== "preview") return;

    const loadSelectedVersion = async () => {
      try {
        const response = await getSingleEstimateVersionApi(
          estimateId,
          selectedVersionId,
        );
        const version = response.data;
        const normalized = normalizeBackendCategories(version.categories || []);
        setEstimateData((prev) => ({ ...prev, categories: normalized }));
        setCellFormats(version.cellFormatting || {});
        setSelectedCells(new Set());
        setEditingCell(null);
      } catch (err) {
        console.error("Failed to load selected version:", err);
        showToast("Failed to load version", "error");
      }
    };

    loadSelectedVersion();
  }, [selectedVersionId, viewMode]);

  // ── Version selection ─────────────────────────────────────────────────────
  const handleSelectVersion = (versionId) => {
    setIsEditMode(false);
    selectVersion(versionId);
    setIsVersionMenuOpen(false);
  };

  // ── Save estimate ─────────────────────────────────────────────────────────
  const handleSaveEstimate = async (
    summary = "Manual save",
    dataToSave = null,
    formatsToSave = null,
  ) => {
    try {
      setIsSaving(true);

      const saveData = dataToSave || estimateData;
      const saveFormats = formatsToSave || cellFormats;

      const backendCategories = buildBackendCategories(saveData.categories);

      const cellFormattingPayload = Object.entries(saveFormats)
        .map(([cellId, formats]) => {
          const [itemId, columnId] = cellId.split("_");
          const categoryId = saveData.categories.find((cat) =>
            (cat.phases || []).some((p) => p._id === itemId),
          )?._id;
          if (!categoryId) return null;
          return { categoryId, itemId, columnId, ranges: formats || [] };
        })
        .filter(Boolean);

      const backendData = {
        categories: backendCategories,
        cellFormatting: cellFormattingPayload,
        summary: String(summary),
      };

      if (estimateId && estimateId !== "new") {
        // ── 1. Update metadata ──────────────────────────────────────────────
        await updateEstimateMetaApi(estimateId, {
          estimateName: saveData.estimateName,
        });

        // ── 2. Save new version ─────────────────────────────────────────────
        await saveEstimateVersionApi(estimateId, backendData);
        await syncProjectFinanceApi(projectId);

        // ── 3. Reload active version from backend and sync local state ──────
        // THIS IS THE KEY FIX: always refresh estimateData.categories from
        // the backend response so the displayed data stays accurate.
        const updated = await getEstimateByIdApi(estimateId);
        const {
          estimate: updatedEstimate,
          activeVersion: updatedActiveVersion,
        } = updated.data;

        const freshCategories = normalizeBackendCategories(
          updatedActiveVersion?.categories || [],
        );

        setEstimateInfo(updatedEstimate);
        setActiveVersionData(freshCategories);

        // ✅ Sync estimateData.categories from backend — prevents stale/empty state
        setEstimateData((prev) => ({
          ...prev,
          estimateName: updatedEstimate.estimateName || prev.estimateName,
          status: updatedEstimate.status || prev.status,
          categories: freshCategories,
        }));

        setCellFormats(updatedActiveVersion?.cellFormatting || {});

        // ── 4. Refresh version list silently — do NOT change selectedVersionId
        //    so the preview useEffect never fires and wipes estimateData.categories.
        const versionsResponse = await getEstimateVersionsApi(estimateId);
        loadVersions(versionsResponse.data, true); // silent=true

        showToast("Estimate saved successfully!");
      } else {
        // ── New estimate: create + navigate ────────────────────────────────
        const createResponse = await createEstimateApi(projectId, {
          estimateName: saveData.estimateName || "Untitled Estimate",
          initialData: backendData,
        });

        showToast("Estimate created successfully!");

        const newEstimateId = createResponse.data.estimate._id;

        navigate(`/projects/${projectId}/quotes/${newEstimateId}`);
      }
    } catch (error) {
      console.error("Save failed:", error);
      showToast(
        error.response?.data?.error || "Failed to save estimate",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Restore version ───────────────────────────────────────────────────────
  const handleRestoreVersion = async () => {
    if (!selectedVersionId) return;
    setIsRestoring(true);

    try {
      const response = await getSingleEstimateVersionApi(
        estimateId,
        selectedVersionId,
      );
      const version = response.data;

      // Save the historical version as a new active version
      const backendData = {
        categories: version.categories,
        cellFormatting: version.cellFormatting || [],
        summary: `Restored from v${version.version}`,
      };
      await saveEstimateVersionApi(estimateId, backendData);

      // Reload everything cleanly
      const refreshed = await getEstimateByIdApi(estimateId);
      const { activeVersion } = refreshed.data;

      const refreshedNormalized = normalizeBackendCategories(
        activeVersion?.categories || [],
      );

      setEstimateData((prev) => ({
        ...prev,
        categories: refreshedNormalized,
      }));
      setCellFormats(activeVersion?.cellFormatting || {});
      setActiveVersionData(refreshedNormalized);

      const versionsResponse = await getEstimateVersionsApi(estimateId);
      loadVersions(versionsResponse.data, true); // silent — exitPreview handles selectedVersionId

      selectVersion(null);
      exitPreview();

      showToast("Version restored successfully!");
    } catch (error) {
      console.error("Restore failed:", error);
      showToast("Failed to restore version", "error");
    } finally {
      setIsRestoring(false);
    }
  };

  // ── Exit preview ──────────────────────────────────────────────────────────
  const handleExitPreview = async () => {
    try {
      const response = await getEstimateByIdApi(estimateId);
      const { activeVersion } = response.data;
      const normalized = normalizeBackendCategories(
        activeVersion?.categories || [],
      );
      setEstimateData((prev) => ({ ...prev, categories: normalized }));
      setCellFormats(activeVersion?.cellFormatting || {});
      exitPreview();
    } catch (err) {
      console.error("Failed to exit preview:", err);
      showToast("Failed to load active version", "error");
    }
  };

  // ── Lock / Unlock ─────────────────────────────────────────────────────────
  const handleLockEstimate = async () => {
    if (!estimateId || estimateId === "new") return;
    try {
      await lockEstimateApi(estimateId);
      // Reload from backend after lock so confidence badges and rateSource
      // reflect what the engine learned — also confirms the lock status is saved.
      const refreshed = await getEstimateByIdApi(estimateId);
      const { estimate: refreshedEstimate, activeVersion: refreshedVersion } = refreshed.data;
      const freshCategories = normalizeBackendCategories(refreshedVersion?.categories || []);
      setEstimateInfo(refreshedEstimate);
      setActiveVersionData(freshCategories);
      setEstimateData((prev) => ({ ...prev, categories: freshCategories, status: "Locked" }));
      setIsEditMode(false);
      showToast("Estimate locked — engine trained from your rates!");
    } catch (error) {
      console.error("Lock failed:", error);
      showToast("Failed to lock estimate", "error");
    }
  };

  const handleUnlockEstimate = async () => {
    if (!estimateId || estimateId === "new") return;
    try {
      await unlockEstimateApi(estimateId);
      setEstimateInfo((prev) => ({ ...prev, status: "Draft" }));
      setIsEditMode(false);
      showToast("Estimate unlocked — you can now edit rates.");
    } catch (error) {
      showToast("Failed to unlock estimate", "error");
    }
  };

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const getTableJSON = (catIdx) =>
    tableToClipboardJSON(estimateData.categories[catIdx]);

  const copyTableData = (catIdx) => {
    const text = tableToClipboardJSON(estimateData.categories[catIdx]);
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("Table data copied to clipboard!"))
      .catch(() => showToast("Failed to copy data", "error"));
  };

  const handlePasteData = (catIdx) => {
    const category = estimateData.categories[catIdx];
    try {
      const { columns, rows } = parsePastedJSONData(pasteData, category);
      const newCategories = [...estimateData.categories];
      if (columns?.length) newCategories[catIdx].columns = columns;
      newCategories[catIdx].phases = rows;
      setEstimateData({ ...estimateData, categories: newCategories });
      showToast("Table replaced successfully!");
    } catch (err) {
      showToast(err.message, "error");
    }
    setShowPasteDialog(false);
    setPasteData("");
    setPasteTarget(null);
  };

  // ── Category handlers ─────────────────────────────────────────────────────
  const addNewCategory = () => {
    const newCat = {
      _id: `cat_${Date.now()}`,
      name: "NEW SECTION",
      expanded: true,
      columns: initializeColumnPercentages(
        JSON.parse(JSON.stringify(DEFAULT_COLUMNS)),
      ),
      phases: [],
    };
    setEstimateData({
      ...estimateData,
      categories: [...estimateData.categories, newCat],
    });
    setActiveCategoryIdx(estimateData.categories.length);
    showToast("Category created");
  };

  const handleCategoryDrop = (targetIdx) => {
    if (draggedCatIdx === null || draggedCatIdx === targetIdx) return;
    const newCategories = [...estimateData.categories];
    const [moved] = newCategories.splice(draggedCatIdx, 1);
    newCategories.splice(targetIdx, 0, moved);
    setEstimateData({ ...estimateData, categories: newCategories });
    resetCategoryDrag();
    showToast("Section position updated");
  };

  const deleteCategory = (id) => {
    setEstimateData({
      ...estimateData,
      categories: estimateData.categories.filter((c) => c._id !== id),
    });
    setActiveCategoryIdx(null);
  };

  // ── Column handlers ───────────────────────────────────────────────────────
  const addNewColumn = (type, catIdx) => {
    const targetCat = estimateData.categories[catIdx];

    // ─────────────── SNO SPECIAL CASE ───────────────

    // ─────────────── EXISTING LOGIC BELOW ───────────────
    if (type === "pricing") {
      if (!canAddPricingColumn(targetCat.columns.length, MAX_COLUMNS)) {
        showToast(`Maximum limit of ${MAX_COLUMNS} columns reached.`, "error");
        return;
      }
    } else {
      if (!canAddColumn(targetCat.columns.length, MAX_COLUMNS)) {
        showToast(`Maximum limit of ${MAX_COLUMNS} columns reached.`, "error");
        return;
      }
    }
    if (type === "sno") {
      const targetCat = estimateData.categories[catIdx];
      const hasSno = targetCat.columns.some((col) => col.id === "sno");

      if (hasSno) {
        showToast("S.No already exists", "warning");
        return;
      }

      const newCategories = [...estimateData.categories];

      newCategories[catIdx].columns.unshift({
        id: "sno",
        name: "S.No",
        type: "number",
        width: 60,
        required: false,
        fixed: false,
      });

      setEstimateData({ ...estimateData, categories: newCategories });
      showToast("S.No column added");
      return;
    }
    const newCategories = [...estimateData.categories];

    if (type === "pricing") {
      const baseId = `pricing_${Date.now()}`;
      newCategories[catIdx].columns.push(
        { id: `${baseId}_rate`, name: "Rate", type: "currency", width: 120 },
        { id: `${baseId}_qty`, name: "Qty", type: "number", width: 100 },
        {
          id: `${baseId}_total`,
          name: "Amount",
          type: "currency",
          width: 140,
          calculated: true,
          link: baseId,
        },
      );
    } else {
      newCategories[catIdx].columns.push({
        id: `col_${Date.now()}`,
        name: "New Field",
        type,
        width: 150,
      });
    }

    newCategories[catIdx].columns = recalculateColumnPercentages(
      newCategories[catIdx].columns,
    );

    setEstimateData({ ...estimateData, categories: newCategories });
    setShowColumnTypeMenu(false);
  };

  const replicateColumn = (catIdx, colIdx) => {
    const targetCat = estimateData.categories[catIdx];
    const userColumnCount = targetCat.columns.filter(
      (col) => col.id !== "sno",
    ).length;

    if (!canAddColumn(userColumnCount, MAX_COLUMNS)) {
      showToast(`Maximum limit of ${MAX_COLUMNS} columns reached.`, "error");
      return;
    }
    const sourceCol = targetCat.columns[colIdx];
    const newCol = {
      ...JSON.parse(JSON.stringify(sourceCol)),
      id: `${sourceCol.id}_dup_${Date.now()}`,
      name: `${sourceCol.name} (Copy)`,
      required: false,
      fixed: false,
    };
    const newCategories = [...estimateData.categories];
    newCategories[catIdx].columns.splice(colIdx + 1, 0, newCol);
    newCategories[catIdx].columns = recalculateColumnPercentages(
      newCategories[catIdx].columns,
    );
    setEstimateData({ ...estimateData, categories: newCategories });
    showToast("Field replicated");
  };

  const deleteColumn = (catIdx, colId) => {
    const newCategories = [...estimateData.categories];
    newCategories[catIdx].columns = newCategories[catIdx].columns.filter(
      (c) => c.id !== colId,
    );
    newCategories[catIdx].columns = recalculateColumnPercentages(
      newCategories[catIdx].columns,
    );
    setEstimateData({ ...estimateData, categories: newCategories });
    showToast("Column removed");
  };

  const handleColumnDrop = (targetCatIdx, targetColIdx) => {
    if (!draggedColumnInfo) return;
    const { catIdx: sourceCatIdx, colIdx: sourceColIdx } = draggedColumnInfo;
    if (sourceCatIdx !== targetCatIdx || sourceColIdx === targetColIdx) {
      resetColumnDrag();
      return;
    }
    const newCategories = [...estimateData.categories];
    const columns = [...newCategories[sourceCatIdx].columns];
    const [movedColumn] = columns.splice(sourceColIdx, 1);
    columns.splice(targetColIdx, 0, movedColumn);
    newCategories[sourceCatIdx].columns = columns;
    setEstimateData({ ...estimateData, categories: newCategories });
    resetColumnDrag();
    showToast("Column position updated");
  };

  const handleResizeStart = (e, catIdx, colId) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const category = estimateData.categories[catIdx];
    const currentColumn = category.columns.find((c) => c.id === colId);
    const initialWidth = currentColumn.width || 100;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;

      // getValidatedColumnWidth enforces all four rules:
      //   1. MIN_COL_WIDTH   (60px)   — per-column floor
      //   2. MAX_COL_WIDTH   (500px)  — per-column ceiling
      //   3. MAX_TABLE_WIDTH (1800px) — total ceiling
      //   4. MIN_TABLE_WIDTH (640px)  — total floor; blocks shrink below minimum
      const newWidth = getValidatedColumnWidth(
        category.columns,
        colId,
        initialWidth + diff,
      );

      setEstimateData((prev) => {
        const newCategories = [...prev.categories];
        newCategories[catIdx] = {
          ...newCategories[catIdx],
          columns: recalculateColumnPercentages(
            newCategories[catIdx].columns.map((c) =>
              c.id === colId ? { ...c, width: newWidth } : c,
            ),
          ),
        };
        return { ...prev, categories: newCategories };
      });
    };

    const onMouseUp = () => {
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // Read latest state just for toast — return prev to avoid extra re-render
      setEstimateData((prev) => {
        const cat = prev.categories[catIdx];
        const totalWidth = getTableWidth(cat.columns);
        const col = cat.columns.find((c) => c.id === colId);

        if (totalWidth >= MAX_TABLE_WIDTH) {
          showToast(
            `Maximum table width reached (${MAX_TABLE_WIDTH}px)`,
            "warning",
          );
        } else if (totalWidth <= MIN_TABLE_WIDTH) {
          showToast(`Minimum table width is ${MIN_TABLE_WIDTH}px`, "warning");
        } else if (col?.width >= MAX_COL_WIDTH) {
          showToast(
            `Maximum column width (${MAX_COL_WIDTH}px) reached`,
            "warning",
          );
        } else if (col?.width <= MIN_COL_WIDTH) {
          showToast(`Minimum column width is ${MIN_COL_WIDTH}px`, "warning");
        }

        return prev;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // ── Row handlers ──────────────────────────────────────────────────────────
  const handleItemDrop = (targetCatIdx, targetInsertIdx) => {
    if (!draggedItemInfo) return;

    const { catIdx: sourceCatIdx, phaseIdx: sourcePhaseIdx } = draggedItemInfo;

    const newCategories = JSON.parse(JSON.stringify(estimateData.categories));

    // ── Step 1: remove from source ───────────────────────────────────────────
    const [movedItem] = newCategories[sourceCatIdx].phases.splice(
      sourcePhaseIdx,
      1,
    );

    // ── Step 2: correct insert index for same-category downward moves ─────────
    // After the splice the array is 1 shorter. Any targetInsertIdx that was
    // pointing to a position after the source slot is now 1 too high.
    let insertIdx = targetInsertIdx;
    if (sourceCatIdx === targetCatIdx && targetInsertIdx > sourcePhaseIdx) {
      insertIdx -= 1;
    }

    // ── Step 3: no-op guard ──────────────────────────────────────────────────
    // If after correction the item would land back in the same spot, bail out.
    if (sourceCatIdx === targetCatIdx && insertIdx === sourcePhaseIdx) {
      resetRowDrag();
      return;
    }

    // ── Step 4: insert ───────────────────────────────────────────────────────
    if (insertIdx < 0) {
      // −1 means "append to end" (used by CategorySection's onDropCapture)
      newCategories[targetCatIdx].phases.push(movedItem);
    } else {
      newCategories[targetCatIdx].phases.splice(insertIdx, 0, movedItem);
    }

    setEstimateData({ ...estimateData, categories: newCategories });
    resetRowDrag();
    showToast("Item position updated");
  };
  const handleCellChange = (catIdx, phaseId, colId, value, colType) => {
    if (colType === "number" || colType === "currency") {
      if (!isValidNumber(value)) return;
    }

    const newCategories = [...estimateData.categories];
    const cat = newCategories[catIdx];

    const updateRows = (rows) =>
      rows.map((row) => {
        if (row._id === phaseId) {
          const updated = { ...row, [colId]: value };

          if (["height", "width", "rate"].includes(colId)) {
            updated.square = calculateArea(updated.height, updated.width);
            updated.total = calculateTotal(updated.square, updated.rate);
          }

          if (colId.includes("pricing_")) {
            const base = colId.split("_").slice(0, 2).join("_");
            updated[`${base}_total`] = calculatePricingTotal(
              updated[`${base}_rate`],
              updated[`${base}_qty`],
            );
          }

          // Recompute subtotal/finalTotal when engine rate/quantity columns change
          if (["materialRate", "laborRate", "quantity"].includes(colId)) {
            const qty = parseFloat(updated.quantity) || 0;
            const mr  = parseFloat(updated.materialRate) || 0;
            const lr  = parseFloat(updated.laborRate) || 0;
            updated.subtotal   = parseFloat((qty * (mr + lr)).toFixed(2));
            updated.finalTotal = parseFloat((updated.subtotal * 1.18).toFixed(2));
            // Mark as manually set so lock-time learning picks it up
            updated.rateSource = "manual";
          }

          return updated;
        }

        if (row.children?.length) {
          return {
            ...row,
            children: updateRows(row.children),
          };
        }

        return row;
      });

    cat.phases = updateRows(cat.phases);
    const calculateParentTotals = (rows) =>
      rows.map((row) => {
        if (row.children?.length) {
          const updatedChildren = calculateParentTotals(row.children);
          const total = updatedChildren.reduce(
            (sum, child) => sum + (Number(child.total) || 0),
            0,
          );
          return {
            ...row,
            total,
            children: updatedChildren,
          };
        }
        return row;
      });

    cat.phases = calculateParentTotals(cat.phases);
    setEstimateData({ ...estimateData, categories: newCategories });
  };

  const handleImageUpload = (catIdx, phaseId, colId) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const response = await uploadEstimateItemImageApi(
          estimateId,
          phaseId,
          colId,
          file,
        );
        handleCellChange(catIdx, phaseId, colId, response.data.imageUrl);
        showToast("Image uploaded successfully!");
      } catch (error) {
        showToast("Image upload failed", "error");
      }
    };
    input.click();
  };

  // ── Derived totals ────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => calculateSubtotal(estimateData?.categories || []),
    [estimateData],
  );
  const grandTotal = estimateData?.includedInTotal
    ? calculateGrandTotal(subtotal, estimateData?.gst || 0)
    : subtotal;

  // ── Render guards ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="relative w-full min-h-[60vh] flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl border-2 border-dashed border-slate-200">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 border-4 border-indigo-100 rounded-full animate-ping opacity-25" />
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin relative z-10" />
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
            Fetching Estimate
          </h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
          </div>
        </div>
      </div>
    );
  }

  if (!estimateData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500">No estimate data found.</p>
      </div>
    );
  }

  const selectedVersion = {
    version: selectedVersionId,
    categories: estimateData?.categories || [],
  };
  const activeVersion = {
    version: estimateInfo?.currentVersion,
    categories: activeVersionData || [],
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      <Toast toast={toast} />

      <PasteDialog
        showPasteDialog={showPasteDialog}
        setShowPasteDialog={setShowPasteDialog}
        pasteData={pasteData}
        setPasteData={setPasteData}
        pasteTarget={pasteTarget}
        setPasteTarget={setPasteTarget}
        handlePasteData={handlePasteData}
      />

      {viewMode === "preview" && selectedVersion ? (
        <PreviewModeBanner
          selectedVersion={selectedVersion}
          onRestore={handleRestoreVersion}
          onExitPreview={handleExitPreview}
          estimateStatus={estimateInfo?.status}
          isRestoring={isRestoring}
        />
      ) : (
        <DocumentHeader
          estimateData={estimateData}
          setEstimateData={setEstimateData}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onSave={handleSaveEstimate}
          onLock={handleLockEstimate}
          onUnlock={handleUnlockEstimate}
          isSaving={isSaving}
          estimateInfo={estimateInfo}
          versions={versions}
          selectedVersionId={selectedVersionId}
          viewMode={viewMode}
          onSelectVersion={handleSelectVersion}
          isVersionMenuOpen={isVersionMenuOpen}
          onToggleVersionMenu={setIsVersionMenuOpen}
        />
      )}

      <div className="py-4 px-6 space-y-6">
        {viewMode === "preview" && selectedVersion && activeVersion && (
          <VersionComparisonInfo
            selectedVersion={selectedVersion}
            activeVersion={activeVersion}
          />
        )}

        <div className="space-y-12 pb-12">
          {estimateData.categories.map((category, catIdx) => {
            const tableWidth = getTableWidth(category.columns);
            return (
              <div key={category._id}>
                {isEditMode && viewMode === "editing" && (
                  <div className="mb-3 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
                    <TableWidthIndicator
                      totalWidth={tableWidth}
                      isEditMode={isEditMode}
                    />
                  </div>
                )}

                <CategorySection
                  category={category}
                  catIdx={catIdx}
                  isEditMode={isEditMode && viewMode === "editing"}
                  activeCategoryIdx={activeCategoryIdx}
                  setActiveCategoryIdx={setActiveCategoryIdx}
                  draggedCatIdx={draggedCatIdx}
                  setDraggedCatIdx={setDraggedCatIdx}
                  dragOverCatId={dragOverCatId}
                  setDragOverCatId={setDragOverCatId}
                  handleCategoryDrop={handleCategoryDrop}
                  estimateData={estimateData}
                  setEstimateData={setEstimateData}
                  deleteCategory={deleteCategory}
                  tableWidth={tableWidth}
                  currentSelection={currentSelection}
                  applyFormat={applyFormat}
                  copyTableData={copyTableData}
                  getTableJSON={getTableJSON} // ← ensure this is present
                  setPasteData={setPasteData}
                  showColumnTypeMenu={showColumnTypeMenu}
                  setShowColumnTypeMenu={setShowColumnTypeMenu}
                  addNewColumn={addNewColumn}
                  setPasteTarget={setPasteTarget}
                  setShowPasteDialog={setShowPasteDialog}
                  editingHeader={editingHeader}
                  setEditingHeader={setEditingHeader}
                  replicateColumn={replicateColumn}
                  deleteColumn={deleteColumn}
                  draggedColumnInfo={draggedColumnInfo}
                  setDraggedColumnInfo={setDraggedColumnInfo}
                  dragOverColumnInfo={dragOverColumnInfo}
                  setDragOverColumnInfo={setDragOverColumnInfo}
                  handleColumnDrop={handleColumnDrop}
                  handleResizeStart={handleResizeStart}
                  draggedItemInfo={draggedItemInfo}
                  setDraggedItemInfo={setDraggedItemInfo}
                  dragOverItemInfo={dragOverItemInfo}
                  setDragOverItemInfo={setDragOverItemInfo}
                  handleItemDrop={handleItemDrop}
                  selectedCells={selectedCells}
                  setSelectedCells={setSelectedCells}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  editInputRef={editInputRef}
                  handleCellChange={handleCellChange}
                  handleTextSelect={handleTextSelect}
                  setCurrentSelection={setCurrentSelection}
                  handleImageUpload={handleImageUpload}
                  cellFormats={cellFormats}
                />
              </div>
            );
          })}

          {isEditMode && viewMode === "editing" && (
            <div className="pt-4">
              <button
                onClick={addNewCategory}
                className="w-full py-10 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all group"
              >
                <Layers
                  size={32}
                  className="mb-2 group-hover:scale-110 transition-transform"
                />
                <span className="font-bold text-sm uppercase tracking-[0.2em]">
                  Add New Estimate Section
                </span>
              </button>
            </div>
          )}
        </div>

        <div
          className={`bg-white border-2 rounded-xl p-6 flex flex-col md:flex-row justify-between items-end gap-6 shadow-lg relative overflow-hidden transition-all duration-500 ${
            viewMode === "preview"
              ? "border-[#f58d51] shadow-orange-100"
              : isEditMode
                ? "border-indigo-600 shadow-indigo-100"
                : "border-slate-900"
          }`}
        >
          <div
            className={`absolute top-0 left-0 w-1.5 h-full transition-colors duration-500 ${
              viewMode === "preview"
                ? "bg-[#f58d51]"
                : isEditMode
                  ? "bg-indigo-600"
                  : "bg-slate-900"
            }`}
          />
          <div className="flex-1">
            <StatisticsSummary
              estimateData={estimateData}
              isEditMode={isEditMode}
              viewMode={viewMode}
            />
          </div>
          <div className="shrink-0">
            <TotalCalculation
              subtotal={subtotal}
              grandTotal={grandTotal}
              isEditMode={isEditMode}
              viewMode={viewMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
