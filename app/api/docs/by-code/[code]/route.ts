// GET /api/docs/by-code/[code] — look up doc slug by access code.
// No auth required — only confirms the code exists and returns its slug, never
// doc content. Used by the portal entry page to redirect to the correct slug,
// and by ClientCodeEntry to validate a code without exposing the docs table to
// the browser's anon key.
//
// Rate limited: this endpoint is an existence oracle for 6-char access codes,
// which are the only secret protecting a portal.
import { NextResponse } from "next/server";
import { getDocByCode } from "@/lib/data-access";
import { rateLimit }    from "@/lib/rate-limit";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = rateLimit(`by-code:${clientIp(req)}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  const { code } = await params;
  const sanitized = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (sanitized.length !== 6) {
    return NextResponse.json({ ok: false, error: "Invalid code format" }, { status: 400 });
  }

  try {
    const doc = await getDocByCode(sanitized);
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }
    // slug may legitimately be null on legacy rows — callers guard for it.
    return NextResponse.json({ ok: true, data: { slug: doc.slug ?? null } });
  } catch {
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
}
