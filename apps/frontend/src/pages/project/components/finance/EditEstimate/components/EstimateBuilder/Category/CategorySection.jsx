import React from "react";
import { CategoryHeader } from "./CategoryHeader";
import { CategoryToolbar } from "./CategoryToolbar";
import { CategoryTable } from "./CategoryTable";

export const CategorySection = ({
  category,
  catIdx,
  isEditMode,
  activeCategoryIdx,
  setActiveCategoryIdx,
  draggedCatIdx,
  setDraggedCatIdx,
  dragOverCatId,
  setDragOverCatId,
  handleCategoryDrop,
  estimateData,
  setEstimateData,
  deleteCategory,
  tableWidth,
  currentSelection,
  applyFormat,
  copyTableData,
  getTableJSON, // ← destructured here, forwarded to CategoryToolbar only
  setPasteData,
  showColumnTypeMenu,
  setShowColumnTypeMenu,
  addNewColumn,
  setPasteTarget,
  setShowPasteDialog,
  editingHeader,
  setEditingHeader,
  replicateColumn,
  deleteColumn,
  draggedColumnInfo,
  setDraggedColumnInfo,
  dragOverColumnInfo,
  setDragOverColumnInfo,
  handleColumnDrop,
  handleResizeStart,
  draggedItemInfo,
  setDraggedItemInfo,
  dragOverItemInfo,
  setDragOverItemInfo,
  handleItemDrop,
  selectedCells,
  setSelectedCells,
  editingCell,
  setEditingCell,
  editInputRef,
  handleCellChange,
  handleTextSelect,
  setCurrentSelection,
  handleImageUpload,
  cellFormats,
  saveToUndoStack,
}) => {
  const isSelected = activeCategoryIdx === catIdx && isEditMode;
  const isBeingDragged = draggedCatIdx === catIdx;
  const isDragOver = dragOverCatId === category._id;

  return (
    <div
      key={category._id}
      onClick={() => isEditMode && setActiveCategoryIdx(catIdx)}
      onDragOver={(e) => {
        if (!isEditMode || draggedCatIdx === null) return;
        e.preventDefault();
        setDragOverCatId(category._id);
      }}
      onDrop={() => {
        if (isEditMode && draggedCatIdx !== null) handleCategoryDrop(catIdx);
      }}
      onDragEnd={() => {
        setDraggedCatIdx(null);
        setDragOverCatId(null);
      }}
      className={`bg-white border relative transition-all 
        ${isSelected ? "border-indigo-400 shadow-xl" : "border-slate-200 shadow-sm"}
        ${isBeingDragged ? "opacity-30 scale-95" : "opacity-100 scale-100"}
        ${isDragOver ? "border-t-4 border-t-indigo-500" : ""}`}
      onDragOverCapture={(e) => {
        if (!isEditMode || !draggedItemInfo) return;
        e.preventDefault();
      }}
      onDropCapture={() => {
        if (isEditMode && draggedItemInfo) handleItemDrop(catIdx, -1);
      }}
    >
      {/* ── Ribbon Toolbar (edit mode, active category only) ── */}
      {isSelected && (
        <CategoryToolbar
          catIdx={catIdx}
          category={category}
          currentSelection={currentSelection}
          applyFormat={applyFormat}
          copyTableData={copyTableData}
          getTableJSON={getTableJSON} // ← forwarded here
          setPasteData={setPasteData}
          showColumnTypeMenu={showColumnTypeMenu}
          setShowColumnTypeMenu={setShowColumnTypeMenu}
          addNewColumn={addNewColumn}
          setPasteTarget={setPasteTarget}
          setShowPasteDialog={setShowPasteDialog}
        />
      )}

      {/* ── Section Header ── */}
      <CategoryHeader
        category={category}
        catIdx={catIdx}
        isEditMode={isEditMode}
        estimateData={estimateData}
        setEstimateData={setEstimateData}
        setDraggedCatIdx={setDraggedCatIdx}
        deleteCategory={deleteCategory}
      />

      {/* ── Table ── */}
      {category.expanded && (
        <CategoryTable
          category={category}
          catIdx={catIdx}
          isEditMode={isEditMode}
          editingHeader={editingHeader}
          setEditingHeader={setEditingHeader}
          estimateData={estimateData}
          setEstimateData={setEstimateData}
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
          saveToUndoStack={saveToUndoStack}
        />
      )}
    </div>
  );
};
