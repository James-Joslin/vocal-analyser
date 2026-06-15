import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(() => {
  const disableHmr = process.env.DISABLE_HMR === "true";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      host: "0.0.0.0",
      port: Number(process.env.VITE_PORT || 3001),
      strictPort: true,

      hmr: disableHmr
        ? false
        : {
            clientPort: Number(process.env.VITE_PORT || 3001),
          },

      proxy: {
        "/api": {
          target: process.env.VITE_API_TARGET || "http://localhost:8008",
          changeOrigin: true,
        },
      },
    },
  };
});