// GET /api/pdf?code=XXXXXX — stream a PDF of the document
// Uses @react-pdf/renderer server-side. No browser required.
import { NextResponse }   from "next/server";
import { getDocByCode }   from "@/lib/data-access";
import { renderToBuffer } from "@react-pdf/renderer";
import React              from "react";
import { DocPDF }         from "@/components/server/DocPDF";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.toUpperCase();

  if (!code) {
    return NextResponse.json({ ok: false, error: "code param required" }, { status: 400 });
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
