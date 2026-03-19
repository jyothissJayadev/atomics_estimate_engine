require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const mountRoutes = require("./routes/index");
const errorHandler = require("./middleware/errorHandler");
const structureLearner = require("./services/structureLearner");
const dns = require("node:dns");
const dotenv = require("dotenv");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "10mb" })); // 10mb allows large estimate text uploads
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} → ${res.statusCode} (${duration} ms)`,
    );
  });

  next();
});
mountRoutes(app);

// ─── Error Handler (must be last) ────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\nAtomics Estimate Engine running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`Health check: http://localhost:${PORT}/health\n`);
  });

  // ── Nightly learning job ─────────────────────────────────────────────────
  // Runs once at startup (to catch any missed events from previous sessions)
  // then every 24 hours. Trigger manually via POST /api/setup/learn.
  if (process.env.NODE_ENV !== 'test') {
    // Small delay so DB is fully ready
    setTimeout(() => {
      structureLearner.run().catch(e =>
        console.error('[startup] structureLearner run failed (non-critical):', e.message)
      )
    }, 5000)

    // Repeat every 24 hours
    setInterval(() => {
      structureLearner.run().catch(e =>
        console.error('[cron] structureLearner run failed (non-critical):', e.message)
      )
    }, 24 * 60 * 60 * 1000)
  }
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

module.exports = app; // for testing
