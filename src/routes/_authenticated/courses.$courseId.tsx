import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSES } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  component: CoursePage,
});

interface CategoryPreview {
  name: string;
  items: { name: string; columns?: string[] }[];
}

const PREVIEWS: Record<string, { description: string; categories: CategoryPreview[] }> = {
  "1": {
    description:
      "認識基本門窗類型。每個款式記錄：款式名稱、特點、常見尺寸、應用場景、注意事項、圖片／影片。",
    categories: [
      {
        name: "門款（5 種）",
        items: [
          { name: "（待 Google Sheets 提供完整名單）" },
        ],
      },
      {
        name: "窗款（4 種）",
        items: [{ name: "（待 Google Sheets 提供完整名單）" }],
      },
    ],
  },
  "2": {
    description: "鋁通料目錄，每個分類下有：細分、用途、組合。",
    categories: [
      {
        name: "六大分類",
        items: [
          { name: "鋁扁", columns: ["細分", "用途", "組合"] },
          { name: "鋁角", columns: ["細分", "用途", "組合"] },
          { name: "鋁通", columns: ["細分", "用途", "組合"] },
          { name: "冚槽條", columns: ["細分", "用途", "組合"] },
          { name: "匠格底框", columns: ["細分", "用途", "組合"] },
          { name: "漢紗副框", columns: ["細分", "用途", "組合"] },
        ],
      },
    ],
  },
  "3": {
    description:
      "產品款式及測量方法。每個款式記錄 15 個欄位：款式名稱、供應商、匹配門窗、功能、框色選擇、網材選擇、產品規格、極限尺寸、款式常見做法、款式特別做法、決策流程樹、度尺口訣、基本度尺方法、進階度尺方法、錯誤案例庫。",
    categories: [
      {
        name: "門款（3 種）",
        items: [
          { name: "H2 回捲門款" },
          { name: "H7 趟門款" },
          { name: "百摺款" },
        ],
      },
      {
        name: "窗款（6 種）",
        items: [
          { name: "H2 回捲窗款" },
          { name: "掩合款" },
          { name: "平推款" },
          { name: "H2F 透明窗花回捲款" },
          { name: "口袋款" },
          { name: "透明窗花" },
        ],
      },
    ],
  },
};

function CoursePage() {
  const { courseId } = Route.useParams();
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) throw notFound();

  const preview = PREVIEWS[courseId];

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
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            此課程內容稍後提供。確認分類及欄位後會即時補上。
          </p>
        </Card>
      )}

      {course.status === "manual" && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            此課程內容不經 Google Sheets，會由系統內建。詳情待定。
          </p>
        </Card>
      )}

      {preview && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-muted-foreground">課程簡介</h2>
            <p className="mt-2 text-sm leading-relaxed">{preview.description}</p>
          </Card>

          {preview.categories.map((cat) => (
            <Card key={cat.name} className="p-6">
              <h2 className="text-base font-semibold">{cat.name}</h2>
              <ul className="mt-3 divide-y">
                {cat.items.map((it) => (
                  <li key={it.name} className="py-3">
                    <div className="text-sm font-medium">{it.name}</div>
                    {it.columns && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {it.columns.map((col) => (
                          <Badge key={col} variant="secondary" className="text-xs font-normal">
                            {col}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}

          <Card className="border-dashed bg-muted/30 p-6">
            <p className="text-xs text-muted-foreground">
              ⓘ 資料尚未連接 Google Sheets。連接後此頁會自動顯示完整內容（包括相片、影片、文字）。
            </p>
          </Card>
        </div>
      )}
    </main>
  );
}
