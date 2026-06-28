import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// Pure Vite + React SPA. Builds to dist/, ready for GitHub Pages.
// Set GH_PAGES=1 + STATIC_BASE="/precision-masters/" in CI.
const base = process.env.GH_PAGES === "1" ? (process.env.STATIC_BASE || "/precision-masters/") : "/";

export default defineConfig({
  base,
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "src/routes",
      generatedRouteTree: "src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
