// GET /api/docs/[code]/events — fetch audit events for a document (admin only).
import { NextResponse }    from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getDocByCode, getDocEvents } from "@/lib/data-access";

export async function GET(
  _req:   Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { code } = await params;

  try {
    const doc = await getDocByCode(code);
    if (!doc) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const events = await getDocEvents(doc.id);
    return NextResponse.json({ ok: true, data: events });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
