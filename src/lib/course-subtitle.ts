import type { SheetRow } from "@/lib/sheets.functions";
import { COURSE_CONFIG } from "@/lib/course-config";

/**
 * 根據實際 Google Sheets 資料計算課程副標題，
 * 例如「3 種門款 + 7 種窗款，詳細度尺流程」。
 */
export function buildCourseSubtitle(
  courseId: string,
  rows: SheetRow[] | undefined,
  fallback: string,
): string {
  if (!rows || rows.length === 0) return fallback;
  const config = COURSE_CONFIG[courseId];
  if (!config) return fallback;

  // 課程一、三：按「門窗分類」分組，分開計門款／窗款
  if (courseId === "1" || courseId === "3") {
    const groups = new Set<string>();
    for (const r of rows) {
      const k = String(r[config.groupBy] ?? "").trim();
      if (k) groups.add(k);
    }
    let door = 0;
    let window = 0;
    let other = 0;
    for (const g of groups) {
      if (g.includes("門")) door++;
      else if (g.includes("窗")) window++;
      else other++;
    }
    const parts: string[] = [];
    if (door) parts.push(`${door} 種門款`);
    if (window) parts.push(`${window} 種窗款`);
    if (other) parts.push(`${other} 種其他`);
    const tail = courseId === "3" ? "，詳細度尺流程" : "，認識基礎門窗結構";
    return parts.length ? parts.join(" + ") + tail : fallback;
  }

  // 課程二：按「通料名稱」分組，列出種類數
  if (courseId === "2") {
    const groups = new Set<string>();
    for (const r of rows) {
      const k = String(r[config.groupBy] ?? "").trim();
      if (k) groups.add(k);
    }
    if (groups.size === 0) return fallback;
    return `${groups.size} 種鋁通料，含用途及組合說明`;
  }

  return fallback;
}
