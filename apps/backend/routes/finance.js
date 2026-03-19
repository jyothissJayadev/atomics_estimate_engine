const express = require("express");
const router = express.Router();

const {
  getProjectFinance,
  syncProjectEstimates,
  toggleFinanceGst,
  toggleEstimateInclusion,
  reorderFinanceEstimates,
  updateFinanceHeader,
  uploadFinanceHeaderLogo,
  getFinanceLayout,
  updateFinanceFooter,
  finalizeProjectFinance,
  getFinancePreview,
} = require("../controllers/finance/projectFinanceController");

const {
  listRates,
  upsertRate,
  deleteRate,
  getRateCoverage,
} = require("../controllers/finance/userRateController");

// const { uploadUserEstimate } = require('../controllers/finance/uploadController')

const { protect } = require("../middleware/auth.middleware");
const { access } = require("../middleware/access.middleware");
const { upload } = require("../middleware/upload.middleware");
const validateRequest = require("../middleware/validateRequest");

// ─── Project Finance ──────────────────────────────────────────────────────────

router.get("/finance/:projectId", protect, access(), getProjectFinance);
router.get("/finance/:projectId/layout", protect, access(), getFinanceLayout);
router.get("/finance/:projectId/preview", protect, access(), getFinancePreview);

router.post(
  "/finance/:projectId/sync",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  syncProjectEstimates,
);
router.patch(
  "/finance/:projectId/gst/toggle",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  toggleFinanceGst,
);
router.patch(
  "/finance/:projectId/estimates/:estimateId/toggle",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  toggleEstimateInclusion,
);
router.patch(
  "/finance/:projectId/reorder",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  reorderFinanceEstimates,
);
router.patch(
  "/finance/:projectId/header",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  updateFinanceHeader,
);
router.post(
  "/finance/:projectId/header/logo",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  upload.single("logo"),
  uploadFinanceHeaderLogo,
);
router.patch(
  "/finance/:projectId/footer",
  protect,
  access({ allowRoles: ["owner", "designer"] }),
  updateFinanceFooter,
);
router.post(
  "/finance/:projectId/finalize",
  protect,
  access({ allowRoles: ["owner"] }),
  finalizeProjectFinance,
);

// ─── Upload ───────────────────────────────────────────────────────────────────

// router.post('/upload/estimate', protect, validateRequest(['rawText','projectType']), uploadUserEstimate)

// ─── User Rates ───────────────────────────────────────────────────────────────

router.get("/rates/coverage", protect, getRateCoverage);
router.get("/rates", protect, listRates);
router.put("/rates", protect, validateRequest(["canonicalRef"]), upsertRate);
router.delete("/rates/:canonicalRef", protect, deleteRate);

module.exports = router;
