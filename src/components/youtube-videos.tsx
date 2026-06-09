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
      if (parts.length >= 2 && ["embed", "shorts", "live"].includes(parts[0])) {
        return parts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 統一解析規則：
 *  - 以 http(s):// 開頭的一行 = 新項目（URL）
 *  - 之後的非 URL 行 = 該項目的多行說明
 *  - 向後相容：「說明 :: URL」單行寫法亦可
 */
type Item = { url: string; lines: string[] };

function splitItems(raw: string): Item[] {
  const rawLines = raw.split(/\r?\n/).map((l) => l.trim());
  const items: Item[] = [];
  let current: Item | null = null;
  const push = () => {
    if (current) items.push(current);
    current = null;
  };
  for (const line of rawLines) {
    if (!line) continue;
    // legacy single-line "說明 :: URL"
    const sepIdx = line.indexOf("::");
    if (sepIdx !== -1) {
      const left = line.slice(0, sepIdx).trim();
      const right = line.slice(sepIdx + 2).trim();
      if (/^https?:\/\//i.test(right)) {
        push();
        items.push({ url: right, lines: left ? [left] : [] });
        continue;
      }
    }
    if (/^https?:\/\//i.test(line)) {
      push();
      current = { url: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  push();
  return items;
}

export function parseVideos(raw: unknown): ParsedVideo[] {
  if (typeof raw !== "string") return [];
  const out: ParsedVideo[] = [];
  for (const item of splitItems(raw)) {
    const id = extractYouTubeId(item.url);
    if (!id) continue;
    const title = item.lines.join("\n").trim() || "影片";
    out.push({ title, url: item.url, id });
  }
  return out;
}

export type ParsedImageItem = { url: string; caption: string };

/** 解析非 YouTube 的 URL 項目（保留 caption 多行） */
export function parseImageItems(raw: string): ParsedImageItem[] {
  const out: ParsedImageItem[] = [];
  for (const item of splitItems(raw)) {
    if (extractYouTubeId(item.url)) continue;
    out.push({ url: item.url, caption: item.lines.join("\n").trim() });
  }
  return out;
}

/** 公用 splitter 給 caller 自行分流 */
export { splitItems };

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
      <div className="flex items-start justify-between gap-2 px-3 py-2">
        <p className="whitespace-pre-wrap text-sm font-medium leading-snug">{video.title}</p>
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
