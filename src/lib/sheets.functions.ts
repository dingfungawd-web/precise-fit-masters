import { createServerFn } from "@tanstack/react-start";

export type SheetCellValue = string | number | boolean | string[];
export type SheetRow = { [key: string]: SheetCellValue };

export type SheetName =
  | "課程一門窗類型"
  | "課程二鋁通料"
  | "課程三產品款式及測量方法"
  | "課程四流程決策樹形圖"
  | "課程五黃金案例庫";

const SPREADSHEET_ID = "1Q2ONIMw8DzSlwbUWKNFQ_L4g79U_jd-iUAHyHMTGR3I";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

const COURSE_TO_SHEET: Record<string, SheetName> = {
  "1": "課程一門窗類型",
  "2": "課程二鋁通料",
  "3": "課程三產品款式及測量方法",
  "4": "課程四流程決策樹形圖",
  "5": "課程五黃金案例庫",
};

type CacheEntry = { at: number; data: { sheetName: SheetName; rows: SheetRow[] } };
const CACHE_TTL_MS = 5 * 60 * 1000;
const g = globalThis as unknown as { __sheetCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = g.__sheetCache ?? (g.__sheetCache = new Map());

export const getCourseSheet = createServerFn({ method: "GET" })
  .inputValidator((input: { courseId: string; forceRefresh?: boolean }) => {
    if (!COURSE_TO_SHEET[input.courseId]) {
      throw new Error(`Course ${input.courseId} 未配置 Google Sheets`);
    }
    return input;
  })
  .handler(async ({ data }) => {
    const cached = cache.get(data.courseId);
    if (!data.forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return cached.data;
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY 未設定");
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("Google Sheets 連接未設定");

    const sheetName = COURSE_TO_SHEET[data.courseId];
    const range = `'${sheetName}'!A:Z`;
    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${range}`;

    let res: Response;
    let bodyText: string;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
        },
      });
      bodyText = await res.text();
    } catch (e) {
      if (cached) return cached.data;
      throw e;
    }
    if (!res.ok) {
      // Serve stale cache on any error (e.g. 429 quota) instead of crashing the page
      if (cached) return cached.data;
      throw new Error(`Google Sheets API ${res.status}: ${bodyText.slice(0, 300)}`);
    }

    const json = JSON.parse(bodyText) as { values?: string[][] };
    const values = json.values ?? [];
    if (values.length < 2) {
      const empty = { sheetName, rows: [] as SheetRow[] };
      cache.set(data.courseId, { at: Date.now(), data: empty });
      return empty;
    }

    const headers = values[0].map((h) => h.trim()).filter(Boolean);
    const rows: SheetRow[] = [];
    for (let i = 1; i < values.length; i++) {
      const raw = values[i];
      const row: SheetRow = {};
      let hasContent = false;
      headers.forEach((h, idx) => {
        const cell = (raw[idx] ?? "").toString();
        if (cell.trim()) hasContent = true;
        row[h] = cell;
      });
      if (hasContent) rows.push(row);
    }

    const result = { sheetName, rows };
    cache.set(data.courseId, { at: Date.now(), data: result });
    return result;
  });
