import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Settings2,
  Save,
  Lock,
  LockOpen,
  ArrowLeft,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  X,
  Brain,
  CheckCircle2,
} from "lucide-react";
import { VersionHistoryPanel } from "./VersionHistoryPanel";

// ── Lock Confirmation Modal ──────────────────────────────────────────────────
const LockConfirmModal = ({ isOpen, onConfirm, onCancel, isSaving }) => {
  if (!isOpen) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 420, width: "100%",
        padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: "#ecfdf5",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Brain size={20} style={{ color: "#059669" }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111", margin: 0 }}>
              Lock &amp; Train Engine
            </h3>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
              This estimate will become read-only
            </p>
          </div>
        </div>

        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0",
          borderRadius: 10, padding: "12px 14px", marginBottom: 18,
        }}>
          <p style={{ fontSize: 13, color: "#065f46", margin: 0, lineHeight: 1.5 }}>
            <strong>The engine will learn from your finalized rates and quantities.</strong>
            {" "}Your next estimate will use these as the starting point, improving accuracy over time.
          </p>
        </div>

        <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
          <li>Rates you confirmed → learned into your profile</li>
          <li>Quantities → used to calibrate future predictions</li>
          <li>Sections kept / removed → adjusts next prediction</li>
        </ul>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} disabled={isSaving} style={{
            padding: "9px 20px", borderRadius: 10, border: "1px solid #e5e7eb",
            background: "#fff", fontSize: 13, fontWeight: 600, color: "#374151",
            cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isSaving} style={{
            padding: "9px 20px", borderRadius: 10, border: "none",
            background: "#059669", color: "#fff",
            fontSize: 13, fontWeight: 600,
            cursor: isSaving ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 7,
            opacity: isSaving ? 0.7 : 1,
          }}>
            {isSaving
              ? <><span style={{ width: 13, height: 13, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Locking…</>
              : <><Lock size={13} /> Lock & Train</>
            }
          </button>
        </div>
      </div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
};

export const DocumentHeader = ({
  estimateData,
  setEstimateData,
  isEditMode,
  setIsEditMode,
  onSave,
  onLock,
  onUnlock,
  onDelete,
  isSaving,
  estimateInfo,
  versions,
  selectedVersionId,
  viewMode,
  onSelectVersion,
  isVersionMenuOpen,
  onToggleVersionMenu,
}) => {
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [isLocking, setIsLocking] = useState(false);

  const isLocked = estimateInfo?.status === "Locked";
  const isDraft = estimateInfo?.status === "Draft" || !estimateInfo;
  const rawName = estimateData?.estimateName || "Untitled Estimate";

  // 25-character limit for display
  const estimateName =
    rawName.length > 25 ? rawName.substring(0, 25) + "..." : rawName;
  const { projectId } = useParams();

  const handleSaveChanges = () => {
    setIsEditMode(false);
    if (isDraft) onSave();
  };

  const confirmDelete = () => {
    if (confirmName === rawName) {
      onDelete?.();
      setIsDeleteModalOpen(false);
      setConfirmName("");
    }
  };

  return (
    <>
      {/* DYNAMIC BACKGROUND: 
         Standard: bg-[#107c41] (Green)
         Edit Mode: bg-[#1e40af] (Blue/Indigo)
      */}
      <header
        className={`sticky top-14 z-40 transition-colors duration-500 border-b shadow-md ${
          isEditMode
            ? "bg-indigo-900 border-indigo-700"
            : "bg-[#107c41] border-emerald-800"
        }`}
      >
        <div className="max-w-full mx-auto px-4 h-11 flex items-center justify-between gap-4">
          {/* LEFT: Unified Info Line */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => navigate(`/projects/${projectId}/quotes`)}
              className={`p-1.5 rounded transition-colors ${
                isEditMode
                  ? "hover:bg-indigo-800 text-indigo-100"
                  : "hover:bg-[#0d6635] text-emerald-50"
              }`}
            >
              <ArrowLeft size={16} />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <FileSpreadsheet
                size={16}
                className={isEditMode ? "text-indigo-300" : "text-emerald-300"}
              />

              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <span className="animate-pulse w-2 h-2 rounded-full bg-white shadow-[0_0_8px_white]" />
                  <input
                    autoFocus
                    maxLength={25}
                    className="font-bold text-white border-b-2 border-white bg-white/10 rounded-t px-2 py-0.5 outline-none w-56 placeholder:text-white/50"
                    placeholder="Enter Estimate Name"
                    value={estimateData?.estimateName || ""}
                    onChange={(e) =>
                      setEstimateData((prev) => ({
                        ...prev,
                        estimateName: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : (
                <h1 className="font-bold text-white whitespace-nowrap">
                  {estimateName}
                </h1>
              )}

              <div
                className={`flex items-center gap-3 text-[11px] whitespace-nowrap ml-2 border-l pl-3 transition-colors ${
                  isEditMode
                    ? "text-indigo-100/70 border-indigo-700"
                    : "text-emerald-100/70 border-emerald-700/50"
                }`}
              >
                <span>
                  PROJECT:{" "}
                  <b className="text-white font-semibold uppercase">
                    {estimateData?.projectName || "—"}
                  </b>
                </span>
                <span className="opacity-30">|</span>
                <span>
                  CLIENT:{" "}
                  <b className="text-white font-semibold uppercase">
                    {estimateData?.clientName || "—"}
                  </b>
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT: Actions */}
          <div className="flex items-center gap-4">
            {viewMode === "editing" && !isLocked && !isEditMode && (
              <VersionHistoryPanel
                versions={versions}
                selectedVersionId={selectedVersionId}
                viewMode={viewMode}
                onSelectVersion={onSelectVersion}
                isOpen={isVersionMenuOpen}
                onToggle={onToggleVersionMenu}
              />
            )}

            <div className="flex items-center gap-1.5">
              {!isLocked && viewMode === "editing" && (
                <div className="flex items-center gap-1.5">
                  {isEditMode ? (
                    <>
                      <button
                        onClick={() => setIsEditMode(false)}
                        className="flex items-center gap-1 px-3 py-1 rounded text-white/80 hover:text-white hover:bg-white/10 font-bold text-[11px] uppercase transition-all"
                      >
                        <X size={14} />
                        Cancel
                      </button>

                      <button
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="p-1.5 text-indigo-100 hover:bg-red-500 hover:text-white rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-1 rounded bg-white text-indigo-900 font-bold text-[11px] hover:bg-indigo-50 active:scale-95 disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all"
                      >
                        <Save
                          size={14}
                          className={isSaving ? "animate-spin" : ""}
                        />
                        {isSaving ? "SAVING..." : "APPLY CHANGES"}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="flex items-center gap-1.5 px-3 py-1 rounded border border-emerald-600 bg-[#0d6635] text-emerald-50 font-bold text-[11px] hover:bg-[#158a4b] transition-all shadow-sm"
                    >
                      <Settings2 size={14} />
                      FORMAT LAYOUT
                    </button>
                  )}
                </div>
              )}

              {/* Status/Lock Badge */}
              <button
                disabled={isEditMode}
                onClick={isLocked ? onUnlock : () => setIsLockModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold text-[10px] uppercase tracking-wider border transition-all ${
                  isEditMode
                    ? "opacity-30 cursor-not-allowed bg-indigo-800 border-indigo-700 text-indigo-400"
                    : isLocked
                      ? "bg-amber-500 border-amber-600 text-white hover:bg-amber-600"
                      : "bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600"
                }`}
              >
                {isLocked ? <Lock size={12} /> : <LockOpen size={12} />}
                {isLocked ? "READ ONLY" : "LOCK"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* DELETE MODAL (styled to match) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden border-t-4 border-red-600">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3 text-red-600">
                <AlertTriangle size={20} />
                <h2 className="font-bold text-lg">Permanent Delete</h2>
              </div>
              <p className="text-slate-500 text-[11px] mb-4 leading-relaxed uppercase tracking-wide">
                Please type the estimate name to confirm: <br />
                <span className="font-mono font-black text-slate-900 text-sm select-none">
                  {rawName}
                </span>
              </p>
              <input
                autoFocus
                type="text"
                className="w-full px-3 py-2 border-2 border-slate-100 rounded text-sm outline-none focus:border-red-500 mb-4 font-medium"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-2 text-[11px] font-bold text-slate-400 hover:bg-slate-50 rounded uppercase"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={confirmName !== rawName}
                  className="flex-1 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 rounded uppercase shadow-lg shadow-red-200"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <LockConfirmModal
        isOpen={isLockModalOpen}
        isSaving={isLocking}
        onCancel={() => setIsLockModalOpen(false)}
        onConfirm={async () => {
          setIsLocking(true);
          try {
            await onLock();
          } finally {
            setIsLocking(false);
            setIsLockModalOpen(false);
          }
        }}
      />
    </>
  );
};
