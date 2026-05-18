import { Link, useNavigate } from "@tanstack/react-router";
import { Ruler, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function SiteHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ruler className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">全港最精準度尺培訓平台</div>
            <div className="text-xs text-muted-foreground">Precision Masters</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4" /> 管理員後台
              </Button>
            </Link>
          )}
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="h-4 w-4" /> 登出
          </Button>
        </div>
      </div>
    </header>
  );
}
