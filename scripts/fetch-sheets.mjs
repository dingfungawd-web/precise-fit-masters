#!/usr/bin/env node
/**
 * Build-time: fetch all course sheets from Google Sheets → public/data/courses/{id}.json
 *
 * Two modes (auto-detected):
 *  1. Direct Google Sheets API (for GitHub Actions): set GOOGLE_API_KEY
 *     - get a public API key at https://console.cloud.google.com/apis/credentials
 *     - sheet must be "Anyone with the link → Viewer"
 *  2. Lovable connector gateway (for in-Lovable dev): set LOVABLE_API_KEY + GOOGLE_SHEETS_API_KEY
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPREADSHEET_ID = "1Q2ONIMw8DzSlwbUWKNFQ_L4g79U_jd-iUAHyHMTGR3I";

const COURSE_TO_SHEET = {
  "1": "課程一門窗類型",
  "2": "課程二鋁通料",
  "3": "課程三產品款式及測量方法",
  "4": "課程四流程決策樹形圖",
  "5": "課程五黃金案例庫",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "..", "public", "data", "courses");

async function fetchValues(sheetName) {
  const range = `'${sheetName}'!A:Z`;
  const googleKey = process.env.GOOGLE_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connectorKey = process.env.GOOGLE_SHEETS_API_KEY;

  let url, headers;
  if (googleKey) {
    url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${googleKey}`;
    headers = {};
  } else if (lovableKey && connectorKey) {
    url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`;
    headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectorKey,
    };
  } else {
    throw new Error(
      "Missing credentials. Set GOOGLE_API_KEY (direct) or LOVABLE_API_KEY + GOOGLE_SHEETS_API_KEY (gateway).",
    );
  }

  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text).values ?? [];
}

function valuesToRows(values) {
  if (values.length < 2) return [];
  const headers = values[0].map((h) => (h ?? "").toString().trim()).filter(Boolean);
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const raw = values[i] ?? [];
    const row = {};
    let hasContent = false;
    headers.forEach((h, idx) => {
      const cell = (raw[idx] ?? "").toString();
      if (cell.trim()) hasContent = true;
      row[h] = cell;
    });
    if (hasContent) rows.push(row);
  }
  return rows;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const summary = [];

  for (const [courseId, sheetName] of Object.entries(COURSE_TO_SHEET)) {
    process.stdout.write(`Fetching course ${courseId} (${sheetName})... `);
    try {
      const values = await fetchValues(sheetName);
      const rows = valuesToRows(values);
      const payload = { sheetName, rows, fetchedAt };
      const outPath = resolve(OUT_DIR, `${courseId}.json`);
      await writeFile(outPath, JSON.stringify(payload, null, 0));
      console.log(`✓ ${rows.length} rows`);
      summary.push({ courseId, sheetName, rows: rows.length });
    } catch (err) {
      console.error(`✗ ${err.message}`);
      throw err;
    }
  }

  await writeFile(
    resolve(OUT_DIR, "_meta.json"),
    JSON.stringify({ fetchedAt, courses: summary }, null, 2),
  );
  console.log(`\nDone. Updated ${summary.length} course(s) at ${fetchedAt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
