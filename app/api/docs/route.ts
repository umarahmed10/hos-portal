// GET  /api/docs — list all docs (admin dashboard polling)
// POST /api/docs — create a new doc
import { NextResponse }    from "next/server";
import { randomBytes }    from "crypto";
import { getAllDocs, createDoc, updateDoc, logEvent } from "@/lib/data-access";
import { getAdminSession } from "@/lib/auth";
import { genCode, invTotal, slugify } from "@/lib/utils";
import { sendPortalEmail } from "@/lib/send-portal-email";
import { z }               from "zod";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const docs = await getAllDocs();
    return NextResponse.json({ ok: true, data: docs });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

const CreateSchema = z.object({
  type:           z.enum(["both", "agreement", "invoice"]),
  name:           z.string().min(1),
  company:        z.string().optional(),
  email:          z.string().email().optional().or(z.literal("")),
  service:        z.string().optional(),
  service_type:   z.string().optional(),
  service_area:   z.string().optional(),
  date:           z.string().optional(),
  fee:            z.string().optional(),
  agreement_text: z.string().optional(),
  items:          z.array(z.object({
    id:    z.number(),
    desc:  z.string(),
    qty:   z.string(),
    price: z.string(),
  })).default([]),
  due_date:       z.string().optional(),
  pay_notes:      z.string().optional(),
  status:         z.enum(["draft", "pending"]).default("pending"),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation error", details: parsed.error.message },
      { status: 400 }
    );
  }

  try {
    const d    = parsed.data;
    const code = genCode();
    let doc  = await createDoc({
      ...d,
      code,
      invoice_total: invTotal(d.items),
    });

    // Generate slug immediately — ensures portal link always exists even if no email was sent
    if (!doc.slug) {
      const base = slugify((d.company || d.name).trim()).slice(0, 30) || "client";
      const slug = `${base}-${randomBytes(4).toString("hex")}`;
      doc = await updateDoc(code, { slug });
    }

    // Log created event (non-blocking)
    logEvent(doc.id, "created", { name: doc.name, code: doc.code }).catch(() => {});

    // Auto-send portal email if email is present and status is pending
    if (doc.email && parsed.data.status !== "draft") {
      sendPortalEmail({ code: doc.code }).catch(() => {});
    }

    return NextResponse.json({ ok: true, data: doc }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
