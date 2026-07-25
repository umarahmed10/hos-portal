// ─────────────────────────────────────────────────────────────────────────────
// Shared zod primitives for document write paths (/api/docs POST + PATCH).
//
// Line-item money values arrive as strings from the admin form and were
// previously typed as bare z.string(). Nothing checked they were numeric, and
// invTotal() computes `parseFloat(price) || 0` — so "abc" silently became a
// $0 line, creating a real-looking client record billed at nothing. Values that
// were numeric but out of range instead reached Postgres and threw a 500.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";

/** Per-line ceiling — keeps the summed invoice_total inside the numeric column. */
const MAX_MONEY = 9_999_999.99;
const MAX_QTY   = 100_000;

/**
 * A money value as typed in the admin form: digits with up to 2 decimals.
 * Empty string is allowed and means "not filled in yet" (treated as 0 by
 * invTotal), so partially-completed rows still save. "abc" is rejected.
 */
export const MoneyString = z
  .string()
  .trim()
  .regex(/^\d*\.?\d{0,2}$/, "Must be a number with up to 2 decimal places")
  .refine(s => s === "" || Number(s) <= MAX_MONEY, `Must be at most ${MAX_MONEY}`);

/** Quantity — decimals allowed (e.g. billable hours), no negatives. */
export const QtyString = z
  .string()
  .trim()
  .regex(/^\d*\.?\d{0,4}$/, "Must be a positive number")
  .refine(s => s === "" || Number(s) <= MAX_QTY, `Must be at most ${MAX_QTY}`);

export const DocItemSchema = z.object({
  id:    z.number(),
  desc:  z.string().max(500),
  qty:   QtyString,
  price: MoneyString,
});

/** Guards against unbounded text reaching the DB (10k-char names were accepted). */
export const ShortText  = z.string().max(200);
export const MediumText = z.string().max(2_000);
export const LongText   = z.string().max(50_000);
