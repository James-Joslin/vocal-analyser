import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  const port = Number(process.env.VITE_PORT || 3000);
  const disableHmr = process.env.DISABLE_HMR === "true";

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    server: {
      host: "0.0.0.0",
      port,
      strictPort: true,

      hmr: disableHmr ? false : { clientPort: port },

      proxy: {
        "/api": {
          target: process.env.VITE_API_TARGET || "http://localhost:8008",
          changeOrigin: true,
        },
      },
    },
  };
});