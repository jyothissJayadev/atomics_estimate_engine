const express = require("express");
const {
  adminLogin,
  refreshAdminToken,
} = require("../controllers/auth/adminAuth.controller.js");
const { verifyAdmin } = require("../middleware/adminAuth.middleware.js");

const router = express.Router();

router.post("/login", adminLogin);
router.post("/refresh", refreshAdminToken);

// Protected test route
router.get("/me", verifyAdmin, (req, res) => {
  res.json(req.admin);
});

module.exports = router;
