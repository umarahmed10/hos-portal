// ─────────────────────────────────────────────────────────────────────────────
// Pure utility functions. No side effects, no imports beyond types.
// ─────────────────────────────────────────────────────────────────────────────
import type { DocItem } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// DATE FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/** "Jun 5, 2026" */
export function fmt(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
      year:  "numeric",
    });
  } catch {
    return String(value);
  }
}

/** "June 5, 2026" */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "Jun 5" */
export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Jun 5, 2026 at 2:34 PM" */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month:  "short",
      day:    "numeric",
      year:   "numeric",
      hour:   "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CURRENCY
// ─────────────────────────────────────────────────────────────────────────────

/** "$1,250.00" */
export function money(value: number | string | null | undefined): string {
  const n = parseFloat(String(value ?? 0));
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style:                 "currency",
    currency:              "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE MATH
// ─────────────────────────────────────────────────────────────────────────────

export function rowTotal(item: DocItem): number {
  const qty   = parseFloat(item.qty)   || 0;
  const price = parseFloat(item.price) || 0;
  return qty * price;
}

export function invTotal(items: DocItem[]): number {
  return items.reduce((acc, item) => acc + rowTotal(item), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// CODE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

// Omits I, O, 0, 1 — characters that are visually ambiguous in most fonts
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function genCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLUG GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a display name into a URL-safe slug.
 * "Brad Pitt's Plumbing LLC" → "brad-pitts-plumbing-llc"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")  // strip non-alphanumeric (keep spaces/hyphens)
    .replace(/\s+/g, "-")           // spaces → hyphens
    .replace(/-+/g, "-")            // dedupe hyphens
    .replace(/^-|-$/g, "");         // trim leading/trailing hyphens
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE INTERPOLATION
// ─────────────────────────────────────────────────────────────────────────────

export function interpolateTemplate(
  template: string,
  vars: { service_type?: string; service_area?: string; fee?: string }
): string {
  return template
    .replace("[service_type]", vars.service_type || "home services")
    .replace("[service_area]",  vars.service_area  || "your area")
    .replace("[fee]",           vars.fee            || "agreed rate");
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Strip non-alphanumeric and uppercase — for code inputs */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** "just now", "5m ago", "2h ago", "3d ago", or "Jun 5" */
export function fmtRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
