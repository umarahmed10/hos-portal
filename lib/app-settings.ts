// Global app settings (no dedicated table — stored as a JSON blob in the private
// `config` storage bucket, written via the service role). Small in-memory cache.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export interface AppSettings {
  /** Invoice amount (USD) at or above which payment routes to Skydo; below → Wise. */
  payment_cutoff: number;
}

const DEFAULTS: AppSettings = { payment_cutoff: 399 };
const FILE = "app-settings.json";
const TTL = 30_000;

let cache: { data: AppSettings; at: number } | null = null;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  try {
    const { data } = await db().storage.from("config").download(FILE);
    if (data) {
      const json = JSON.parse(await data.text()) as Partial<AppSettings>;
      const merged = { ...DEFAULTS, ...json };
      cache = { data: merged, at: Date.now() };
      return merged;
    }
  } catch { /* missing/unreadable → defaults */ }
  return DEFAULTS;
}

export async function setAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged = { ...current, ...patch };
  const blob = new Blob([JSON.stringify(merged)], { type: "application/json" });
  await db().storage.from("config").upload(FILE, blob, { upsert: true, contentType: "application/json" });
  cache = { data: merged, at: Date.now() };
  return merged;
}
