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

      <div className="mt-4 mb-8">
        <div className="text-sm font-medium text-accent">{course.number}</div>
        <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">{itemName}</h1>
        {row && (
          <p className="mt-3 text-base text-muted-foreground">
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
    <Card className="divide-y divide-border p-0">
      {config.fields.map((f) => {
        const v = row[f.key];
        const fieldVideos = f.videoKey ? parseVideos(row[f.videoKey]) : [];
        const hasValue = !(v === undefined || v === "" || (Array.isArray(v) && v.length === 0));
        if (!hasValue && fieldVideos.length === 0) return null;
        return (
          <section key={f.key} className="px-6 py-5">
            <h2 className="text-xl font-semibold tracking-tight">{f.label}</h2>
            {hasValue && (
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
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
              </div>
            )}
            {fieldVideos.length > 0 && <YouTubeVideoList videos={fieldVideos} />}
          </section>
        );
      })}

      {photos.length > 0 && (
        <section className="px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight">相片</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border">
                <img src={url} alt="" loading="lazy" className="h-32 w-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="px-6 py-5">
          <h2 className="text-xl font-semibold tracking-tight">影片</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {videos.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  );
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split("|").map((s) => s.trim()).filter(Boolean);
  return [];
}
