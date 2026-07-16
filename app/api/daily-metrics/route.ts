// POST /api/daily-metrics — upsert a daily performance entry for a doc.
import { NextResponse }    from "next/server";
import { z }               from "zod";
import { getAdminSession } from "@/lib/auth";
import { createClient }    from "@supabase/supabase-js";

const Schema = z.object({
  doc_id:          z.string().uuid(),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  spend:           z.number().min(0).default(0),
  calls_total:     z.number().int().min(0).default(0),
  calls_qualified: z.number().int().min(0).default(0),
});

function getAdminClient() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, svcKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error", details: parsed.error.message }, { status: 400 });
  }

  const { doc_id, date, spend, calls_total, calls_qualified } = parsed.data;
  const db = getAdminClient();

  const { data, error } = await db
    .from("daily_metrics")
    .upsert(
      { doc_id, date, spend, calls_total, calls_qualified },
      { onConflict: "doc_id,date" }
    )
    .select("id, date, spend, calls_total, calls_qualified")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
