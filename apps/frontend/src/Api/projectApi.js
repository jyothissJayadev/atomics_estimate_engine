// src/api/project.api.js

import api from "./api";

/* ============================
   PROJECT CRUD
============================ */

export const createProjectApi = (data) => api.post("/projects", data);

export const getMyProjectsApi = () => api.get("/projects");

export const getProjectByIdApi = (projectId) =>
  api.get(`/projects/${projectId}`);

export const updateProjectApi = (projectId, data) =>
  api.patch(`/projects/${projectId}`, data); // ✅ PATCH

export const deleteProjectApi = (projectId) =>
  api.delete(`/projects/${projectId}`);

/* ============================
   PROJECT COVER IMAGE
============================ */

export const updateProjectCoverApi = (projectId, formData) =>
  api.patch(`/projects/${projectId}/cover`, formData); // ✅ PATCH

/* ============================
   PROJECT SETUP (Steps 1–4 autosave)
============================ */

export const getProjectSetupApi = (projectId) =>
  api.get(`/projects/${projectId}/setup`);

export const updateProjectSetupApi = (projectId, data) =>
  api.patch(`/projects/${projectId}/setup`, data);

/* ============================
   INTELLIGENCE SETUP (Steps 5–7)
============================ */

/**
 * Step 5 → Run full intelligence preview
 */
export const previewSetupIntelligenceApi = (projectId) =>
  api.post(`/projects/setup/${projectId}/preview`);

/**
 * Step 6 → User edits items
 */
export const updateSetupItemsApi = (projectId, rooms) =>
  api.patch(`/projects/setup/${projectId}/items`, { rooms });

/**
 * Step 7 → Finalize & create estimate
 */
export const completeProjectSetupApi = (projectId) =>
  api.post(`/projects/${projectId}/setup/complete`);

/* ============================
   PROJECT MEMBERS
============================ */

export const addProjectMemberApi = (projectId, data) =>
  api.post(`/projects/${projectId}/members`, data);

export const removeProjectMemberApi = (projectId, userId) =>
  api.delete(`/projects/${projectId}/members/${userId}`);

export const getProjectMembersApi = (projectId) =>
  api.get(`/projects/${projectId}/members`);

/* ============================
   PROJECT CLIENT
============================ */

export const addProjectClientApi = (projectId, email) =>
  api.post(`/projects/${projectId}/client`, { email });

export const removeProjectClientApi = (projectId) =>
  api.delete(`/projects/${projectId}/client`);

/* ============================
   CLIENT MOODBOARD (PUBLIC)
============================ */

export const getClientMoodboardApi = (token) =>
  api.get(`/projects/client/${token}`);

/* ============================
   ENGINE LEVEL 1 & 2 (SETUP)
============================ */

/**
 * Level 1 — predict L2 sections after budget is entered (Step 3 → Step 4)
 * Returns: { predictedSections, allSections, projectContext }
 */
export const predictSectionsApi = (projectId) =>
  api.post(`/projects/${projectId}/setup/level1`);

/**
 * Level 2 — predict L3 items for confirmed sections (Step 4 → Step 5)
 * Body: { confirmedSections: ['apt_modular_kitchen', ...] }
 * Returns: { sections, allItemsBySectionRef, projectTotals }
 */
export const predictItemsApi = (projectId, confirmedSections) =>
  api.post(`/projects/${projectId}/setup/level2`, { confirmedSections });

/**
 * Recalculate — re-price confirmed items after add/remove in Step 5.
 * Called on every item toggle with 400ms debounce.
 * Body: { confirmedSections, confirmedItems, tierOverride? }
 * Returns: { sections, projectTotals, tier, tierIsOverride }
 */
export const recalculateItemsApi = (projectId, confirmedSections, confirmedItems, tierOverride) =>
  api.post(`/projects/${projectId}/setup/recalculate-items`, {
    confirmedSections,
    confirmedItems,
    ...(tierOverride ? { tierOverride } : {}),
  });

/**
 * Canonical Items — fetch from DB instead of static JSON.
 * Used by Step 5 AddItemPicker and Step 4 AddSectionPicker.
 */
export const getCanonicalItemsApi = (params) =>
  api.get('/setup/canonical-items', { params });

export const getCanonicalItemTreeApi = (projectType, params) =>
  api.get(`/setup/canonical-items/tree/${projectType}`, { params });

export const searchCanonicalItemsApi = (params) =>
  api.get('/setup/canonical-items/search', { params });

/**
 * Resolve a raw typed name to a CanonicalItem (for estimate editor new row).
 * Body: { rawName, parentId?, level?, projectType? }
 */
export const resolveCanonicalItemApi = (body) =>
  api.post('/setup/canonical-items/resolve', body);
