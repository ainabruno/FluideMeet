import "./start";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { initDb } from './db'; // 👉 initialise la base avant tout
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// ⚠️ Initialiser la base de données AVANT d’importer des modules qui utilisent getDb()
initDb();

const app = express();

// CORS - Autoriser le frontend à accéder à l'API avec cookies (credentials)
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Middleware de logging des requêtes API
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json.bind(res);
  res.json = (bodyJson, ...args) => {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    // Middleware gestion erreurs (avec protection headersSent)
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      if (res.headersSent) {
        return _next(err);
      }
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const PORT = process.env.PORT || 5001;
    server.listen(PORT, () => {
      log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Erreur au démarrage du serveur:", error);
    process.exit(1);
  }
})();
