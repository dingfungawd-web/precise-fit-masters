import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Ruler, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useGate } from "@/lib/gate-context";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: UnlockPage,
});

function UnlockPage() {
  const { unlocked, ready, unlock } = useGate();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (ready && unlocked) {
    return <Navigate to="/dashboard" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await unlock(password);
    setSubmitting(false);
    if (!ok) {
      toast.error("密碼錯誤", { description: "請聯絡管理員取得本月密碼。" });
      return;
    }
    toast.success("解鎖成功");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Ruler className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">全港最精準度尺培訓平台</h1>
          <p className="mt-1 text-sm text-muted-foreground">Precision Masters — 內部員工培訓系統</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">本月密碼</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={submitting}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || !password}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "進入培訓平台"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            密碼每月更換，請向管理員索取。
          </p>
        </form>
      </Card>
    </div>
  );
}
