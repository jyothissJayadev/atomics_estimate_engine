import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div
      className={`fixed top-8 right-8 z-[200] text-white px-5 py-3 rounded shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${toast.type === "error" ? "bg-red-700" : "bg-slate-800"}`}
    >
      {toast.type === "error" ? (
        <AlertTriangle size={18} />
      ) : (
        <CheckCircle2 className="text-emerald-400" size={18} />
      )}
      <span className="text-sm font-semibold">{toast.message}</span>
    </div>
  );
};
