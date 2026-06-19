import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Trash2, Loader2, UserPlus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { listAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Account = {
  id: string;
  email: string;
  display_name: string | null;
  employee_id: string | null;
  status: string;
  roles: string[];
};

function AdminPage() {
  const { isAdmin, loading, user } = useAuth();
  const list = useServerFn(listAccounts);
  const create = useServerFn(createAccount);
  const update = useServerFn(updateAccount);
  const del = useServerFn(deleteAccount);
  const qc = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => list(),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: (data: { employee_id: string; password: string; display_name: string; is_admin: boolean }) =>
      create({ data }),
    onSuccess: () => {
      toast.success("帳號已建立");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error("建立失敗", { description: e.message }),
  });

  const updateMut = useMutation({
    mutationFn: (data: {
      user_id: string;
      display_name?: string;
      password?: string;
      status?: "active" | "inactive";
      is_admin?: boolean;
    }) => update({ data }),
    onSuccess: () => {
      toast.success("已更新");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error("更新失敗", { description: e.message }),
  });

  const delMut = useMutation({
    mutationFn: (user_id: string) => del({ data: { user_id } }),
    onSuccess: () => {
      toast.success("帳號已刪除");
      qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: Error) => toast.error("刪除失敗", { description: e.message }),
  });

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isAdminNew, setIsAdminNew] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  function onCreate(e: FormEvent) {
    e.preventDefault();
    createMut.mutate(
      { employee_id: employeeId, password, display_name: displayName, is_admin: isAdminNew },
      {
        onSuccess: () => {
          setEmployeeId("");
          setPassword("");
          setDisplayName("");
          setIsAdminNew(false);
        },
      },
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">管理員後台</h1>
      <p className="mt-2 text-sm text-muted-foreground">建立、管理員工帳號。員工以員工編號登入。</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="h-5 w-5" /> 新增帳號
          </h2>
          <form onSubmit={onCreate} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-empid">員工編號（登入用）</Label>
              <Input
                id="d-empid"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="例如：A001"
                pattern="[A-Za-z0-9_\-]+"
                required
              />
              <p className="text-xs text-muted-foreground">英文字母、數字、_ 或 -，員工以此登入</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-name">員工名稱（顯示用）</Label>
              <Input
                id="d-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：張志偉"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-pw">密碼（最少 6 字元）</Label>
              <Input
                id="d-pw"
                type="text"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>權限：管理員</span>
              <Switch checked={isAdminNew} onCheckedChange={setIsAdminNew} />
            </label>
            <Button type="submit" className="w-full" disabled={createMut.isPending}>
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
              {(accounts as Account[] | undefined)?.map((a) => {
                const isSelf = a.id === user?.id;
                const isInactive = a.status === "inactive";
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{a.display_name ?? "(未命名)"}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.employee_id ?? a.email}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.roles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">
                            {r === "admin" ? "管理員" : "員工"}
                          </Badge>
                        ))}
                        <Badge variant={isInactive ? "destructive" : "outline"} className="text-xs">
                          {isInactive ? "離職" : "在職"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSelf || delMut.isPending}
                        onClick={() => {
                          if (confirm(`確定刪除 ${a.display_name ?? a.employee_id ?? a.email}？此動作不能復原。`))
                            delMut.mutate(a.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
              {accounts?.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">未有帳號</li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <EditDialog
        account={editing}
        onClose={() => setEditing(null)}
        onSave={(payload) =>
          updateMut.mutate(payload, {
            onSuccess: () => setEditing(null),
          })
        }
        saving={updateMut.isPending}
        isSelf={editing?.id === user?.id}
      />
    </main>
  );
}

function EditDialog({
  account,
  onClose,
  onSave,
  saving,
  isSelf,
}: {
  account: Account | null;
  onClose: () => void;
  onSave: (data: {
    user_id: string;
    display_name?: string;
    password?: string;
    status?: "active" | "inactive";
    is_admin?: boolean;
  }) => void;
  saving: boolean;
  isSelf: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isAdmin, setIsAdmin] = useState(false);

  // Reset when opening different account
  const accountId = account?.id;
  useState(() => undefined); // noop
  if (account && accountId !== undefined) {
    // sync once when account changes
  }

  // Use effect-like sync via key prop is cleaner; do it inline:
  if (account && (window as unknown as { __lastEditId?: string }).__lastEditId !== account.id) {
    (window as unknown as { __lastEditId?: string }).__lastEditId = account.id;
    setDisplayName(account.display_name ?? "");
    setPassword("");
    setStatus((account.status as "active" | "inactive") ?? "active");
    setIsAdmin(account.roles.includes("admin"));
  }
  if (!account && (window as unknown as { __lastEditId?: string }).__lastEditId) {
    (window as unknown as { __lastEditId?: string }).__lastEditId = undefined;
  }

  function submit() {
    if (!account) return;
    onSave({
      user_id: account.id,
      display_name: displayName,
      password: password.trim() ? password : undefined,
      status,
      is_admin: isAdmin,
    });
  }

  return (
    <Dialog open={!!account} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯帳號 — {account?.employee_id ?? ""}</DialogTitle>
        </DialogHeader>
        {account && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>員工編號</Label>
              <Input value={account.employee_id ?? account.email} disabled />
              <p className="text-xs text-muted-foreground">員工編號建立後不能修改</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-name">員工名稱</Label>
              <Input id="e-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pw">新密碼（留空即不修改）</Label>
              <Input
                id="e-pw"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="最少 6 字元"
              />
            </div>
            <div className="space-y-1.5">
              <Label>狀態</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "inactive")} disabled={isSelf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">在職</SelectItem>
                  <SelectItem value="inactive">離職（即時封鎖登入）</SelectItem>
                </SelectContent>
              </Select>
              {isSelf && <p className="text-xs text-muted-foreground">不可以將自己設為離職</p>}
            </div>
            <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <span>權限：管理員</span>
              <Switch checked={isAdmin} onCheckedChange={setIsAdmin} disabled={isSelf} />
            </label>
            {isSelf && <p className="text-xs text-muted-foreground">不可以修改自己的管理員權限</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            儲存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
