// POST /api/daily-metrics/import — bulk-import daily metrics (e.g. from a Google
// Ads CSV) and recompute the client's current-month totals so the dashboard
// reflects them. Admin only.
import { NextResponse }    from "next/server";
import { z }               from "zod";
import { getAdminSession } from "@/lib/auth";
import { createClient }    from "@supabase/supabase-js";

/** True only for a real calendar date — the regex alone accepts 2026-02-31. */
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const Row = z
  .object({
    date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate, "Not a real calendar date"),
    spend:           z.number().min(0).default(0),
    calls_total:     z.number().int().min(0).default(0),
    calls_qualified: z.number().int().min(0).default(0),
  })
  // These figures drive the client-facing dashboard and reports. A CSV with
  // shifted columns would otherwise import "999 qualified of 5 calls".
  .refine(r => r.calls_qualified <= r.calls_total, {
    message: "calls_qualified cannot exceed calls_total",
    path:    ["calls_qualified"],
  });

const Body = z.object({
  doc_id: z.string().uuid(),
  rows:   z.array(Row).min(1).max(400),
});

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid import data", details: parsed.error.message }, { status: 400 });
  }
  const { doc_id, rows } = parsed.data;

  // Confirm the target exists, so a stale/incorrect id returns 404 rather than
  // a raw foreign-key violation surfaced as a 500.
  const { data: target } = await db().from("docs").select("id").eq("id", doc_id).maybeSingle();
  if (!target) {
    return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
  }

  // Collapse duplicate dates within the upload (keep the last occurrence).
  const byDate = new Map<string, typeof rows[number]>();
  for (const r of rows) byDate.set(r.date, r);
  const deduped = [...byDate.values()].map(r => ({ doc_id, ...r }));

  const supabase = db();

  const { error: upErr } = await supabase
    .from("daily_metrics")
    .upsert(deduped, { onConflict: "doc_id,date" });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  // Recompute current-calendar-month totals from ALL stored daily rows so the
  // dashboard's "this month" figures stay correct after any import.
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const { data: monthRows, error: sumErr } = await supabase
    .from("daily_metrics")
    .select("spend, calls_total, calls_qualified")
    .eq("doc_id", doc_id)
    .gte("date", monthStart);
  if (sumErr) {
    return NextResponse.json({ ok: false, error: sumErr.message }, { status: 500 });
  }

  const totals = (monthRows ?? []).reduce(
    (acc, r) => ({
      ad_spend:        acc.ad_spend + Number(r.spend ?? 0),
      calls_total:     acc.calls_total + Number(r.calls_total ?? 0),
      calls_qualified: acc.calls_qualified + Number(r.calls_qualified ?? 0),
    }),
    { ad_spend: 0, calls_total: 0, calls_qualified: 0 },
  );

  const { error: docErr } = await supabase.from("docs").update(totals).eq("id", doc_id);
  if (docErr) {
    return NextResponse.json({ ok: false, error: docErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: { imported: deduped.length, monthTotals: totals } });
}
