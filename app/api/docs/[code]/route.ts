// PATCH /api/docs/[code] — update a doc (edit mode, payment status, etc.)
import { NextResponse }        from "next/server";
import { updateDoc, logEvent, getDocByCode } from "@/lib/data-access";
import { getAdminSession }     from "@/lib/auth";
import { invTotal }            from "@/lib/utils";
import { DocItemSchema, ShortText, MediumText, LongText } from "@/lib/schemas";
import { z }                   from "zod";

const UpdateSchema = z.object({
  type:           z.enum(["both", "agreement", "invoice"]).optional(),
  name:           ShortText.min(1).optional(),
  company:        ShortText.optional(),
  email:          z.string().email().optional().or(z.literal("")),
  service:        MediumText.optional(),
  service_type:   ShortText.optional(),
  service_area:   ShortText.optional(),
  date:           ShortText.optional(),
  fee:            ShortText.optional(),
  agreement_text: LongText.optional(),
  items:          z.array(DocItemSchema).max(200).optional(),
  due_date:       ShortText.optional(),
  pay_notes:      MediumText.optional(),
  status:         z.enum(["draft", "pending", "archived"]).optional(),
  // Payment fields
  payment_status: z.enum(["unpaid", "partially_paid", "paid"]).optional(),
  amount_paid:    z.number().min(0).optional(),
  payment_link:   z.string().url().nullable().optional(),
  // Performance fields
  calls_total:      z.number().int().min(0).optional(),
  calls_qualified:  z.number().int().min(0).optional(),
  jobs_booked:      z.number().int().min(0).optional(),
  ad_spend:         z.number().min(0).optional(),
  avg_job_value:    z.number().min(0).optional(),
  monthly_budget:   z.number().min(0).optional(),
  monthly_call_cap: z.number().int().min(0).optional(),
  rate_per_call:    z.number().min(0).optional(),
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

  // An empty update set produces a no-op UPDATE that matches 0 rows, which the
  // driver then fails to coerce to a single object — surfacing as a confusing
  // 500. Reject it up front instead.
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { ok: false, error: "No recognised fields to update." },
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

    // A payment can't exceed the invoice. Caught here so an admin typo returns
    // a usable message rather than a raw check-constraint violation.
    const effectiveTotal = update.invoice_total ?? existing.invoice_total;
    if (d.amount_paid !== undefined && d.amount_paid > effectiveTotal) {
      return NextResponse.json(
        { ok: false, error: `Amount paid cannot exceed the invoice total (${effectiveTotal}).` },
        { status: 400 }
      );
    }

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
    console.error("[docs] update failed:", err);
    return NextResponse.json({ ok: false, error: "Could not update the client." }, { status: 500 });
  }
}
