// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually:
//   tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//   componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//   error logger plugins, sandbox detection.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// --- Static build switch ------------------------------------------------
// Set GH_PAGES=1 in CI to produce a static site for GitHub Pages.
// In Lovable preview / normal dev, this stays off and the original
// Cloudflare-targeted dynamic build is used (no behaviour change).
const isStatic = process.env.GH_PAGES === "1";
const base = process.env.STATIC_BASE || "/precision-masters/";

// Enumerate every page that should be pre-rendered to HTML.
function collectPages(): { path: string; prerender: { enabled: true; outputPath: string; autoSubfolderIndex: true; crawlLinks: false; retryCount: 2 } }[] {
  const pages: string[] = ["/", "/dashboard"];
  for (let i = 1; i <= 6; i++) pages.push(`/courses/${i}`);

  const dataDir = join(process.cwd(), "public", "data", "courses");
  const detailCourses: { id: string; titleField: string }[] = [
    { id: "1", titleField: "款式名稱" },
    { id: "2", titleField: "通料名稱" },
    { id: "3", titleField: "款式名稱" },
  ];

  for (const c of detailCourses) {
    const f = join(dataDir, `${c.id}.json`);
    if (!existsSync(f)) continue;
    try {
      const json = JSON.parse(readFileSync(f, "utf8")) as { rows?: Record<string, unknown>[] };
      const seen = new Set<string>();
      for (const r of json.rows ?? []) {
        const name = String(r[c.titleField] ?? "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        pages.push(`/courses/${c.id}/${encodeURIComponent(name)}`);
      }
    } catch (e) {
      console.warn(`[prerender] skipped course ${c.id}:`, (e as Error).message);
    }
  }
  return pages.map((path) => ({
    path,
    prerender: {
      enabled: true,
      outputPath: path,
      autoSubfolderIndex: true,
      crawlLinks: false,
      retryCount: 2,
    },
  }));
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    ...(isStatic
      ? {
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: { outputPath: "/" },
          },
          pages: collectPages(),
          prerender: { enabled: true, concurrency: 4, failOnError: true },
        }
      : {}),
  },
  ...(isStatic
    ? {
        nitro: { preset: "node-server" },
        vite: { base },
      }
    : {}),
});
