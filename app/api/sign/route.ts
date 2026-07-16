// POST /api/sign — server-side document signing with IP/UA capture and event logging.
// Replaces the direct browser → Supabase call for the primary signing path.
// The anon RLS path in SignaturePad is kept as a fallback only.
import { NextResponse } from "next/server";
import { z }            from "zod";
import { signDocViaAPI, logEvent, getDocByCode } from "@/lib/data-access";
import { money }        from "@/lib/utils";
import type { NotifyInput } from "@/types";

function notifyAdminServerSide(input: NotifyInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${appUrl}/api/notify`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input),
  }).catch(() => {});
}

function emailSignedCopyToClient(input: {
  to: string; name: string; company: string | null;
  code: string; invoiceTotal: number; signedAt: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  fetch(`${appUrl}/api/email-signed`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(input),
  }).catch(() => {});
}

const Schema = z.object({
  code:                z.string().length(6),
  signature:           z.string().min(10),   // base64 PNG data URL
  accepted_esign_terms: z.boolean(),
});

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation error", details: parsed.error.message },
      { status: 400 }
    );
  }

  const { code, signature, accepted_esign_terms } = parsed.data;

  if (!accepted_esign_terms) {
    return NextResponse.json(
      { ok: false, error: "You must accept the e-signature terms to sign." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const now = new Date().toISOString();

  try {
    // Fetch doc first to get id for event logging
    const existing = await getDocByCode(code);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }
    if (existing.status !== "pending") {
      return NextResponse.json({ ok: false, error: "Document is not pending signature" }, { status: 409 });
    }

    const doc = await signDocViaAPI(code, signature, now, ip, ua, accepted_esign_terms);

    // Log event (non-blocking — don't fail the sign if this errors)
    logEvent(doc.id, "signed", { code }, ip, ua).catch(() => {});

    // Notify admin (fire-and-forget)
    notifyAdminServerSide({
      name:         doc.name,
      company:      doc.company,
      service:      doc.service,
      invoiceTotal: money(doc.invoice_total),
      signedAt:     now,
      code:         doc.code,
      ip,
      ua,
    });

    // Email signed copy to client (fire-and-forget — only if we have an address on file)
    if (doc.email) {
      emailSignedCopyToClient({
        to:           doc.email,
        name:         doc.name,
        company:      doc.company,
        code:         doc.code,
        invoiceTotal: doc.invoice_total,
        signedAt:     now,
      });
    }

    return NextResponse.json({ ok: true, data: { signed_at: now } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
