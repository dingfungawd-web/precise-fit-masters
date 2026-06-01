import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, Loader2, RotateCcw, ChevronRight, Lightbulb, AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getCourseSheet, type SheetRow } from "@/lib/sheets.functions";
import { parseVideos, YouTubeVideoList } from "@/components/youtube-videos";

// Expected columns in Google Sheet "課程四流程決策樹形圖":
// 用途 | 屋苑類型 | 門窗種類 | 款式名稱 | 現場情況 | 建議做法 | 注意事項 | 影片連結
// Multi-value cells separated by "|" (e.g. 用途 = "防蚊|居家防護")

type Rule = {
  用途: string[];
  屋苑類型: string[];
  門窗種類: string[];
  款式名稱: string;
  現場情況: string[];
  建議做法: string;
  注意事項: string;
  影片連結: string;
};

const STEPS = ["用途", "屋苑類型", "門窗種類", "款式名稱", "現場情況"] as const;
type StepKey = (typeof STEPS)[number];

function splitMulti(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v.split(/[|｜,，;；\n]/).map((s) => s.trim()).filter(Boolean);
}

function toRules(row: SheetRow): Rule[] {
  const base = {
    用途: splitMulti(row["用途"]),
    屋苑類型: splitMulti(row["屋苑類型"]),
    門窗種類: splitMulti(row["門窗種類"]),
    現場情況: splitMulti(row["現場情況"]),
    建議做法: String(row["建議做法"] ?? "").trim(),
    注意事項: String(row["注意事項"] ?? "").trim(),
    影片連結: String(row["影片連結"] ?? "").trim(),
  };
  const names = splitMulti(row["款式名稱"]);
  return names.map((n) => ({ ...base, 款式名稱: n }));
}

export function Course4DecisionTool() {
  const fetchSheet = useServerFn(getCourseSheet);
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["course-sheet", "4"],
    queryFn: () => fetchSheet({ data: { courseId: "4" } }),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (count, err) => (((err as Error)?.message?.includes("429")) ? false : count < 2),
  });

  const rules: Rule[] = useMemo(() => (data?.rows ?? []).map(toRule).filter((r) => r.款式名稱), [data]);

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在從 Google Sheets 載入決策規則…
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">無法讀取 Google Sheets</p>
        <p className="mt-1 text-muted-foreground">{(error as Error).message}</p>
      </Card>
    );
  }

  if (rules.length === 0) {
    return (
      <Card className="p-6 text-sm">
        <p className="font-medium">未偵測到決策規則</p>
        <p className="mt-2 text-muted-foreground">
          請喺 Google Sheets 分頁「課程四流程決策樹形圖」加入以下欄位（第一行為標題），每一行 = 一條規則：
        </p>
        <div className="mt-3 overflow-x-auto rounded-md border bg-muted/30 p-3 text-xs font-mono">
          用途 | 屋苑類型 | 門窗種類 | 款式名稱 | 現場情況 | 建議做法 | 注意事項 | 影片連結
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          備註：「用途」「屋苑類型」「門窗種類」「現場情況」可以一格填多個值，用「|」分隔（例如：防蚊|居家防護）。
          「影片連結」可貼 YouTube 連結，多條請每行一條。
        </p>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="assistant" className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          已載入 {rules.length} 條規則。喺 Google Sheets 改完後請按右邊「重新整理」即時更新。
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["course-sheet", "4"] });
            refetch();
          }}
          disabled={isFetching}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
          重新整理
        </Button>
      </div>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="assistant">互動決策助手</TabsTrigger>
        <TabsTrigger value="tree">視覺化決策樹</TabsTrigger>
        <TabsTrigger value="index">款式索引</TabsTrigger>
      </TabsList>

      <TabsContent value="assistant" className="mt-4">
        <DecisionAssistant rules={rules} />
      </TabsContent>
      <TabsContent value="tree" className="mt-4">
        <DecisionTree rules={rules} />
      </TabsContent>
      <TabsContent value="index" className="mt-4">
        <StyleIndex rules={rules} />
      </TabsContent>
    </Tabs>
  );
}

/* -------------------- 互動決策助手 -------------------- */

function DecisionAssistant({ rules }: { rules: Rule[] }) {
  const [answers, setAnswers] = useState<Partial<Record<StepKey, string>>>({});

  const matched = rules.filter((r) =>
    STEPS.every((step) => {
      const a = answers[step];
      if (!a) return true;
      const field = r[step];
      if (step === "款式名稱") return r.款式名稱 === a;
      return (field as string[]).length === 0 || (field as string[]).includes(a);
    }),
  );

  const optionsFor = (step: StepKey): string[] => {
    const set = new Set<string>();
    matched.forEach((r) => {
      if (step === "款式名稱") {
        if (r.款式名稱) set.add(r.款式名稱);
      } else {
        (r[step] as string[]).forEach((v) => set.add(v));
      }
    });
    return Array.from(set).sort();
  };

  const setAnswer = (step: StepKey, value: string) => {
    const next: Partial<Record<StepKey, string>> = {};
    let resetAfter = false;
    for (const s of STEPS) {
      if (s === step) {
        next[s] = value;
        resetAfter = true;
      } else if (!resetAfter) {
        next[s] = answers[s];
      }
    }
    setAnswers(next);
  };

  const reset = () => setAnswers({});

  const goBack = () => {
    let lastAnsweredIdx = -1;
    for (let i = STEPS.length - 1; i >= 0; i--) {
      if (answers[STEPS[i]]) {
        lastAnsweredIdx = i;
        break;
      }
    }
    if (lastAnsweredIdx === -1) return;
    const next: Partial<Record<StepKey, string>> = {};
    for (let i = 0; i < lastAnsweredIdx; i++) {
      const s = STEPS[i];
      if (answers[s]) next[s] = answers[s];
    }
    setAnswers(next);
  };

  const currentStepIdx = STEPS.findIndex((s) => !answers[s]);
  const allAnswered = currentStepIdx === -1;

  return (
    <div className="space-y-4">
      {/* progress / breadcrumb */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {STEPS.map((s, i) => {
            const v = answers[s];
            const active = i === currentStepIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                <span
                  className={
                    v
                      ? "rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
                      : active
                        ? "rounded-full border border-accent px-2 py-0.5 font-medium text-accent"
                        : "rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                  }
                >
                  {s}
                  {v && <>：{v}</>}
                </span>
              </div>
            );
          })}
        </div>
        {(Object.keys(answers).length > 0) && (
          <div className="flex items-center gap-2 border-t pt-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goBack}>
              <ArrowLeft className="mr-1 h-3 w-3" /> 上一步
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>
              <RotateCcw className="mr-1 h-3 w-3" /> 重新開始
            </Button>
          </div>
        )}
      </Card>

      {/* current question */}
      {!allAnswered && (
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            步驟 {currentStepIdx + 1} / {STEPS.length}
          </div>
          <h3 className="mt-1 text-lg font-semibold">請選擇{STEPS[currentStepIdx]}</h3>
          {(() => {
            const opts = optionsFor(STEPS[currentStepIdx]);
            if (opts.length === 0) {
              return (
                <p className="mt-3 text-sm text-muted-foreground">
                  根據目前已選條件，冇對應嘅{STEPS[currentStepIdx]}選項。請按上方「重新開始」或返回上一步調整。
                </p>
              );
            }
            return (
              <div className="mt-4 flex flex-wrap gap-2">
                {opts.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswer(STEPS[currentStepIdx], opt)}
                    className="rounded-lg border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-accent hover:bg-accent/10"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            );
          })()}
        </Card>
      )}

      {/* results */}
      {allAnswered && (
        <div className="space-y-3">
          <div className="text-sm font-semibold">
            建議結果 <span className="text-muted-foreground">（{matched.length}）</span>
          </div>
          {matched.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">
              冇對應規則。請按「重新開始」調整條件。
            </Card>
          )}
          {matched.map((r, i) => (
            <ResultCard key={i} rule={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ rule }: { rule: Rule }) {
  const videos = parseVideos(rule.影片連結);
  return (
    <Card className="border-accent/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-accent">建議款式</div>
          <h4 className="mt-1 text-xl font-semibold">{rule.款式名稱}</h4>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {rule.門窗種類.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {rule.建議做法 && (
        <div className="mt-4">
          <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" /> 建議做法
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{rule.建議做法}</p>
        </div>
      )}

      {rule.注意事項 && (
        <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-50/40 p-3 dark:bg-amber-950/20">
          <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" /> 注意事項
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{rule.注意事項}</p>
        </div>
      )}

      {videos.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">相關影片</div>
          <YouTubeVideoList videos={videos} />
        </div>
      )}
    </Card>
  );
}

/* -------------------- 視覺化決策樹 -------------------- */

function DecisionTree({ rules }: { rules: Rule[] }) {
  // Hierarchical: 用途 → 屋苑類型 → 門窗種類 → 款式名稱 → 現場情況 (rule)
  type Node = { label: string; rules: Rule[]; children: Map<string, Node> };
  const root: Node = { label: "全部", rules, children: new Map() };

  const insert = (node: Node, path: string[], rule: Rule) => {
    let cur = node;
    for (const seg of path) {
      if (!cur.children.has(seg)) {
        cur.children.set(seg, { label: seg, rules: [], children: new Map() });
      }
      cur = cur.children.get(seg)!;
      cur.rules.push(rule);
    }
  };

  for (const r of rules) {
    const uses = r.用途.length ? r.用途 : ["（未指定用途）"];
    const estates = r.屋苑類型.length ? r.屋苑類型 : ["（未指定屋苑）"];
    const types = r.門窗種類.length ? r.門窗種類 : ["（未指定門窗）"];
    const scenes = r.現場情況.length ? r.現場情況 : ["（一般情況）"];
    for (const u of uses)
      for (const e of estates)
        for (const t of types)
          for (const s of scenes) insert(root, [u, e, t, r.款式名稱, s], r);
  }

  return (
    <Card className="p-4">
      <p className="mb-3 text-xs text-muted-foreground">
        點擊每層展開／收合。同一款式喺唔同分支重複出現屬正常情況。
      </p>
      <div className="space-y-1">
        {Array.from(root.children.values()).map((n) => (
          <TreeNode key={n.label} node={n} depth={0} />
        ))}
      </div>
    </Card>
  );
}

function TreeNode({
  node,
  depth,
}: {
  node: { label: string; rules: Rule[]; children: Map<string, { label: string; rules: Rule[]; children: Map<string, unknown> }> };
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.size > 0;
  const isLeaf = !hasChildren;
  const colors = [
    "border-l-blue-400",
    "border-l-emerald-400",
    "border-l-amber-400",
    "border-l-purple-400",
    "border-l-pink-400",
  ];

  return (
    <div className={`rounded-md border-l-2 ${colors[depth] ?? "border-l-muted"} pl-3`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent/10"
      >
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <span className={depth === 3 ? "font-semibold text-accent" : "font-medium"}>{node.label}</span>
        <span className="text-xs text-muted-foreground">（{node.rules.length}）</span>
        {isLeaf && (
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-accent">
            {open ? "收起做法" : "查看做法"}
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div className="ml-2 mt-1 space-y-1">
          {Array.from(node.children.values()).map((c) => (
            <TreeNode key={c.label} node={c as never} depth={depth + 1} />
          ))}
        </div>
      )}
      {open && isLeaf && (
        <div className="ml-2 my-2 space-y-2">
          {node.rules.map((r, i) => (
            <LeafRule key={i} rule={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function LeafRule({ rule }: { rule: Rule }) {
  const videos = parseVideos(rule.影片連結);
  return (
    <div className="rounded-md border bg-muted/20 p-3 text-sm">
      {rule.建議做法 && (
        <p className="whitespace-pre-wrap">
          <span className="text-xs font-medium uppercase text-muted-foreground">做法：</span>{" "}
          {rule.建議做法}
        </p>
      )}
      {rule.注意事項 && (
        <p className="mt-1 whitespace-pre-wrap text-amber-700 dark:text-amber-400">
          <span className="text-xs font-medium uppercase">注意：</span> {rule.注意事項}
        </p>
      )}
      {videos.length > 0 && <YouTubeVideoList videos={videos} />}
    </div>
  );
}

/* -------------------- 款式索引 -------------------- */

function StyleIndex({ rules }: { rules: Rule[] }) {
  const groups = new Map<string, Rule[]>();
  for (const r of rules) {
    if (!groups.has(r.款式名稱)) groups.set(r.款式名稱, []);
    groups.get(r.款式名稱)!.push(r);
  }
  const names = Array.from(groups.keys()).sort();
  const [selected, setSelected] = useState<string | null>(names[0] ?? null);

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <Card className="p-2 md:max-h-[600px] md:overflow-y-auto">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          所有款式（{names.length}）
        </div>
        <div className="mt-1 space-y-0.5">
          {names.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSelected(n)}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm transition-colors ${
                selected === n ? "bg-accent/20 font-medium text-accent" : "hover:bg-muted"
              }`}
            >
              <span className="truncate">{n}</span>
              <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                {groups.get(n)!.length}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {selected && groups.get(selected) && (
          <>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-semibold">{selected}</h3>
              <Badge variant="secondary" className="text-xs">
                {groups.get(selected)!.length} 條規則
              </Badge>
            </div>
            {groups.get(selected)!.map((r, i) => (
              <Card key={i} className="p-4">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {r.用途.map((v) => (
                    <Badge key={`u-${v}`} variant="outline" className="border-blue-400/40">
                      用途：{v}
                    </Badge>
                  ))}
                  {r.屋苑類型.map((v) => (
                    <Badge key={`e-${v}`} variant="outline" className="border-emerald-400/40">
                      屋苑：{v}
                    </Badge>
                  ))}
                  {r.門窗種類.map((v) => (
                    <Badge key={`t-${v}`} variant="outline" className="border-amber-400/40">
                      門窗：{v}
                    </Badge>
                  ))}
                  {r.現場情況.map((v) => (
                    <Badge key={`s-${v}`} variant="outline" className="border-pink-400/40">
                      情況：{v}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-accent" />
                  <span className="whitespace-pre-wrap">{r.建議做法 || "（未填寫做法）"}</span>
                </div>
                {r.注意事項 && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-amber-700 dark:text-amber-400">
                    ⚠ {r.注意事項}
                  </p>
                )}
                {(() => {
                  const videos = parseVideos(r.影片連結);
                  return videos.length > 0 ? <YouTubeVideoList videos={videos} /> : null;
                })()}
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
