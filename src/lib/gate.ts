// Shared-password site gate (frontend-only).
//
// To change the password each month, run in any terminal:
//
//   node -e "console.log(require('crypto').createHash('sha256').update('YOUR_NEW_PASSWORD').digest('hex'))"
//
// Paste the output below into PASSWORD_SHA256. Commit + redeploy.
// Anyone with an active unlock keeps access until the next 1st of the month.

export const PASSWORD_SHA256 =
  "54e8bf2f723817c5f6930ec9b93df3d9bcc4565c9dd8e243d605917fae68c27d"; // pm-2026

const STORAGE_KEY = "pm-gate-v1";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function nextMonthFirstUTC(now = new Date()): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return Date.UTC(y, m + 1, 1, 0, 0, 0);
}

type Stored = { until: number; hash: string };

export function readGateState(): { unlocked: boolean } {
  if (typeof window === "undefined") return { unlocked: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: false };
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.until || !parsed?.hash) return { unlocked: false };
    if (Date.now() >= parsed.until) return { unlocked: false };
    if (parsed.hash !== PASSWORD_SHA256) return { unlocked: false };
    return { unlocked: true };
  } catch {
    return { unlocked: false };
  }
}

export async function tryUnlock(password: string): Promise<boolean> {
  const hash = await sha256Hex(password.trim());
  if (hash !== PASSWORD_SHA256) return false;
  const stored: Stored = { until: nextMonthFirstUTC(), hash };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return true;
}

export function lockGate(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
