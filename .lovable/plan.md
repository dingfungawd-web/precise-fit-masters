# 遷移至靜態網站 (GitHub Pages) 計劃

## 目標
將現有 TanStack Start 動態網站轉為純前端 SPA，部署到 GitHub Pages，repo 名 `precision-masters`。

---

## 確認事項
- **Repo**: `precision-masters` → 網址 `https://<你帳號>.github.io/precision-masters/`
- **認證**: 共用密碼（每月手動換）
- **課程六分數**: 存瀏覽器 localStorage（個人自測）
- **Sheets 更新**: 手動觸發 + 每日自動（GitHub Actions cron）
- **影片/圖片**: 繼續用 YouTube + Google Drive 公開連結

---

## 五個階段

### Phase 1 — 資料靜態化
- 新增 `scripts/fetch-sheets.mjs`：build 時用 Google Sheets API 抓所有課程資料。
- 輸出到 `public/data/courses/{1..5}.json` 同 `public/data/course4-tree.json`、`public/data/course5-cases.json`。
- 前端改成 `fetch('/data/...json')`，移除所有 `createServerFn` 對 Google Sheets 嘅呼叫。
- 加「最後更新時間」顯示。

### Phase 2 — 認證簡化
- 移除 Supabase auth、`profiles`、`user_roles`、admin 頁面、登入頁面相關 server functions。
- 新增 `/unlock` 頁：純前端密碼比對（密碼經 SHA-256 hash 後寫死喺 `src/lib/gate.ts`，唔放明文）。
- 解鎖後寫 `localStorage('pm-unlocked', expiry)`，每月 1 號自動失效逼用戶再輸入。
- 路由用簡單 React guard：未解鎖 → 跳 `/unlock`。

> 註：純前端密碼無法 100% 防爆破，但配合每月換密碼、unlisted 影片、Drive 權限控制已足夠日常用途。

### Phase 3 — 框架轉換 (TanStack Start → Vite + React SPA)
- 由 TanStack Start 改為 **Vite + React + TanStack Router (file-based, SPA 模式)**。
- 移除：`src/start.ts`、所有 `*.functions.ts`、`*.server.ts`、`src/routes/api/*`、Supabase integration 整個 folder。
- 保留：`src/routes/`、`src/components/`、`src/lib/course-config.ts`、`src/components/youtube-videos.tsx`、Course4/Course5 邏輯。
- `vite.config.ts` 設 `base: '/precision-masters/'`。
- 加 `public/404.html` redirect script（GitHub Pages SPA fallback）。

### Phase 4 — 課程六本地化
- 課程六考核分數、答題記錄全部存 `localStorage`（已係計劃）。
- 加「重置我的成績」按鈕。

### Phase 5 — GitHub Actions 部署
新增 `.github/workflows/deploy.yml`：
- **手動觸發**: `workflow_dispatch` → fetch sheets → build → deploy。
- **每日自動**: `schedule: cron '0 18 * * *'` (香港時間每朝 2:00) → 同上。
- **Push to main**: 自動 build + deploy。
- Secrets 需要：`GOOGLE_SHEETS_API_KEY`（Google Cloud Console 取得，read-only public sheet 用 API key 就夠，唔需要 OAuth）。

---

## 需要你做嘅嘢
1. **Google Sheet 改成「任何知道連結的人 → 檢視者」**（已經係咁就 OK）。
2. **建立 GitHub repo** 名為 `precision-masters`（空 repo 即可）。
3. **Google Cloud Console 開一個 API key**，限制只可讀 Sheets API。
4. **諗一個初始密碼**（之後每月換）。

---

## 技術細節

**舊架構刪除清單**：
- `src/start.ts`, `src/router.tsx` (重寫), 所有 `src/routes/api/`
- `src/lib/*.functions.ts`, `src/lib/*.server.ts`, `src/lib/admin.functions.ts`
- `src/integrations/supabase/` 整個 folder
- `supabase/migrations/`（保留作備份但唔再用）
- `src/routes/_authenticated.tsx` → 改為 `_gated.tsx` 用 localStorage 檢查
- `src/routes/admin.tsx`, `src/routes/auth.tsx`

**新增**：
- `scripts/fetch-sheets.mjs`
- `src/lib/data.ts`（讀 JSON 嘅 helper + React Query 包裝）
- `src/lib/gate.ts`（密碼 hash 驗證 + localStorage 管理）
- `src/routes/unlock.tsx`
- `.github/workflows/deploy.yml`
- `public/404.html`

**Migration risk**：Phase 3 改框架影響最大，建議分次做：先 Phase 1+2（保留 TanStack Start 但唔再依賴 Sheets API live call），確認資料 OK，再做 Phase 3 換框架。

---

## 執行順序建議
我會逐 Phase 做，每 Phase 完成後你 preview 確認先做下一步。第一步由 **Phase 1 (資料靜態化)** 開始。

確認後我就開始 Phase 1。