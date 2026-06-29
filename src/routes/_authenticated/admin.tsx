import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { loadPasswordHash, sha256Hex, verifyAdminPin } from "@/lib/gate";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const LS_KEY = "pm-admin-gh-v1";
const AUTH_PATH = "public/data/auth.json";

type GhConfig = { owner: string; repo: string; branch: string; token: string };

function loadGh(): GhConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { branch: "main", ...JSON.parse(raw) };
  } catch {}
  return { owner: "", repo: "precision-masters", branch: "main", token: "" };
}

function saveGh(cfg: GhConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

const PIN_SESSION_KEY = "pm-admin-pin-ok-v1";

function AdminPage() {
  const [pinOk, setPinOk] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [gh, setGh] = useState<GhConfig>(() => ({ owner: "", repo: "", branch: "main", token: "" }));
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [hashPreview, setHashPreview] = useState<string>("");

  useEffect(() => {
    if (sessionStorage.getItem(PIN_SESSION_KEY) === "1") setPinOk(true);
    setGh(loadGh());
    loadPasswordHash().then((h) => setHashPreview(h.slice(0, 12) + "…")).catch(() => {});
  }, []);

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    try {
      const ok = await verifyAdminPin(pinInput);
      if (!ok) {
        toast.error("管理員 PIN 不正確");
        return;
      }
      sessionStorage.setItem(PIN_SESSION_KEY, "1");
      setPinOk(true);
      setPinInput("");
    } finally {
      setPinBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gh.owner || !gh.repo || !gh.token) {
      toast.error("請先填寫 GitHub 設定");
      return;
    }
    if (newPwd.length < 6) {
      toast.error("新密碼至少 6 個字元");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("兩次新密碼不一致");
      return;
    }

    setBusy(true);
    try {
      // 1. Verify current password
      const currentHash = await loadPasswordHash(true);
      const inputHash = await sha256Hex(currentPwd.trim());
      if (inputHash !== currentHash) {
        toast.error("目前密碼不正確");
        return;
      }

      // 2. Compute new hash
      const newHash = await sha256Hex(newPwd.trim());

      const apiBase = `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${AUTH_PATH}`;
      const headers = {
        Authorization: `Bearer ${gh.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      // 3. Get current file sha
      const getRes = await fetch(`${apiBase}?ref=${encodeURIComponent(gh.branch)}`, { headers });
      if (!getRes.ok) {
        const msg = await getRes.text();
        throw new Error(`讀取 GitHub 檔案失敗 (${getRes.status}): ${msg.slice(0, 200)}`);
      }
      const fileMeta = await getRes.json();
      const sha = fileMeta.sha as string;

      // Preserve existing fields such as adminPinSha256 when rotating password.
      let existingConfig: Record<string, unknown> = {};
      try {
        const rawContent = String(fileMeta.content ?? "").replace(/\s/g, "");
        existingConfig = JSON.parse(decodeURIComponent(escape(atob(rawContent))));
      } catch {
        existingConfig = {};
      }
      const newContent = JSON.stringify(
        { ...existingConfig, passwordSha256: newHash, updatedAt: new Date().toISOString() },
        null,
        2,
      ) + "\n";

      // 4. PUT new content
      const putRes = await fetch(apiBase, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `chore: rotate site password (${new Date().toISOString().slice(0, 10)})`,
          content: btoa(unescape(encodeURIComponent(newContent))),
          sha,
          branch: gh.branch,
        }),
      });
      if (!putRes.ok) {
        const msg = await putRes.text();
        throw new Error(`更新失敗 (${putRes.status}): ${msg.slice(0, 200)}`);
      }

      saveGh(gh);
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      toast.success("✅ 已更新！GitHub Actions 約 1–2 分鐘後自動重新部署，部署完成後所有同事下次解鎖須用新密碼。");
    } catch (err: any) {
      toast.error(err?.message ?? "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshSheets() {
    if (!gh.owner || !gh.repo || !gh.token) {
      toast.error("請先填寫 GitHub 設定（owner / repo / token）");
      return;
    }
    setRefreshBusy(true);
    try {
      const url = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions/workflows/deploy.yml/dispatches`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gh.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: gh.branch || "main" }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`觸發失敗 (${res.status}): ${msg.slice(0, 200)}`);
      }
      saveGh(gh);
      toast.success("✅ 已觸發！GitHub Actions 正在重新抓取 Sheet 並部署，約 1–2 分鐘後生效。");
    } catch (err: any) {
      toast.error(err?.message ?? "觸發失敗");
    } finally {
      setRefreshBusy(false);
    }
  }

  if (!pinOk) {
    return (
      <main className="mx-auto max-w-md px-6 py-12">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> 返回主頁
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5 text-primary" /> 管理員驗證
            </CardTitle>
            <CardDescription>請輸入管理員 PIN 以進入管理頁面。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePinSubmit} className="grid gap-3">
              <Input
                type="password"
                placeholder="管理員 PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                required
              />
              <Button type="submit" disabled={pinBusy}>
                {pinBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {pinBusy ? "驗證中…" : "進入"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/dashboard">
          <ArrowLeft className="h-4 w-4" /> 返回主頁
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> 管理 — 修改登入密碼
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          目前密碼 hash：<code className="text-xs">{hashPreview || "讀取中…"}</code>
        </p>
      </div>

      <Alert className="mb-6">
        <KeyRound className="h-4 w-4" />
        <AlertTitle>運作原理</AlertTitle>
        <AlertDescription className="text-sm">
          密碼以 SHA-256 hash 形式儲存於 <code>public/data/auth.json</code>。改密碼會經 GitHub API
          直接 commit 新 hash，GitHub Actions 隨即自動重新部署網站（約 1–2 分鐘）。
          已解鎖嘅同事一改密碼，下次自動失效要重新輸入。
        </AlertDescription>
      </Alert>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">GitHub 設定（首次使用）</CardTitle>
          <CardDescription>
            喺 GitHub → Settings → Developer settings → Personal access tokens → Fine-grained
            tokens 建立一個 token，repository access 揀返呢個 repo，permissions 開
            <strong> Contents: Read and write</strong> 同 <strong>Actions: Read and write</strong>
            （後者用嚟一鍵重新抓 Sheet）。Token 只會儲存喺你呢部瀏覽器嘅 localStorage。
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="owner">GitHub 帳號 / 組織</Label>
            <Input
              id="owner"
              placeholder="例：your-github-username"
              value={gh.owner}
              onChange={(e) => setGh({ ...gh, owner: e.target.value.trim() })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="repo">Repository 名稱</Label>
            <Input
              id="repo"
              placeholder="precision-masters"
              value={gh.repo}
              onChange={(e) => setGh({ ...gh, repo: e.target.value.trim() })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              value={gh.branch}
              onChange={(e) => setGh({ ...gh, branch: e.target.value.trim() || "main" })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="token">Personal Access Token</Label>
            <Input
              id="token"
              type="password"
              placeholder="github_pat_..."
              value={gh.token}
              onChange={(e) => setGh({ ...gh, token: e.target.value.trim() })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">修改密碼</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="current">目前密碼</Label>
              <Input
                id="current"
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new">新密碼（至少 6 字元）</Label>
              <Input
                id="new"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm">再次輸入新密碼</Label>
              <Input
                id="confirm"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "處理中…" : "更新密碼並部署"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
