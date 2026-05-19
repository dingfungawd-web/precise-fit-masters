import { useState } from "react";
import { Play, ExternalLink } from "lucide-react";

export type ParsedVideo = { title: string; url: string; id: string };

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (host.endsWith("youtube.com") || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /live/ID
      if (parts.length >= 2 && ["embed", "shorts", "live"].includes(parts[0])) {
        return parts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function parseVideos(raw: unknown): ParsedVideo[] {
  if (typeof raw !== "string") return [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedVideo[] = [];
  for (const line of lines) {
    const sepIdx = line.indexOf("::");
    let title = "";
    let url = line;
    if (sepIdx !== -1) {
      title = line.slice(0, sepIdx).trim();
      url = line.slice(sepIdx + 2).trim();
    }
    const id = extractYouTubeId(url);
    if (!id) continue;
    out.push({ title: title || "影片", url, id });
  }
  return out;
}

export function YouTubeVideoList({ videos }: { videos: ParsedVideo[] }) {
  if (videos.length === 0) return null;
  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {videos.map((v, i) => (
        <YouTubeVideoCard key={`${v.id}-${i}`} video={v} />
      ))}
    </div>
  );
}

function YouTubeVideoCard({ video }: { video: ParsedVideo }) {
  const [playing, setPlaying] = useState(false);
  const thumb = `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="relative aspect-video w-full bg-muted">
        {playing ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex items-center justify-center"
            aria-label={`播放 ${video.title}`}
          >
            <img
              src={thumb}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
            <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/30" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-0.5 h-7 w-7 fill-current" />
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="truncate text-sm font-medium">{video.title}</p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          YouTube <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
