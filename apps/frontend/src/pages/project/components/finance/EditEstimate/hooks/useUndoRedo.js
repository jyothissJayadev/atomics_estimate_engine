import { useState, useCallback } from "react";

export const useUndoRedo = (
  estimateData,
  cellFormats,
  setEstimateData,
  setCellFormats,
  showToast,
) => {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const saveToUndoStack = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-49),
      JSON.parse(JSON.stringify({ data: estimateData, formats: cellFormats })),
    ]);
    setRedoStack([]);
  }, [estimateData, cellFormats]);

  const undo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [
      ...prev,
      JSON.parse(JSON.stringify({ data: estimateData, formats: cellFormats })),
    ]);
    setUndoStack((prev) => prev.slice(0, -1));
    setEstimateData(last.data);
    setCellFormats(last.formats || {});
    showToast("Undo successful");
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [
      ...prev,
      JSON.parse(JSON.stringify({ data: estimateData, formats: cellFormats })),
    ]);
    setRedoStack((prev) => prev.slice(0, -1));
    setEstimateData(next.data);
    setCellFormats(next.formats || {});
    showToast("Redo successful");
  };

  return {
    undoStack,
    redoStack,
    saveToUndoStack,
    undo,
    redo,
  };
};
