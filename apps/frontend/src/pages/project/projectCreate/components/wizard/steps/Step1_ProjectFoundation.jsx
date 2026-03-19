import React, { useRef, useState, useEffect } from "react";
import { Camera, Upload, X, Loader2, CheckCircle2 } from "lucide-react";
import { PROJECT_TYPES, ROOM_CONFIG_OPTIONS } from "../../../constants/projectConfig";
import { updateProjectCoverApi } from "../../../../../../Api/projectApi";

const FL = ({ children }) => (
  <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
    {children}
  </label>
);

const TYPE_HINTS = {
  residential_apartment: "Compact living · smart storage · layered lighting",
  villa: "Open volumes · curated materiality · statement spaces",
  commercial_office: "Productivity zones · brand identity · acoustic comfort",
  retail_shop: "Traffic flow · display hierarchy · brand experience",
  hospitality: "Ambiance design · material warmth · guest experience",
  clinic_healthcare: "Clinical precision · hygienic materials · calming finishes",
  education: "Inspiring spaces · durable finishes · functional zones",
  industrial_warehouse: "Functional layout · safety-compliant · durable finishes",
};

function ThinkDots({ on, label }) {
  if (!on) return null;
  return (
    <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", borderRadius: 12,
      background: "linear-gradient(135deg,#eef2ff,#f0fdf4)",
      border: "1px solid var(--accent-border)" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%",
            background: "var(--accent-2)",
            animation: "pulse3 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--accent-2)" }}>{label}</span>
    </div>
  );
}

function Hint({ children }) {
  return (
    <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8,
      padding: "10px 14px", borderRadius: 12,
      background: "var(--accent-subtle)", border: "1px solid var(--accent-border)" }}>
      <span style={{ color: "var(--accent-2)", fontSize: 12 }}>✦</span>
      <span style={{ fontSize: 12, color: "var(--accent-2)", fontWeight: 500, lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}

export default function Step1({ projectData, setProjectData, projectId }) {
  const fileRef = useRef(null);
  const pendingFile = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const configOptions = ROOM_CONFIG_OPTIONS[projectData.projectType];

  useEffect(() => {
    if (projectData.projectType) {
      setShowHint(false); setShowConfig(false); setThinking(true);
      const t1 = setTimeout(() => { setThinking(false); setShowHint(true); }, 800);
      const t2 = setTimeout(() => setShowConfig(true), 1000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setShowHint(false); setShowConfig(false); setThinking(false);
    }
  }, [projectData.projectType]);

  useEffect(() => {
    if (!projectId || !pendingFile.current) return;
    const f = pendingFile.current; pendingFile.current = null;
    doUpload(f, projectId);
  }, [projectId]);

  const doUpload = async (file, pid) => {
    setUploading(true); setUploadDone(false); setUploadError("");
    try {
      const fd = new FormData(); fd.append("coverImage", file);
      const res = await updateProjectCoverApi(pid, fd);
      setProjectData((p) => ({ ...p, coverImage: res.data.coverImage, coverImagePreview: res.data.coverImage }));
      setUploadDone(true); setTimeout(() => setUploadDone(false), 2000);
    } catch { setUploadError("Upload failed"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadError("");
    setProjectData((p) => ({ ...p, coverImagePreview: URL.createObjectURL(file), coverImage: null }));
    if (projectId) doUpload(file, projectId);
    else { pendingFile.current = file; setUploading(true); }
  };

  const removeCover = (e) => {
    e.preventDefault(); e.stopPropagation();
    pendingFile.current = null; setUploading(false); setUploadError("");
    setProjectData((p) => ({ ...p, coverImage: null, coverImagePreview: null }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const preview = projectData.coverImagePreview || projectData.coverImage;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

      {/* Header */}
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-2)",
          textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
          Step 1 of 6 — Basics
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2rem,4vw,2.75rem)",
          fontWeight: 400, color: "var(--text-primary)", lineHeight: 1.1, marginBottom: 8 }}>
          Let's start with the basics
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 400 }}>
          Name your project, choose a type and upload a cover.
        </p>
      </div>

      {/* Name + Cover */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div>
            <FL>Project title *</FL>
            <input
              autoFocus
              type="text" placeholder="e.g. Modern Minimalist Villa"
              value={projectData.projectName}
              onChange={(e) => setProjectData((p) => ({ ...p, projectName: e.target.value }))}
              style={{ width: "100%", fontSize: 24, fontWeight: 600,
                fontFamily: "var(--font-display)",
                background: "transparent", border: "none",
                borderBottom: "2px solid var(--border)", outline: "none",
                paddingBottom: 10, color: "var(--text-primary)", transition: "border-color 0.2s" }}
              onFocus={(e) => (e.target.style.borderBottomColor = "var(--accent-2)")}
              onBlur={(e) => (e.target.style.borderBottomColor = "var(--border)")}
            />
          </div>
          <div>
            <FL>Client name *</FL>
            <input
              type="text" placeholder="e.g. Rahul Sharma"
              value={projectData.clientName}
              onChange={(e) => setProjectData((p) => ({ ...p, clientName: e.target.value }))}
              style={{ width: "100%", fontSize: 18, fontWeight: 500,
                background: "transparent", border: "none",
                borderBottom: "2px solid var(--border)", outline: "none",
                paddingBottom: 10, color: "var(--text-primary)", transition: "border-color 0.2s",
                fontFamily: "var(--font-body)" }}
              onFocus={(e) => (e.target.style.borderBottomColor = "var(--accent-2)")}
              onBlur={(e) => (e.target.style.borderBottomColor = "var(--border)")}
            />
          </div>
        </div>

        {/* Cover image */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.1em" }}>Cover</p>
          <div style={{ position: "relative", width: 96, height: 96, borderRadius: 16,
            overflow: "hidden",
            border: `2px dashed ${preview ? "transparent" : "var(--border-2)"}`,
            background: preview ? "transparent" : "var(--surface-2)", cursor: "pointer" }}>
            {preview ? (
              <>
                <img src={preview} alt="" style={{ width: "100%", height: "100%",
                  objectFit: "cover", opacity: uploading ? 0.5 : 1, transition: "opacity 0.3s" }} />
                {uploading && (
                  <div style={{ position: "absolute", inset: 0, display: "flex",
                    alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                    <Loader2 size={18} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: 0, transition: "opacity 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = 1)}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}>
                  <button onClick={removeCover} style={{ width: 28, height: 28, borderRadius: 6,
                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X size={13} />
                  </button>
                  <label style={{ width: 28, height: 28, borderRadius: 6,
                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Upload size={13} />
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
                  </label>
                </div>
              </>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", width: "100%", height: "100%", cursor: "pointer", gap: 4 }}>
                <Camera size={20} style={{ color: "var(--text-faint)" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--text-faint)",
                  letterSpacing: "0.08em" }}>ADD</span>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
              </label>
            )}
            {uploadDone && (
              <div className="fade-up" style={{ position: "absolute", inset: 0, borderRadius: 14,
                background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={28} style={{ color: "#fff" }} />
              </div>
            )}
          </div>
          {uploadError && <p style={{ fontSize: 10, color: "var(--red)", fontWeight: 600 }}>{uploadError}</p>}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border)" }} />

      {/* Project Type */}
      <div>
        <FL>Project type *</FL>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          {PROJECT_TYPES.map((type, i) => {
            const sel = projectData.projectType === type.id;
            return (
              <button key={type.id} className="fade-up"
                style={{ animationDelay: `${i * 35}ms`,
                  padding: "9px 18px", borderRadius: 24, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.18s",
                  background: sel ? "var(--accent)" : "var(--surface)",
                  color: sel ? "#fff" : "var(--text-secondary)",
                  border: `1.5px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                  boxShadow: sel ? "0 2px 12px rgba(26,26,46,0.24)" : "none",
                  transform: sel ? "scale(1.03)" : "scale(1)" }}
                onClick={() => setProjectData((p) => ({ ...p, projectType: type.id, roomConfig: "", rooms: [] }))}
              >
                {type.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <ThinkDots on={thinking} label="Analysing project type…" />
          {showHint && TYPE_HINTS[projectData.projectType] && (
            <Hint>{TYPE_HINTS[projectData.projectType]}</Hint>
          )}
        </div>
      </div>

      {/* Room Config — shown after type selected */}
      {showConfig && configOptions && (
        <div className="fade-up">
          <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />
          <FL>
            {["residential_apartment", "villa"].includes(projectData.projectType)
              ? "BHK / Layout *"
              : "Space type *"}
          </FL>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {configOptions.map((opt, i) => {
              const sel = projectData.roomConfig === opt.id;
              return (
                <button key={opt.id} className="fade-up"
                  style={{ animationDelay: `${i * 35}ms`,
                    padding: "9px 18px", borderRadius: 24, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "var(--font-body)", transition: "all 0.18s",
                    background: sel ? "var(--accent-2)" : "var(--surface)",
                    color: sel ? "#fff" : "var(--text-secondary)",
                    border: `1.5px solid ${sel ? "var(--accent-2)" : "var(--border)"}`,
                    boxShadow: sel ? "0 2px 12px rgba(67,97,238,0.3)" : "none",
                    transform: sel ? "scale(1.03)" : "scale(1)" }}
                  onClick={() => setProjectData((p) => ({ ...p, roomConfig: opt.id, rooms: [] }))}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
