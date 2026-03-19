/**
 * HeaderFooterEditor.jsx
 *
 * Modal panel for editing document header and footer.
 *
 * Header fields (from ProjectFinance schema):
 *   companyName, phone, email, location, quotationDate, logoUrl
 *
 * Footer fields:
 *   notes — array of strings, one per line
 *
 * The modal is rendered as a side-panel overlay (slides in from the right)
 * so the user can see the document preview behind it.
 */

import { useState, useEffect } from "react";

const FONT = "Calibri, 'Trebuchet MS', Arial, sans-serif";
const NAVY = "#2E4057";
const BLUE = "#BDD7EE";
const GREY = "#D9D9D9";
const BORDER = "1px solid #c0c0c0";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED FIELD COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#333",
        marginBottom: 4,
        fontFamily: FONT,
        textTransform: "uppercase",
        letterSpacing: 0.4,
      }}
    >
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "7px 10px",
        fontSize: 12,
        fontFamily: FONT,
        border: BORDER,
        borderRadius: 3,
        outline: "none",
        boxSizing: "border-box",
        background: "#fafafa",
        color: "#111",
      }}
    />
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        background: NAVY,
        padding: "6px 14px",
        marginBottom: 16,
        letterSpacing: 0.5,
        fontFamily: FONT,
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER EDITOR PANEL
// ─────────────────────────────────────────────────────────────────────────────

function HeaderEditorPanel({ financeData, onSave, saving, saveError }) {
  const src = financeData?.header || {};

  const [companyName, setCompanyName] = useState(
    src.companyName || financeData?.preparedBy || "",
  );
  const [phone, setPhone] = useState(src.phone || "");
  const [email, setEmail] = useState(src.email || "");
  const [location, setLocation] = useState(src.location || "");
  const [quotationDate, setQuotationDate] = useState(
    src.quotationDate
      ? new Date(src.quotationDate).toISOString().slice(0, 10)
      : financeData?.date || new Date().toISOString().slice(0, 10),
  );

  const handleSave = () => {
    onSave({ companyName, phone, email, location, quotationDate });
  };

  return (
    <div>
      <SectionTitle>Document Header</SectionTitle>
      <div style={{ padding: "0 16px" }}>
        <Field label="Company / Studio Name">
          <Input
            value={companyName}
            onChange={setCompanyName}
            placeholder="Studio Interiors Pvt. Ltd."
          />
        </Field>
        <Field label="Phone">
          <Input
            value={phone}
            onChange={setPhone}
            placeholder="+91 98765 43210"
          />
        </Field>
        <Field label="Email">
          <Input
            value={email}
            onChange={setEmail}
            placeholder="hello@studio.com"
            type="email"
          />
        </Field>
        <Field label="Location">
          <Input
            value={location}
            onChange={setLocation}
            placeholder="Mumbai, Maharashtra"
          />
        </Field>
        <Field label="Quotation Date">
          <Input
            value={quotationDate}
            onChange={setQuotationDate}
            type="date"
          />
        </Field>

        {saveError && (
          <div
            style={{
              color: "#842029",
              fontSize: 11,
              marginBottom: 10,
              fontFamily: FONT,
            }}
          >
            ⚠ {saveError}
          </div>
        )}

        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER EDITOR PANEL
// ─────────────────────────────────────────────────────────────────────────────

function FooterEditorPanel({ financeData, onSave, saving, saveError }) {
  const existingNotes =
    financeData?.footerNotes || financeData?.footer?.notes || [];

  // Internal state: one textarea line per note, joined by newlines
  const [notesText, setNotesText] = useState(existingNotes.join("\n"));

  const handleSave = () => {
    const notes = notesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    onSave({ notes });
  };

  return (
    <div>
      <SectionTitle>Document Footer Notes</SectionTitle>
      <div style={{ padding: "0 16px" }}>
        <Field label="Notes (one per line)">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder={
              "All rates are inclusive of material, labour, and supervision.\nGST @ 18% applicable on total amount.\nPayment terms: 40% advance, 40% at completion, 20% on handover."
            }
            rows={10}
            style={{
              width: "100%",
              padding: "8px 10px",
              fontSize: 12,
              fontFamily: FONT,
              border: BORDER,
              borderRadius: 3,
              outline: "none",
              boxSizing: "border-box",
              background: "#fafafa",
              color: "#111",
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </Field>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            marginBottom: 12,
            fontFamily: FONT,
          }}
        >
          Each line becomes a numbered note at the bottom of the document.
        </div>

        {saveError && (
          <div
            style={{
              color: "#842029",
              fontSize: 11,
              marginBottom: 10,
              fontFamily: FONT,
            }}
          >
            ⚠ {saveError}
          </div>
        )}

        <SaveButton onClick={handleSave} saving={saving} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE BUTTON
// ─────────────────────────────────────────────────────────────────────────────

function SaveButton({ onClick, saving }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        width: "100%",
        padding: "9px 0",
        fontSize: 12,
        fontWeight: 700,
        fontFamily: FONT,
        background: saving ? "#aac4d8" : "#217346",
        color: "#fff",
        border: "none",
        borderRadius: 3,
        cursor: saving ? "not-allowed" : "pointer",
        letterSpacing: 0.5,
        textTransform: "uppercase",
        transition: "background 0.15s",
      }}
    >
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MODAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   mode: 'header' | 'footer',
 *   financeData: object,
 *   onSaveHeader: (data: object) => Promise<void>,
 *   onSaveFooter: (data: object) => Promise<void>,
 *   onClose: () => void,
 *   saving: boolean,
 *   saveError: string | null,
 * }} props
 */
export default function HeaderFooterEditor({
  mode,
  financeData,
  onSaveHeader,
  onSaveFooter,
  onClose,
  saving,
  saveError,
}) {
  // Trap Escape key to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          zIndex: 1000,
        }}
      />

      {/* Side panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 340,
          background: "#fff",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
          overflowY: "auto",
        }}
      >
        {/* Panel header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 12px",
            background: NAVY,
            flexShrink: 0,
          }}
        >
          {/* Mode tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            {["header", "footer"].map((m) => (
              <span
                key={m}
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: FONT,
                  color: mode === m ? "#fff" : "#7faabf",
                  textTransform: "capitalize",
                  letterSpacing: 0.4,
                  cursor: "default",
                  borderBottom:
                    mode === m ? "2px solid #BDD7EE" : "2px solid transparent",
                  paddingBottom: 2,
                }}
              >
                {m}
              </span>
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#aac4d8",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, paddingTop: 16 }}>
          {mode === "header" && (
            <HeaderEditorPanel
              financeData={financeData}
              onSave={onSaveHeader}
              saving={saving}
              saveError={saveError}
            />
          )}
          {mode === "footer" && (
            <FooterEditorPanel
              financeData={financeData}
              onSave={onSaveFooter}
              saving={saving}
              saveError={saveError}
            />
          )}
        </div>
      </div>
    </>
  );
}
