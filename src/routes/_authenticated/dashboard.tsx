import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import { COURSES } from "@/lib/courses";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <p className="text-sm text-muted-foreground">
          歡迎{user?.user_metadata?.display_name ? `，${user.user_metadata.display_name}` : ""}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">六大課程</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          選擇課程開始學習。內容會由 Google Sheets 自動同步。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COURSES.map((c) => (
          <Link
            key={c.id}
            to="/courses/$courseId"
            params={{ courseId: c.id }}
            className="group"
          >
            <Card className="flex h-full flex-col p-6 transition-all hover:border-accent hover:shadow-md">
              <div className="flex items-start justify-between">
                <span className="text-xs font-medium text-accent">{c.number}</span>
                {c.status === "placeholder" && (
                  <Badge variant="secondary" className="text-xs">待定</Badge>
                )}
                {c.status === "manual" && (
                  <Badge variant="outline" className="text-xs">系統內建</Badge>
                )}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{c.subtitle}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-foreground/80 group-hover:text-accent">
                進入課程 <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
