// Static data layer — reads pre-fetched JSON from /public/data/.
// Replaces the old getCourseSheet server function.

export type SheetCellValue = string | number | boolean | string[];
export type SheetRow = { [key: string]: SheetCellValue };

export type SheetName =
  | "課程一門窗類型"
  | "課程二鋁通料"
  | "課程三產品款式及測量方法"
  | "課程四流程決策樹形圖"
  | "課程五黃金案例庫";

export type CourseSheetData = {
  sheetName: SheetName;
  rows: SheetRow[];
  fetchedAt: string;
};

const COURSE_IDS = new Set(["1", "2", "3", "4", "5"]);

// Vite injects BASE_URL — works under both `/` (dev) and `/precision-masters/` (GitHub Pages).
function dataUrl(path: string): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
  const normalized = base.endsWith("/") ? base : `${base}/`;
  return `${normalized}data/${path}`;
}

export async function fetchCourseSheet(courseId: string): Promise<CourseSheetData> {
  if (!COURSE_IDS.has(courseId)) {
    throw new Error(`Course ${courseId} 不存在`);
  }
  const res = await fetch(dataUrl(`courses/${courseId}.json`), {
    cache: "no-cache",
  });
  if (!res.ok) {
    throw new Error(`無法載入課程 ${courseId} 資料 (${res.status})`);
  }
  return (await res.json()) as CourseSheetData;
}

export async function fetchDataMeta(): Promise<{
  fetchedAt: string;
  courses: { courseId: string; sheetName: string; rows: number }[];
}> {
  const res = await fetch(dataUrl("courses/_meta.json"), { cache: "no-cache" });
  if (!res.ok) throw new Error("無法載入資料更新時間");
  return await res.json();
}
