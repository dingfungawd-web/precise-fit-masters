import { createServerFn } from "@tanstack/react-start";

export type SheetCellValue = string | number | boolean | string[];
export type SheetRow = { [key: string]: SheetCellValue };

export type SheetName = "課程一門窗類型" | "課程二鋁通料" | "課程三產品款式及測量方法";

const SPREADSHEET_ID = "1Q2ONIMw8DzSlwbUWKNFQ_L4g79U_jd-iUAHyHMTGR3I";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

const COURSE_TO_SHEET: Record<string, SheetName> = {
  "1": "課程一門窗類型",
  "2": "課程二鋁通料",
  "3": "課程三產品款式及測量方法",
};

export const getCourseSheet = createServerFn({ method: "GET" })
  .inputValidator((input: { courseId: string }) => {
    if (!COURSE_TO_SHEET[input.courseId]) {
      throw new Error(`Course ${input.courseId} 未配置 Google Sheets`);
    }
    return input;
  })
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY 未設定");
    const GOOGLE_SHEETS_API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
    if (!GOOGLE_SHEETS_API_KEY) throw new Error("Google Sheets 連接未設定");

    const sheetName = COURSE_TO_SHEET[data.courseId];
    // Wrap sheet name in single quotes for A1 notation (handles CJK / special chars)
    const range = `'${sheetName}'!A1:Z1000`;
    const url = `${GATEWAY_URL}/spreadsheets/${SPREADSHEET_ID}/values/${range}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_SHEETS_API_KEY,
      },
    });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`Google Sheets API ${res.status}: ${bodyText.slice(0, 300)}`);
    }

    const json = JSON.parse(bodyText) as { values?: string[][] };
    const values = json.values ?? [];
    if (values.length < 2) return { sheetName, rows: [] as SheetRow[] };

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

    return { sheetName, rows };
  });
