// GET /api/pdf?code=XXXXXX — stream a PDF of the document
// Uses @react-pdf/renderer server-side. No browser required.
//
// Requires an entitled session (admin, or the portal client who owns this doc).
// The access code alone is NOT sufficient: it identifies a document, it does not
// authorize reading a signed agreement, invoice totals and signature image.
import { NextResponse }      from "next/server";
import { getDocByCode }      from "@/lib/data-access";
import { authorizeDocAccess } from "@/lib/doc-access";
import { verifyPdfToken }    from "@/lib/pdf-token";
import { rateLimit }         from "@/lib/rate-limit";
import { renderToBuffer }    from "@react-pdf/renderer";
import React                 from "react";
import { DocPDF }            from "@/components/server/DocPDF";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code")?.toUpperCase();
  const token = searchParams.get("t");

  if (!code) {
    return NextResponse.json({ ok: false, error: "code param required" }, { status: 400 });
  }

  const rl = rateLimit(`pdf:${clientIp(req)}`, { windowMs: 60_000, max: 20 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  // Either an entitled session (admin / owning portal client), or a signed
  // token bound to this specific code. The code alone is never enough.
  const allowed =
    (token ? await verifyPdfToken(token, code) : false) ||
    Boolean(await authorizeDocAccess(code));

  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const doc = await getDocByCode(code).catch(() => null);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(DocPDF as any, { doc });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer  = await renderToBuffer(element as any);
    const bytes   = new Uint8Array(buffer);

    const company  = doc.company?.replace(/[^a-zA-Z0-9]/g, "-") || "Client";
    const dateStr  = new Date().toISOString().slice(0, 10);
    const filename = `HOS-${company}-${dateStr}-${code}.pdf`;

    return new NextResponse(bytes, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
