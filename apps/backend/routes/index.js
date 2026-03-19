const authRouter = require("./auth");
const projectsRouter = require("./projects");
const estimatesRouter = require("./estimates");
const financeRouter = require("./finance");
const setupRouter = require("./setup");
const adminRouter = require("./admin");
function mountRoutes(app) {
  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/estimates", estimatesRouter);
  app.use("/api", financeRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/admin", adminRouter);

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "atomics-estimate-engine",
      time: new Date().toISOString(),
    });
  });
}

module.exports = mountRoutes;
