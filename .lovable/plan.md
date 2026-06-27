## 目標

將現時 TanStack Start（含 SSR / Supabase / Server Functions）改為純 React SPA 靜態網站，部署到 GitHub Pages，資料用 build-time 預先抓取的 JSON。

## 為何要分階段

整個遷移涉及框架、認證、資料來源、媒體儲存、部署五大層面。一次過改會難以驗證。我會逐步做，每完成一步你都可以在預覽確認，再進入下一步。

## 階段規劃

### 階段 1：資料層改為「Build-time 抓取 → 靜態 JSON」
- 寫一個 Node script（`scripts/fetch-sheets.mjs`），用 Google Sheets API key 把 5 個分頁抓下來，寫入 `src/data/course-1.json` … `course-5.json`。
- 改寫 `src/lib/sheets.functions.ts` → `src/lib/sheets.ts`：直接 `import` JSON，不再用 `createServerFn`。
- 加 `bun run sync:sheets` 指令；之後改 Google Sheets 內容要重新 build 才會更新（這是靜態網站的取捨）。
- 加一個「最後更新時間」顯示，方便同事知道。

### 階段 2：移除登入系統
靜態網站無 server，無法用 Supabase Auth 做安全登入。三個選擇：
- **A. 完全公開**（最簡單，網址知道就睇到）
- **B. 單一共用密碼**（前端密碼閘，把資料用密碼解密；可阻一般人但唔係真安全）
- **C. 保留登入** → 唔可以做純靜態，要保留 Supabase

需要你揀。管理員後台同「員工進度追蹤」喺純靜態下會冇咗。

### 階段 3：框架轉換 TanStack Start → Vite + React SPA
- 移除 `@tanstack/react-start`、`wrangler.jsonc`、`src/server.ts`、`src/start.ts`、`src/routes/api/*`、所有 `*.functions.ts` / `*.server.ts`。
- 路由由 file-based 改為 `@tanstack/react-router` 的 memory/browser router（或者 `react-router-dom`，視乎你想保留幾多現有 route 寫法 — 我建議保留 TanStack Router 的 SPA 模式，改動最少）。
- `vite.config.ts` 換成標準 Vite React config，設 `base: '/<repo-name>/'`。

### 階段 4：媒體處理
- YouTube：維持 share link + 縮圖預覽（無變）。
- Google Drive 圖片：維持現有 `lh3.googleusercontent.com` 轉換（無變）。
- 重要：呢兩個服務仍然要 online 先睇到，網站本身就唔需要 server。
- （日後可選）將最常用圖片下載落 `public/` 由 GitHub Pages CDN 直接派。

### 階段 5：GitHub Pages 部署
- 加 `.github/workflows/deploy.yml`：
  - Checkout → `bun install` → `bun run sync:sheets`（用 GitHub Secret 入 API key）→ `bun run build` → 上傳 `dist/` 到 `gh-pages`。
- 加 `public/404.html` 做 SPA fallback redirect。
- 文檔：點 trigger 重新 build（每次改 Google Sheet 後手動撳 "Run workflow"，或者設 cron 每日一次）。

## 技術細節（給技術人員睇）

```text
舊                                         新
─────────────────────────────────────      ─────────────────────────────
TanStack Start (SSR on Cloudflare)    →    Vite SPA (static)
createServerFn → Google Sheets API    →    Build-time script → JSON imports
Supabase Auth + RLS                   →    無 / 共用密碼
src/routes/_authenticated/*           →    SPA routes (無 server gate)
wrangler / cloudflare workers         →    GitHub Pages
```

需要你先決定的事：
1. **階段 2 揀邊個方案？**（A 公開 / B 共用密碼 / C 保留 Supabase 變混合）
2. **GitHub repo 名係咩？**（用嚟設 `base` path）
3. **資料更新頻率：** 每次手動 trigger，定每日自動 build 一次？

確認以上 3 點之後我就開始做階段 1。
