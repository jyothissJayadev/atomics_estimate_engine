import { useState, useRef } from "react";

export const useFormatting = (
  editingCell,
  cellFormats,
  setCellFormats,
  saveToUndoStack,
  showToast,
) => {
  const [currentSelection, setCurrentSelection] = useState(null);
  const editInputRef = useRef(null);

  const applyFormat = (formatType) => {
    if (!currentSelection || !editingCell) {
      showToast("Please select text to format", "error");
      return;
    }

    const { start, end } = currentSelection;
    if (start === end) {
      showToast("Please select text to format", "error");
      return;
    }

    saveToUndoStack();
    const newFormats = { ...cellFormats };
    if (!newFormats[editingCell]) {
      newFormats[editingCell] = [];
    }

    const existingFormatIndex = newFormats[editingCell].findIndex(
      (fmt) =>
        fmt.start === start && fmt.end === end && fmt.type === formatType,
    );

    if (existingFormatIndex >= 0) {
      newFormats[editingCell].splice(existingFormatIndex, 1);
      showToast(`${formatType} removed`, "success");
    } else {
      newFormats[editingCell].push({
        start,
        end,
        type: formatType,
      });
      showToast(`${formatType} applied`, "success");
    }

    setCellFormats(newFormats);

    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.setSelectionRange(start, end);
      }
    }, 0);
  };

  const handleTextSelect = (e) => {
    const target = e.target;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    if (start !== end) {
      setCurrentSelection({ start, end });
    } else {
      setCurrentSelection(null);
    }
  };

  return {
    currentSelection,
    setCurrentSelection,
    editInputRef,
    applyFormat,
    handleTextSelect,
  };
};
