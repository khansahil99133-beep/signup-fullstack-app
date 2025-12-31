// frontend/vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // GitHub Pages needs "/REPO_NAME/" (must end with "/")
  const base = (env.VITE_BASE || "/").toString();

  // For local dev only (proxy is NOT used in production builds)
  const devApiTarget = (env.VITE_API_BASE || "http://localhost:8082").toString();

  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
