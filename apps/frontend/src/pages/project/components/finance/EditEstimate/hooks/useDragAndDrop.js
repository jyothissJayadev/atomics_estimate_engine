import { useState, useCallback } from "react";

export const useDragAndDrop = () => {
  // ── Row drag ───────────────────────────────────────────────────────────────
  const [draggedItemInfo, setDraggedItemInfo] = useState(null);
  const [dragOverItemInfo, setDragOverItemInfo] = useState(null);

  // ── Category drag ──────────────────────────────────────────────────────────
  const [draggedCatIdx, setDraggedCatIdx] = useState(null);
  const [dragOverCatId, setDragOverCatId] = useState(null);

  // ── Column drag ────────────────────────────────────────────────────────────
  const [draggedColumnInfo, setDraggedColumnInfo] = useState(null);
  const [dragOverColumnInfo, setDragOverColumnInfo] = useState(null);

  const resetRowDrag = useCallback(() => {
    setDraggedItemInfo(null);
    setDragOverItemInfo(null);
  }, []);

  const resetCategoryDrag = useCallback(() => {
    setDraggedCatIdx(null);
    setDragOverCatId(null);
  }, []);

  const resetColumnDrag = useCallback(() => {
    setDraggedColumnInfo(null);
    setDragOverColumnInfo(null);
  }, []);

  return {
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
  };
};