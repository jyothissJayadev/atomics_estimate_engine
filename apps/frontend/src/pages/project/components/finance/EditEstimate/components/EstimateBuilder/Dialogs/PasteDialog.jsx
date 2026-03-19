import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export const PasteDialog = ({
  showPasteDialog,
  setShowPasteDialog,
  pasteData,
  setPasteData,
  pasteTarget,
  setPasteTarget,
  handlePasteData,
}) => {
  const textareaRef = useRef(null);

  // Auto-focus + select all content when dialog opens
  useEffect(() => {
    if (showPasteDialog && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [showPasteDialog]);

  if (!showPasteDialog) return null;

  const closeDialog = () => {
    setShowPasteDialog(false);
    setPasteData("");
    setPasteTarget(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300]">
      <div className="bg-white rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-lg">Paste Table JSON</h3>
          <button
            onClick={closeDialog}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-auto">
          <p className="text-sm text-slate-600 mb-3">
            Paste table data in <strong>JSON format</strong>. Existing rows will
            be <strong>fully replaced</strong>.
          </p>

          <textarea
            ref={textareaRef}
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            className="w-full h-72 p-3 border border-slate-300 rounded font-mono text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder={`{
  "columns": [
    { "id": "item", "name": "Item", "type": "text" },
    { "id": "rate", "name": "Rate", "type": "currency" }
  ],
  "rows": [
    { "item": "Wood Door", "rate": 1200 }
  ]
}`}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={closeDialog}
            className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
          >
            Cancel
          </button>

          {/* ✅ Explicit destructive paste */}
          <button
            onClick={() => handlePasteData(pasteTarget)}
            className="px-5 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700"
          >
            Paste & Replace
          </button>
        </div>
      </div>
    </div>
  );
};
