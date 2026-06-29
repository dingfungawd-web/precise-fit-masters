// Shared-password site gate (frontend-only).
//
// Password hash is fetched at runtime from /data/auth.json so admins can
// rotate it via the /admin page without a code change. Anyone with an active
// unlock keeps access until the next 1st of the month, OR until the hash
// changes (whichever comes first).

const STORAGE_KEY = "pm-gate-v1";
const AUTH_URL = `${import.meta.env.BASE_URL}data/auth.json`;

export async function sha256Hex(input: string): Promise<string> {
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

let cachedHash: string | null = null;
let cachedAdminPin: string | null = null;

async function loadAuthConfig(): Promise<void> {
  const res = await fetch(`${AUTH_URL}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load auth config");
  const json = (await res.json()) as { passwordSha256: string; adminPinSha256?: string };
  cachedHash = json.passwordSha256.toLowerCase();
  cachedAdminPin = json.adminPinSha256?.toLowerCase() ?? null;
}

export async function loadPasswordHash(force = false): Promise<string> {
  if (cachedHash && !force) return cachedHash;
  await loadAuthConfig();
  return cachedHash!;
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  await loadAuthConfig();
  if (!cachedAdminPin) return false;
  const hash = await sha256Hex(pin.trim());
  return hash === cachedAdminPin;
}

export async function readGateStateAsync(): Promise<{ unlocked: boolean }> {
  if (typeof window === "undefined") return { unlocked: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlocked: false };
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.until || !parsed?.hash) return { unlocked: false };
    if (Date.now() >= parsed.until) return { unlocked: false };
    const current = await loadPasswordHash();
    if (parsed.hash !== current) return { unlocked: false };
    return { unlocked: true };
  } catch {
    return { unlocked: false };
  }
}

export async function tryUnlock(password: string): Promise<boolean> {
  const current = await loadPasswordHash(true);
  const hash = await sha256Hex(password.trim());
  if (hash !== current) return false;
  const stored: Stored = { until: nextMonthFirstUTC(), hash };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return true;
}

export function lockGate(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
