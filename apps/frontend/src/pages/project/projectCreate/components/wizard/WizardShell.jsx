import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ArrowRight,
  Check,
  Cloud,
  CloudOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWizardState } from "../../hooks/useWizardState";

import Step1 from "./steps/Step1_ProjectFoundation";
import Step2 from "./steps/Step2_LocationScope";
import Step3 from "./steps/Step3_Budget";
import Step4 from "./steps/Step4_Rooms";
import Step5 from "./steps/Step5_RoomItems";
import Review from "./steps/ReviewSection";

const TOTAL_STEPS = 6;

const STEP_META = [
  { label: "Project Basics", desc: "Name, type & cover" },
  { label: "Location & Scope", desc: "City, area & interior type" },
  { label: "Budget", desc: "Amount & flexibility" },
  { label: "Rooms", desc: "Rooms & additional work" },
  { label: "Items", desc: "Room-wise breakdown" },
  { label: "Review", desc: "Confirm & launch" },
];

const TOKENS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
:root {
  --accent: #1a1a2e;
  --accent-2: #4361ee;
  --accent-subtle: #f0f3ff;
  --accent-border: #d0d9ff;
  --surface: #ffffff;
  --surface-2: #f7f7f6;
  --surface-3: #f0efec;
  --border: #e8e7e3;
  --border-2: #d5d3ce;
  --text-primary: #0f0f0f;
  --text-secondary: #3a3a3a;
  --text-muted: #8a8a8a;
  --text-faint: #c0bfbb;
  --green: #16a34a;
  --amber: #d97706;
  --red: #dc2626;
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;
  --bg: #f4f3ef;
  --sidebar-w: 260px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
  --shadow-float: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
  --radius: 16px;
  --radius-sm: 10px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-body); }
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
input[type=number] { -moz-appearance: textfield; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse3 { 0%,100%{opacity:1} 50%{opacity:0.2} }
.fade-up { animation: fadeUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
`;

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

function SaveBadge({ status }) {
  const map = {
    saving: {
      icon: <Loader2 size={10} className="animate-spin" />,
      text: "Saving",
      color: "var(--text-faint)",
    },
    saved: { icon: <Cloud size={10} />, text: "Saved", color: "var(--green)" },
    error: { icon: <CloudOff size={10} />, text: "Error", color: "var(--red)" },
    idle: null,
  };
  const c = map[status];
  if (!c) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 500,
        color: c.color,
        fontFamily: "var(--font-body)",
      }}
    >
      {c.icon}
      {c.text}
    </motion.div>
  );
}

export default function WizardShell() {
  const navigate = useNavigate();
  const {
    step,
    projectData,
    setProjectData,
    updateField,
    updateRoomDetail,
    toggleAdditionalWork,
    canContinue,
    handleNext,
    handleBack,
    handleSubmit,
    toggleSection,
    addSection,
    toggleItem,
    addItem,
    isSubmitting,
    saveStatus,
    projectId,
    isLoading,
    isResuming,
    stepSaveLoading,
    submitError,
    isLoadingSections,
    isLoadingItems,
    engineError,
  } = useWizardState();

  const isLast = step === TOTAL_STEPS - 1;
  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const sp = {
    projectData,
    setProjectData,
    updateField,
    updateRoomDetail,
    toggleAdditionalWork,
    toggleSection,
    addSection,
    toggleItem,
    addItem,
    isLoadingSections,
    isLoadingItems,
    engineError,
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: "var(--font-body)",
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--accent-2)" }}
        />
        <p
          style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}
        >
          Resuming draft…
        </p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TOKENS }} />
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          background: "var(--bg)",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside
          style={{
            width: "var(--sidebar-w)",
            flexShrink: 0,
            display: "none",
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            flexDirection: "column",
            padding: "32px 24px",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
          className="lg-sidebar"
        >
          <style>{`
            @media (min-width: 1024px) { .lg-sidebar { display: flex !important; } }
          `}</style>

          {/* Back */}
          <button
            onClick={() => navigate("/projects")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginBottom: 36,
              padding: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            <ChevronLeft size={14} />
            All Projects
          </button>

          {/* Project identity */}
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={13} style={{ color: "#fff" }} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  color: "var(--accent-2)",
                }}
              >
                New Project
              </span>
            </div>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 400,
                lineHeight: 1.2,
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
              }}
            >
              {projectData.projectName || "Untitled Project"}
            </h2>
            {projectData.clientName && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 4,
                  fontWeight: 400,
                }}
              >
                for {projectData.clientName}
              </p>
            )}
          </div>

          {/* Steps */}
          <nav
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {STEP_META.map((meta, idx) => {
              const isActive = idx === step;
              const isDone = idx < step;
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: isActive
                      ? "var(--accent-subtle)"
                      : "transparent",
                    opacity: idx > step ? 0.38 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isActive
                        ? "var(--accent-2)"
                        : isDone
                          ? "var(--green)"
                          : "var(--surface-3)",
                      border: isActive
                        ? "none"
                        : isDone
                          ? "none"
                          : "1.5px solid var(--border-2)",
                      transition: "all 0.2s",
                    }}
                  >
                    {isDone ? (
                      <Check size={11} style={{ color: "#fff" }} />
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isActive ? "#fff" : "var(--text-muted)",
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive
                          ? "var(--accent-2)"
                          : "var(--text-secondary)",
                        lineHeight: 1.2,
                      }}
                    >
                      {meta.label}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "var(--text-muted)",
                        marginTop: 1,
                      }}
                    >
                      {meta.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Save badge */}
          <div style={{ paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <AnimatePresence mode="wait">
              <SaveBadge status={saveStatus} />
            </AnimatePresence>
            {projectId && (
              <p
                style={{
                  fontSize: 9,
                  color: "var(--text-faint)",
                  marginTop: 4,
                  fontFamily: "monospace",
                }}
              >
                #{projectId.slice(-8)}
              </p>
            )}
          </div>
        </aside>

        {/* ── Main area ───────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            minWidth: 0,
          }}
        >
          {/* Top bar */}
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 30,
              background: "rgba(244,243,239,0.88)",
              backdropFilter: "blur(16px)",
              borderBottom: "1px solid var(--border)",
              padding: "0 32px",
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={step === 0 ? () => navigate("/projects") : handleBack}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  color: "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-2)";
                  e.currentTarget.style.background = "var(--surface-2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--surface)";
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {STEP_META[step]?.label}
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  Step {step + 1} of {TOTAL_STEPS}
                </p>
              </div>

              {isResuming && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "#fef9c3",
                    color: "#854d0e",
                    border: "1px solid #fde047",
                    display: "none",
                  }}
                  className="sm-inline"
                >
                  Resuming draft
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <AnimatePresence mode="wait">
                <SaveBadge status={saveStatus} />
              </AnimatePresence>
              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 96,
                    height: 3,
                    borderRadius: 3,
                    background: "var(--border)",
                    overflow: "hidden",
                  }}
                >
                  <motion.div
                    style={{
                      height: "100%",
                      background: "var(--accent-2)",
                      borderRadius: 3,
                    }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    minWidth: 28,
                  }}
                >
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </header>

          {/* Step content — full width */}
          <main
            style={{ flex: 1, overflow: "auto", padding: "40px 32px 120px" }}
          >
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {step === 0 && <Step1 {...sp} projectId={projectId} />}
                  {step === 1 && <Step2 {...sp} />}
                  {step === 2 && <Step3 {...sp} />}
                  {step === 3 && <Step4 {...sp} />}
                  {step === 4 && <Step5 {...sp} />}
                  {step === 5 && <Review projectData={projectData} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {/* Footer CTA */}
          <footer
            style={{
              position: "fixed",
              bottom: 0,
              right: 0,
              left: "var(--sidebar-w)",
              padding: "16px 32px",
              background: "rgba(244,243,239,0.95)",
              backdropFilter: "blur(16px)",
              borderTop: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              zIndex: 20,
            }}
          >
            <style>{`
              @media (max-width: 1023px) { footer { left: 0 !important; } }
            `}</style>

            {/* Mobile step dots */}
            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 4,
                    borderRadius: 2,
                    transition: "all 0.3s",
                    width: i === step ? 20 : 6,
                    background:
                      i === step
                        ? "var(--accent-2)"
                        : i < step
                          ? "var(--green)"
                          : "var(--border-2)",
                  }}
                />
              ))}
            </div>

            {!isLast ? (
              <button
                onClick={handleNext}
                disabled={
                  !canContinue() ||
                  stepSaveLoading ||
                  isLoadingSections ||
                  isLoadingItems
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 28px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: "var(--font-body)",
                  background:
                    canContinue() &&
                    !stepSaveLoading &&
                    !isLoadingSections &&
                    !isLoadingItems
                      ? "var(--accent-2)"
                      : "var(--border)",
                  color:
                    canContinue() &&
                    !stepSaveLoading &&
                    !isLoadingSections &&
                    !isLoadingItems
                      ? "#fff"
                      : "var(--text-faint)",
                  border: "none",
                  cursor:
                    canContinue() &&
                    !stepSaveLoading &&
                    !isLoadingSections &&
                    !isLoadingItems
                      ? "pointer"
                      : "not-allowed",
                  boxShadow:
                    canContinue() &&
                    !stepSaveLoading &&
                    !isLoadingSections &&
                    !isLoadingItems
                      ? "0 4px 16px rgba(67,97,238,0.32)"
                      : "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (
                    canContinue() &&
                    !stepSaveLoading &&
                    !isLoadingSections &&
                    !isLoadingItems
                  )
                    e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {stepSaveLoading || isLoadingSections || isLoadingItems ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />{" "}
                    {isLoadingSections
                      ? "Predicting sections…"
                      : isLoadingItems
                        ? "Predicting items…"
                        : "Saving…"}
                  </>
                ) : (
                  <>
                    Continue <ArrowRight size={14} />
                  </>
                )}
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                {submitError && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--red)",
                      maxWidth: 280,
                      textAlign: "right",
                    }}
                  >
                    {submitError}
                  </p>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 28px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "var(--font-body)",
                    background: "#16a34a",
                    color: "#fff",
                    border: "none",
                    cursor: isSubmitting ? "wait" : "pointer",
                    boxShadow: "0 4px 16px rgba(22,163,74,0.3)",
                    opacity: isSubmitting ? 0.75 : 1,
                    transition: "all 0.2s",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Launching…
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Launch Project
                    </>
                  )}
                </button>
              </div>
            )}
          </footer>
        </div>
      </div>
    </>
  );
}
