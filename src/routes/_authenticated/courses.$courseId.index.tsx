import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSES } from "@/lib/courses";
import { getCourseSheet, type SheetRow } from "@/lib/sheets.functions";
import { COURSE_CONFIG } from "@/lib/course-config";
import { Course4DecisionTool } from "@/components/course4-decision-tool";
import { Course5GoldenCases } from "@/components/course5-golden-cases";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) throw notFound();

  const config = COURSE_CONFIG[courseId];
  const fetchSheet = useServerFn(getCourseSheet);

  const { data, isLoading, error } = useQuery({
    queryKey: ["course-sheet", courseId],
    queryFn: () => fetchSheet({ data: { courseId } }),
    enabled: !!config,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (count, err) => {
      if ((err as Error)?.message?.includes("429")) return false;
      return count < 2;
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回課程目錄
      </Link>

      <div className="mt-4 mb-8">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-accent">{course.number}</span>
          {course.status === "placeholder" && (
            <Badge variant="secondary" className="text-xs">待定</Badge>
          )}
          {course.status === "manual" && (
            <Badge variant="outline" className="text-xs">系統內建</Badge>
          )}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{course.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{course.subtitle}</p>
      </div>

      {course.status === "placeholder" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          此課程內容稍後提供。確認分類及欄位後會即時補上。
        </Card>
      )}

      {course.status === "manual" && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          此課程內容不經 Google Sheets，會由系統內建。詳情待定。
        </Card>
      )}

      {courseId === "4" && <Course4DecisionTool />}
      {courseId === "5" && <Course5GoldenCases />}




      {config && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-muted-foreground">課程簡介</h2>
            <p className="mt-2 text-sm leading-relaxed">{config.description}</p>
          </Card>

          {isLoading && (
            <Card className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在從 Google Sheets 載入資料…
            </Card>
          )}

          {error && (
            <Card className="border-destructive/50 bg-destructive/5 p-6 text-sm">
              <p className="font-medium text-destructive">無法讀取 Google Sheets</p>
              <p className="mt-1 text-muted-foreground">{(error as Error).message}</p>
            </Card>
          )}

          {data && (
            <SheetContent
              rows={data.rows}
              config={config}
              courseId={courseId}
              listOnly={courseId === "3" || courseId === "1"}
            />
          )}
        </div>
      )}
    </main>
  );
}

function SheetContent({
  rows,
  config,
  courseId,
  listOnly,
}: {
  rows: SheetRow[];
  config: (typeof COURSE_CONFIG)[string];
  courseId: string;
  listOnly?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        工作表暫無內容。
      </Card>
    );
  }

  const groups = new Map<string, SheetRow[]>();
  for (const row of rows) {
    const key = String(row[config.groupBy] ?? "未分類");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  return (
    <>
      {Array.from(groups.entries()).map(([groupName, groupRows]) => (
        <Card key={groupName} className="p-6">
          <h2 className="text-base font-semibold">
            {groupName} <span className="text-xs font-normal text-muted-foreground">（{groupRows.length}）</span>
          </h2>
          <div className={listOnly ? "mt-4 grid gap-2 sm:grid-cols-2" : "mt-4 space-y-6"}>
            {groupRows.map((row, idx) => {
              const name = String(row[config.titleField] ?? "（未命名）");
              if (listOnly) {
                return (
                  <Link
                    key={`${name}-${idx}`}
                    to="/courses/$courseId/$itemName"
                    params={{ courseId, itemName: name }}
                    className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-accent/40 hover:border-accent transition-colors"
                  >
                    <span>{name}</span>
                    <span className="text-muted-foreground">›</span>
                  </Link>
                );
              }
              return <ItemBlock key={String(row.id ?? idx)} row={row} config={config} />;
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

function ItemBlock({
  row,
  config,
}: {
  row: SheetRow;
  config: (typeof COURSE_CONFIG)[string];
}) {
  const photos = toArray(row["相片"]);
  const videos = toArray(row["影片"]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-base font-semibold">{String(row[config.titleField] ?? "（未命名）")}</h3>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {config.fields.map((f) => {
          const v = row[f.key];
          if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
          return (
            <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {Array.isArray(v) ? (
                  <div className="flex flex-wrap gap-1">
                    {v.map((x) => (
                      <Badge key={x} variant="secondary" className="text-xs font-normal">
                        {x}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  String(v)
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {photos.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">相片</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border">
                <img src={url} alt="" loading="lazy" className="h-32 w-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">影片</div>
          <ul className="mt-2 space-y-1 text-sm">
            {videos.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split("|").map((s) => s.trim()).filter(Boolean);
  return [];
}
