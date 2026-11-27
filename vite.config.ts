import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@emotion/react",
      "@emotion/styled",
      "@mui/material",
      "@mui/icons-material",
    ],
  },
  build: {
    outDir: "build",
    assetsDir: "static",
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          if (
            id.includes("node_modules/@mui/") ||
            id.includes("node_modules/@emotion/")
          ) {
            return "vendor-mui";
          }
        },
      },
    },
  },
});
