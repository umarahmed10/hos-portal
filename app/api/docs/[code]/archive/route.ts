// POST /api/docs/[code]/archive — soft-delete a doc
import { NextResponse }    from "next/server";
import { archiveDoc }      from "@/lib/data-access";
import { getAdminSession } from "@/lib/auth";

export async function POST(
  _req:    Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { code } = await params;

  try {
    await archiveDoc(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
