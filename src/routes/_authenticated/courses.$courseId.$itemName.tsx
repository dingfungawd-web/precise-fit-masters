import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { COURSES } from "@/lib/courses";
import { getCourseSheet, type SheetRow } from "@/lib/sheets.functions";
import { COURSE_CONFIG } from "@/lib/course-config";
import { parseVideos, YouTubeVideoList } from "@/components/youtube-videos";

export const Route = createFileRoute("/_authenticated/courses/$courseId/$itemName")({
  component: ItemDetailPage,
});

function ItemDetailPage() {
  const { courseId, itemName } = Route.useParams();
  const course = COURSES.find((c) => c.id === courseId);
  if (!course) throw notFound();
  const config = COURSE_CONFIG[courseId];
  if (!config) throw notFound();

  const fetchSheet = useServerFn(getCourseSheet);
  const { data, isLoading, error } = useQuery({
    queryKey: ["course-sheet", courseId],
    queryFn: () => fetchSheet({ data: { courseId } }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (count, err) => {
      if ((err as Error)?.message?.includes("429")) return false;
      return count < 2;
    },
  });

  const row = data?.rows.find((r) => String(r[config.titleField] ?? "") === itemName);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link
        to="/courses/$courseId"
        params={{ courseId }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> 返回 {course.title}
      </Link>

      <div className="mt-4 mb-6">
        <div className="text-sm font-medium text-accent">{course.number}</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{itemName}</h1>
        {row && (
          <p className="mt-2 text-sm text-muted-foreground">
            {String(row[config.groupBy] ?? "")}
          </p>
        )}
      </div>

      {isLoading && (
        <Card className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 載入中…
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">無法讀取資料</p>
          <p className="mt-1 text-muted-foreground">{(error as Error).message}</p>
        </Card>
      )}

      {data && !row && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          找唔到「{itemName}」呢個款式。
        </Card>
      )}

      {row && <DetailCard row={row} config={config} />}
    </main>
  );
}

function DetailCard({
  row,
  config,
}: {
  row: SheetRow;
  config: (typeof COURSE_CONFIG)[string];
}) {
  const photos = toArray(row["相片"]);
  const videos = toArray(row["影片"]);

  return (
    <Card className="p-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        {config.fields.map((f) => {
          const v = row[f.key];
          const videos = f.videoKey ? parseVideos(row[f.videoKey]) : [];
          const hasValue = !(v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
          if (!hasValue && videos.length === 0) return null;
          return (
            <div key={f.key} className={f.long || videos.length > 0 ? "sm:col-span-2" : ""}>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </dt>
              {hasValue && (
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
              )}
              {videos.length > 0 && <YouTubeVideoList videos={videos} />}
            </div>
          );
        })}
      </dl>

      {photos.length > 0 && (
        <div className="mt-6">
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
        <div className="mt-6">
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
    </Card>
  );
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split("|").map((s) => s.trim()).filter(Boolean);
  return [];
}
