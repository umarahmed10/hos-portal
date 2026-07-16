// POST /api/docs/[code]/events/post
// Admin-only: post an operational event to a doc's timeline.
import { NextResponse }  from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDocByCode, logEvent } from "@/lib/data-access";
import { z }            from "zod";

const schema = z.object({
  event_type:        z.string().min(1).max(64),
  detail:            z.string().max(500).optional(),
  visible_to_client: z.boolean().optional().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const doc = await getDocByCode(code).catch(() => null);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  await logEvent(
    doc.id,
    parsed.data.event_type,
    {},
    null,
    null,
    parsed.data.detail ?? null,
    "admin",
    parsed.data.visible_to_client
  );

  return NextResponse.json({ ok: true });
}
