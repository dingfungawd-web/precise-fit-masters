import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Loader2, AlertCircle, CheckCircle2, Lightbulb, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getCourseSheet, type SheetRow } from "@/lib/sheets.functions";
import { parseVideos, parseImageItems, splitItems, YouTubeVideoList, type ParsedVideo, type ParsedImageItem } from "@/components/youtube-videos";

type Case = {
  分類: string; // 門款 / 窗款
  種類: string;
  款式: string;
  標題: string;
  現場情況: string;
  問題狀況: string;
  根本原因: string;
  正確做法: string;
  預防要點: string;
  媒體: string;
  raw: SheetRow;
};

function s(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join("\n");
  return String(v).trim();
}

function toCase(row: SheetRow): Case {
  return {
    分類: s(row["門窗分類"]) || "未分類",
    種類: s(row["門窗種類"]),
    款式: s(row["產品款式"]) || "未分類",
    標題: s(row["案例標題"]) || "（未命名案例）",
    現場情況: s(row["現場情況"]),
    問題狀況: s(row["問題狀況"]),
    根本原因: s(row["根本原因"]),
    正確做法: s(row["正確/建議做法"]) || s(row["正確做法"]) || s(row["建議做法"]),
    預防要點: s(row["預防要點"]),
    媒體: s(row["圖片影片分享"]),
    raw: row,
  };
}

// Google Drive URL → embeddable image URL
function extractDriveId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes("drive.google.com") && !u.hostname.includes("googleusercontent.com")) return null;
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) return m[1];
    const id = u.searchParams.get("id");
    if (id) return id;
    const m2 = u.pathname.match(/\/d\/([^/=]+)/);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
}

function driveDisplayUrl(url: string): string {
  const id = extractDriveId(url);
  if (!id) return url;
  // =s0 = 原圖原尺寸
  return `https://lh3.googleusercontent.com/d/${id}=s0`;
}

function driveOriginalLink(url: string): string {
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/view`;
}

function isYouTube(url: string): boolean {
  try {
    const h = new URL(url.trim()).hostname.replace(/^www\./, "");
    return h === "youtu.be" || h.endsWith("youtube.com");
  } catch {
    return false;
  }
}

type ImageEntry = { kind: "image"; displayUrl: string; linkUrl: string; caption: string };
type VideoEntry = { kind: "video"; video: ParsedVideo };
type MediaItem = ImageEntry | VideoEntry;
type Media = { items: MediaItem[] };

function parseMedia(raw: string): Media {
  const items: MediaItem[] = [];
  for (const it of splitItems(raw)) {
    const yt = parseVideos(it.url + (it.lines.length ? "\n" + it.lines.join("\n") : ""));
    if (yt.length > 0) {
      items.push({ kind: "video", video: yt[0] });
      continue;
    }
    const caption = it.lines.join("\n").trim();
    if (extractDriveId(it.url)) {
      items.push({ kind: "image", displayUrl: driveDisplayUrl(it.url), linkUrl: driveOriginalLink(it.url), caption });
    } else {
      items.push({ kind: "image", displayUrl: it.url, linkUrl: it.url, caption });
    }
  }
  return { items };
}

export function Course5GoldenCases() {
  const fetchSheet = useServerFn(getCourseSheet);
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-sheet", "5"],
    queryFn: () => fetchSheet({ data: { courseId: "5" } }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const [tab, setTab] = useState<"門款" | "窗款">("門款");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");

  const cases = useMemo<Case[]>(() => (data?.rows ?? []).map(toCase), [data]);

  if (isLoading) {
    return (
      <Card className="mt-6 flex items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在從 Google Sheets 載入案例…
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="mt-6 border-destructive/50 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">無法讀取 Google Sheets</p>
        <p className="mt-1 text-muted-foreground">{(error as Error).message}</p>
      </Card>
    );
  }
  if (cases.length === 0) {
    return (
      <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
        工作表「課程五黃金案例庫」暫無內容。請在 Google Sheets 加入案例後重新整理。
      </Card>
    );
  }

  // Filter by tab
  const tabCases = cases.filter((c) => c.分類 === tab);

  // Group by 產品款式
  const styleGroups = new Map<string, Case[]>();
  for (const c of tabCases) {
    if (!styleGroups.has(c.款式)) styleGroups.set(c.款式, []);
    styleGroups.get(c.款式)!.push(c);
  }

  // Detail view
  if (selectedStyle && selectedCaseIdx !== null) {
    const styleCases = styleGroups.get(selectedStyle) ?? [];
    const c = styleCases[selectedCaseIdx];
    if (!c) {
      setSelectedCaseIdx(null);
      return null;
    }
    return (
      <div className="mt-6 space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => { setSelectedStyle(null); setSelectedCaseIdx(null); }}>
                  {tab}
                </button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => setSelectedCaseIdx(null)}>{selectedStyle}</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1">{c.標題}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <CaseDetail c={c} />

        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedCaseIdx(null)}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> 返回案例列表
          </button>
          <div className="flex gap-2">
            <button
              disabled={selectedCaseIdx === 0}
              onClick={() => setSelectedCaseIdx(selectedCaseIdx - 1)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-40"
            >
              上一個
            </button>
            <button
              disabled={selectedCaseIdx >= styleCases.length - 1}
              onClick={() => setSelectedCaseIdx(selectedCaseIdx + 1)}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-40"
            >
              下一個
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case list view (within a style)
  if (selectedStyle) {
    const styleCases = styleGroups.get(selectedStyle) ?? [];
    return (
      <div className="mt-6 space-y-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <button onClick={() => setSelectedStyle(null)}>{tab}</button>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{selectedStyle}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Card className="p-6">
          <h2 className="text-base font-semibold">
            {selectedStyle}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              （{styleCases.length} 個案例）
            </span>
          </h2>
          <div className="mt-4 grid gap-2">
            {styleCases.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedCaseIdx(i)}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-left text-sm hover:border-accent hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.標題}</p>
                  {c.種類 && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.種類}</p>
                  )}
                </div>
                <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // Style list (with optional keyword filter)
  const kw = keyword.trim().toLowerCase();
  const filteredEntries = Array.from(styleGroups.entries())
    .map(([style, list]) => {
      if (!kw) return [style, list] as const;
      const matches = list.filter((c) =>
        [c.標題, c.種類, c.款式, c.問題狀況, c.根本原因, c.正確做法, c.預防要點]
          .join(" ").toLowerCase().includes(kw),
      );
      return [style, matches] as const;
    })
    .filter(([, list]) => list.length > 0);

  return (
    <div className="mt-6 space-y-4">
      <Tabs value={tab} onValueChange={(v) => { setTab(v as "門款" | "窗款"); setSelectedStyle(null); }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="門款">門款</TabsTrigger>
            <TabsTrigger value="窗款">窗款</TabsTrigger>
          </TabsList>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="搜尋案例關鍵字…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:w-64"
            />
          </div>
        </div>

        <TabsContent value={tab} className="mt-4">
          {filteredEntries.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              暫無符合條件的案例。
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEntries.map(([style, list]) => (
                <button
                  key={style}
                  onClick={() => setSelectedStyle(style)}
                  className="group flex items-center justify-between rounded-lg border bg-card p-4 text-left hover:border-accent hover:bg-accent/30 transition-colors"
                >
                  <div>
                    <p className="font-medium">{style}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {list.length} 個案例
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CaseDetail({ c }: { c: Case }) {
  const media = parseMedia(c.媒體);

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{c.分類}</Badge>
        {c.種類 && <Badge variant="outline">{c.種類}</Badge>}
        <Badge variant="outline">{c.款式}</Badge>
      </div>
      <h2 className="mt-3 text-xl font-semibold">{c.標題}</h2>

      <div className="mt-6 space-y-5">
        {c.現場情況 && (
          <Section title="現場情況">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.現場情況}</p>
          </Section>
        )}

        {c.問題狀況 && (
          <Section
            title="問題狀況"
            icon={<AlertCircle className="h-4 w-4 text-destructive" />}
            accent="destructive"
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.問題狀況}</p>
          </Section>
        )}

        {c.根本原因 && (
          <Section title="根本原因">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.根本原因}</p>
          </Section>
        )}

        {c.正確做法 && (
          <Section
            title="正確/建議做法"
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            accent="success"
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.正確做法}</p>
          </Section>
        )}

        {c.預防要點 && (
          <Section
            title="預防要點"
            icon={<Lightbulb className="h-4 w-4 text-amber-500" />}
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.預防要點}</p>
          </Section>
        )}

        {media.items.length > 0 && (
          <Section title="圖片影片分享">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {media.items.map((m, i) =>
                m.kind === "image" ? (
                  <figure key={`img-${i}`} className="overflow-hidden rounded border bg-muted">
                    <a
                      href={m.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block"
                      title="按一下開啟原圖"
                    >
                      <img
                        src={m.displayUrl}
                        alt={m.caption || `案例相片 ${i + 1}`}
                        loading="lazy"
                        className="h-40 w-full object-cover transition-transform hover:scale-[1.02]"
                      />
                    </a>
                    {m.caption && (
                      <figcaption className="whitespace-pre-wrap px-2 py-1.5 text-xs leading-snug text-muted-foreground">
                        {m.caption}
                      </figcaption>
                    )}
                  </figure>
                ) : (
                  <div key={`vid-${i}`} className="[&>div]:mt-0 [&>div]:grid-cols-1">
                    <YouTubeVideoList videos={[m.video]} />
                  </div>
                )
              )}
            </div>
          </Section>
        )}
      </div>
    </Card>
  );
}

function Section({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: "destructive" | "success";
  children: React.ReactNode;
}) {
  const accentCls =
    accent === "destructive"
      ? "border-l-2 border-destructive/60 pl-3"
      : accent === "success"
        ? "border-l-2 border-emerald-500/60 pl-3"
        : "";
  return (
    <div className={accentCls}>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}
