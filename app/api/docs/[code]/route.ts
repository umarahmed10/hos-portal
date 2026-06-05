// PATCH /api/docs/[code] — update a doc (edit mode, payment status, etc.)
import { NextResponse }        from "next/server";
import { updateDoc, logEvent, getDocByCode } from "@/lib/data-access";
import { getAdminSession }     from "@/lib/auth";
import { invTotal }            from "@/lib/utils";
import { z }                   from "zod";

const UpdateSchema = z.object({
  type:           z.enum(["both", "agreement", "invoice"]).optional(),
  name:           z.string().min(1).optional(),
  company:        z.string().optional(),
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
  })).optional(),
  due_date:       z.string().optional(),
  pay_notes:      z.string().optional(),
  status:         z.enum(["draft", "pending", "archived"]).optional(),
  // Payment fields
  payment_status: z.enum(["unpaid", "partially_paid", "paid"]).optional(),
  amount_paid:    z.number().min(0).optional(),
});

export async function PATCH(
  req:     Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  const body     = await req.json().catch(() => null);
  const parsed   = UpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation error", details: parsed.error.message },
      { status: 400 }
    );
  }

  try {
    const existing = await getDocByCode(code);
    if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const d      = parsed.data;
    const update = {
      ...d,
      ...(d.items ? { invoice_total: invTotal(d.items) } : {}),
    };
    const doc = await updateDoc(code, update);

    // Log payment_updated event if payment fields changed
    const paymentChanged = d.payment_status !== undefined && d.payment_status !== existing.payment_status;
    if (paymentChanged) {
      logEvent(doc.id, "payment_updated", {
        previous: existing.payment_status,
        current:  d.payment_status,
        amount_paid: d.amount_paid,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, data: doc });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
