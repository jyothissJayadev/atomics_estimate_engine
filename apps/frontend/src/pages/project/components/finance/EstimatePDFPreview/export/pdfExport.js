/**
 * pdfExport.js
 *
 * PDF export pipeline using html2canvas + jsPDF (loaded from CDN).
 *
 * Steps:
 *   1. Dynamically load html2canvas and jsPDF if not already present.
 *   2. Query all [data-a4-page] elements from the hidden 1:1 container.
 *   3. Rasterise each page at 2× resolution with html2canvas.
 *   4. Compose a jsPDF document and save it.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT LOADER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dynamically inject a <script> tag and wait for it to load.
 * Idempotent — skips injection if the script is already present.
 *
 * @param {string} src
 * @returns {Promise<void>}
 */
export async function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render all A4 pages to a PDF and trigger a browser download.
 *
 * @param {{
 *   containerRef: React.RefObject,
 *   totalPages: number,
 *   projectId: string,
 *   financeData: object,
 * }} options
 * @returns {Promise<void>}
 */
export async function exportToPDF({ totalPages, projectId, financeData }) {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  );
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  );

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const pageEls = document.querySelectorAll("[data-preview-page]");

  if (!pageEls || pageEls.length === 0) {
    throw new Error("No visible preview pages found.");
  }

  for (let i = 0; i < pageEls.length; i++) {
    const canvas = await window.html2canvas(pageEls[i], {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,

      // 🔥 THIS FIXES OKLCH ISSUE
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement("style");
        style.innerHTML = `
          * {
            color: rgb(0,0,0) !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      },
    });

    const imgData = canvas.toDataURL("image/png");

    if (i > 0) pdf.addPage();

    pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
  }

  const dateStr = financeData.date || new Date().toISOString().slice(0, 10);
  pdf.save(`Estimate-${projectId || "DOC"}-${dateStr}.pdf`);
}
