import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSES } from "@/lib/courses";
import { getCourseSheet, type SheetRow } from "@/lib/sheets.functions";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CoursePage,
});

const COURSE_CONFIG: Record<
  string,
  {
    description: string;
    groupBy: string;
    titleField: string;
    fields: { key: string; label: string; long?: boolean }[];
  }
> = {
  "1": {
    description:
      "認識基本門窗類型。每個款式記錄：類型名稱、結構說明、基本／進階度尺方法、相片、影片。",
    groupBy: "category",
    titleField: "type_name",
    fields: [
      { key: "description", label: "結構說明", long: true },
      { key: "basic_measure", label: "基本度尺方法", long: true },
      { key: "advanced_measure", label: "進階度尺方法", long: true },
    ],
  },
  "2": {
    description: "鋁通料目錄，按大分類顯示，每個細分有用途及組合說明。",
    groupBy: "main_category",
    titleField: "sub_category",
    fields: [
      { key: "usage", label: "用途", long: true },
      { key: "combination", label: "組合", long: true },
    ],
  },
  "3": {
    description: "產品款式及測量方法。15 個欄位涵蓋規格、極限尺寸、做法、度尺方法及錯誤案例。",
    groupBy: "category",
    titleField: "product_name",
    fields: [
      { key: "supplier", label: "供應商" },
      { key: "compatible_doors_windows", label: "匹配門窗" },
      { key: "function", label: "功能" },
      { key: "frame_colors", label: "框色選擇" },
      { key: "mesh_options", label: "網材選擇" },
      { key: "specs", label: "產品規格", long: true },
      { key: "size_limits", label: "極限尺寸" },
      { key: "common_practices", label: "常見做法", long: true },
      { key: "special_practices", label: "特別做法", long: true },
      { key: "decision_tree", label: "決策流程樹", long: true },
      { key: "measuring_mnemonic", label: "度尺口訣", long: true },
      { key: "basic_measuring", label: "基本度尺方法", long: true },
      { key: "advanced_measuring", label: "進階度尺方法", long: true },
      { key: "error_cases", label: "錯誤案例庫", long: true },
    ],
  },
};

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
              <p className="mt-2 text-xs text-muted-foreground">
                請確認 Apps Script 已部署、SHEETS_API_URL 正確，並且工作表名稱為「{COURSE_CONFIG[courseId] && ({
                  "1": "course1_types",
                  "2": "course2_aluminium",
                  "3": "course3_products",
                } as Record<string, string>)[courseId]}」。
              </p>
            </Card>
          )}

          {data && <SheetContent rows={data.rows} config={config} />}
        </div>
      )}
    </main>
  );
}

function SheetContent({
  rows,
  config,
}: {
  rows: SheetRow[];
  config: (typeof COURSE_CONFIG)[string];
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        工作表暫無已發佈內容（published = TRUE）。
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
          <div className="mt-4 space-y-6">
            {groupRows.map((row, idx) => (
              <ItemBlock key={String(row.id ?? idx)} row={row} config={config} />
            ))}
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
  const photos = toArray(row.photos);
  const videos = toArray(row.videos);

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
