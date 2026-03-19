import api from "./api";

/* ============================
   SETUP STEP 5–7 (INTELLIGENCE)
============================ */

export const previewSetupApi = (projectId) =>
  api.post(`/projects/setup/${projectId}/preview`);

export const updateSetupItemsApi = (projectId, rooms) =>
  api.patch(`/projects/setup/${projectId}/items`, { rooms });

export const completeSetupApi = (projectId) =>
  api.post(`/projects/setup/${projectId}/complete`);