import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Trash2, Loader2, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { listAccounts, createAccount, deleteAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const del = useServerFn(deleteAccount);
  const qc = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: (data: { email: string; password: string; display_name: string; is_admin: boolean }) =>
      create({ data }),
    onSuccess: () => {
      toast.success("帳號已建立");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error("建立失敗", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("帳號已刪除");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error("刪除失敗", { description: e.message }),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAdminNew, setIsAdminNew] = useState(false);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createMut.mutate(
      { email, password, display_name: displayName, is_admin: isAdminNew },
      {
        onSuccess: () => {
          setEmail("");
          setPassword("");
          setDisplayName("");
          setIsAdminNew(false);
        },
      }
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">管理員後台</h1>
      <p className="mt-2 text-sm text-muted-foreground">建立、管理員工帳號。</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="h-5 w-5" /> 新增帳號
          </h2>
          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-name">顯示名稱</Label>
              <Input id="d-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-email">電郵</Label>
              <Input id="d-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-pw">密碼（最少 8 字元）</Label>
              <Input id="d-pw" type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isAdminNew} onCheckedChange={(v) => setIsAdminNew(!!v)} />
              設為管理員
            </label>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              建立帳號
            </Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">員工列表</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ul className="mt-4 divide-y">
              {accounts?.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-sm font-medium">{a.display_name ?? a.email}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                    <div className="mt-1 flex gap-1">
                      {a.roles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">
                          {r === "admin" ? "管理員" : "員工"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`確定刪除 ${a.email}？`)) delMut.mutate(a.id);
                    }}
                    disabled={delMut.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
              {accounts?.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">未有帳號</li>
              )}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
