import api from "./api";

/* ============================
   ESTIMATES (STEP 1 + 2)
============================ */
/* ============================
   ESTIMATES
============================ */

/**
 * Create a new estimate under a project
 */
export const createEstimateApi = (projectId, data) =>
  api.post(`/estimates/projects/${projectId}`, data);

/**
 * Get estimate metadata + active version only
 */
export const getEstimateByIdApi = (estimateId) =>
  api.get(`/estimates/${estimateId}`);

/**
 * Save a new estimate version
 */
export const saveEstimateVersionApi = (estimateId, data) =>
  api.post(`/estimates/${estimateId}/version`, data);

/**
 * Get version metadata list (no heavy data)
 */
export const getEstimateVersionsApi = (estimateId) =>
  api.get(`/estimates/${estimateId}/versions`);

/**
 * Get full data for a specific version
 */
export const getSingleEstimateVersionApi = (estimateId, versionId) =>
  api.get(`/estimates/${estimateId}/versions/${versionId}`);

/**
 * Lock estimate
 */
export const lockEstimateApi = (estimateId) =>
  api.post(`/estimates/${estimateId}/lock`);

export const unlockEstimateApi = (estimateId) =>
  api.post(`/estimates/${estimateId}/unlock`);

export const updateEstimateMetaApi = (estimateId, data) =>
  api.patch(`/estimates/${estimateId}`, data);
/* ============================
   PROJECT FINANCE (STEP 3)
============================ */

/**
 * Get or create ProjectFinance
 * Used by Finance dashboard
 */
export const getProjectFinanceApi = (projectId) =>
  api.get(`/finance/${projectId}`);

/**
 * Sync estimates into ProjectFinance
 * Pulls latest estimate totals
 */
export const syncProjectFinanceApi = (projectId) =>
  api.post(`/finance/${projectId}/sync`);

/**
 * Toggle include / exclude estimate
 */
export const toggleEstimateInFinanceApi = (projectId, estimateId) =>
  api.patch(`/finance/${projectId}/estimates/${estimateId}/toggle`);
export const reorderFinanceEstimatesApi = (projectId, orderedEstimateIds) =>
  api.patch(`/finance/${projectId}/reorder`, {
    orderedEstimateIds,
  });
/* ============================
   FINANCE HEADER & FOOTER (STEP 4)
============================ */

/**
 * Update finance header
 * (logo, company name, phone, email, date, location)
 */
export const updateFinanceHeaderApi = (projectId, data) =>
  api.patch(`/finance/${projectId}/header`, data);

/**
 * Update finance footer
 * (notes / declarations)
 */
export const updateFinanceFooterApi = (projectId, data) =>
  api.patch(`/finance/${projectId}/footer`, data);

/**
 * Finalize / lock ProjectFinance
 */
export const finalizeProjectFinanceApi = (projectId) =>
  api.post(`/finance/${projectId}/finalize`);

/* ============================
   FINANCE PREVIEW
============================ */

/**
 * Get preview payload for PreviewFinance
 */
export const getFinancePreviewApi = (projectId) =>
  api.get(`/finance/${projectId}/preview`);

/**
 * Get finance header + footer only
 * Lightweight layout fetch (no estimates)
 */
export const getFinanceLayoutApi = (projectId) =>
  api.get(`/finance/${projectId}/layout`);
/**
 * Get project details (name, client, etc.)
 */
export const getProjectDetailsApi = (projectId) =>
  api.get(`/projects/${projectId}`);
/**
 * Toggle GST on/off for project finance
 */
export const toggleFinanceGstApi = (projectId) =>
  api.patch(`/finance/${projectId}/gst/toggle`);

/**
 * Upload image for a table item in an estimate
 * Requires columnId (dynamic image column)
 */
export const uploadEstimateItemImageApi = (
  estimateId,
  itemId,
  columnId,
  file,
) => {
  const formData = new FormData();
  formData.append("image", file);
  formData.append("columnId", columnId);

  return api.post(`/estimates/${estimateId}/items/${itemId}/image`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

/**
 * Upload logo for project finance header
 */
export const uploadFinanceHeaderLogoApi = (projectId, file) => {
  const formData = new FormData();
  formData.append("logo", file);

  return api.post(`/finance/${projectId}/header/logo`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};
/* ============================
   INTELLIGENCE
============================ */

/**
 * Generate intelligent estimate after project setup completion
 */
export const generateIntelligentEstimateApi = (projectId) =>
  api.post(`/intelligence/${projectId}/generate`);

/* ============================
   ESTIMATE ENGINE — LEVEL 2 / LEVEL 3
============================ */

/**
 * Level 2: Get AI-predicted items for confirmed sections
 * Body: { confirmedSections: ['apt_modular_kitchen', ...] }
 */
export const getLevel2ItemsApi = (estimateId, confirmedSections) =>
  api.post(`/estimates/${estimateId}/level2-items`, { confirmedSections });

/**
 * Level 3: Generate full BOQ from confirmed items
 * Body: { confirmedItems: { sectionRef: [itemRef, ...], ... } }
 */
export const generateLevel3EstimateApi = (estimateId, confirmedItems) =>
  api.post(`/estimates/${estimateId}/level3-generate`, { confirmedItems });

/* ============================
   ESTIMATE UPLOAD (ONBOARDING)
============================ */

/**
 * Upload raw past estimate text → learn rates + sections
 * Body: { rawText, projectType, city }
 */
export const uploadPastEstimateApi = (data) =>
  api.post('/upload/estimate', data);
