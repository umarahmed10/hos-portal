// GET /api/docs/by-code/[code] — look up doc slug by access code.
// No auth required — only returns the slug, not doc content.
// Used by portal entry page to redirect to the correct slug when the user
// lands on the wrong slug URL but has a valid code.
import { NextResponse } from "next/server";
import { getDocByCode } from "@/lib/data-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (sanitized.length !== 6) {
    return NextResponse.json({ ok: false, error: "Invalid code format" }, { status: 400 });
  }

  try {
    const doc = await getDocByCode(sanitized);
    if (!doc || !doc.slug) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { slug: doc.slug } });
  } catch {
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
}
