import { createServerFn } from "@tanstack/react-start";

export type SheetCellValue = string | number | boolean | string[];
export type SheetRow = { [key: string]: SheetCellValue };

export type SheetName = "course1_types" | "course2_aluminium" | "course3_products";

const COURSE_TO_SHEET: Record<string, SheetName> = {
  "1": "course1_types",
  "2": "course2_aluminium",
  "3": "course3_products",
};

export const getCourseSheet = createServerFn({ method: "GET" })
  .inputValidator((input: { courseId: string }) => {
    if (!COURSE_TO_SHEET[input.courseId]) {
      throw new Error(`Course ${input.courseId} 未配置 Google Sheets`);
    }
    return input;
  })
  .handler(async ({ data }) => {
    const url = process.env.SHEETS_API_URL;
    if (!url) throw new Error("SHEETS_API_URL 未設定");

    const sheetName = COURSE_TO_SHEET[data.courseId];
    const target = `${url}${url.includes("?") ? "&" : "?"}sheet=${encodeURIComponent(sheetName)}`;

    const res = await fetch(target, { redirect: "follow" });
    const bodyText = await res.text();

    if (!res.ok) {
      throw new Error(`Google Sheets API 回傳 ${res.status}: ${bodyText.slice(0, 200)}`);
    }

    let json: { ok: boolean; error?: string; data?: Record<string, SheetRow[] | { error: string }> };
    try {
      json = JSON.parse(bodyText);
    } catch {
      throw new Error(
        `Google Sheets API 回傳咗 HTML 而唔係 JSON。請確認 SHEETS_API_URL 係以 /exec 結尾、部署時「誰可存取」揀「所有人 (Anyone)」、並且部署版本係最新。前 200 字：${bodyText.slice(0, 200)}`,
      );
    }
    if (!json.ok) throw new Error(json.error || "Google Sheets API 失敗");


    const payload = json.data?.[sheetName];
    if (!payload) throw new Error("找不到對應工作表");
    if (!Array.isArray(payload)) throw new Error(payload.error || "工作表讀取失敗");

    return { sheetName, rows: payload as SheetRow[] };
  });
