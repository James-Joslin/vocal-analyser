import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import dotenv from "dotenv";

import scenarioRoutes from "./routes/scenarios";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const COGNITIVE_API_URL = process.env.COGNITIVE_API_URL || "http://localhost:8008";

app.use(express.json());

// Demo scenario data (static content, no model inference)
app.use("/api", scenarioRoutes);

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Development: Vite handles the frontend AND proxies /api/* to the Python API
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: proxy /api/* to the Python API container, serve static frontend
    app.use(
      "/api",
      createProxyMiddleware({
        target: COGNITIVE_API_URL,
        changeOrigin: true,
      }),
    );

    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Listening on http://0.0.0.0:${PORT} (${process.env.NODE_ENV || "development"})`);
    console.log(`[server] Python API target: ${COGNITIVE_API_URL}`);
  });
}

start().catch((err) => {
  console.error("Fatal server startup error:", err);
  process.exit(1);
});
