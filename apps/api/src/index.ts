import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";

// Route modules
import authRoutes from "./routes/auth";
import keysRoutes from "./routes/keys";
import namespacesRoutes from "./routes/namespaces";
import importExportRoutes from "./routes/import-export";
import changeRequestsRoutes from "./routes/changeRequests";
import coverageRoutes from "./routes/coverage";
import usersRoutes from "./routes/users";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

// ---- Global Middleware ----
app.use(
  cors({
    origin: true, // reflect request origin (supports Figma plugin's null origin)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Token"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// ---- Health Check ----
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---- API v1 Routes ----
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/keys", keysRoutes);
app.use("/api/v1/namespaces", namespacesRoutes);
app.use("/api/v1/import-export", importExportRoutes);
app.use("/api/v1/change-requests", changeRequestsRoutes);
app.use("/api/v1/coverage", coverageRoutes);
app.use("/api/v1/users", usersRoutes);

// ---- 404 handler ----
app.use((_req, res) => {
  res.status(404).json({ error: { message: "Route not found" } });
});

// ---- Global Error Handler ----
app.use(errorHandler);

// ---- Start Server (local dev only) ----
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[Hato TMS API] Server running on port ${PORT}`);
    console.log(`[Hato TMS API] Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
