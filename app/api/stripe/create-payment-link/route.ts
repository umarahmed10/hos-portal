import { NextResponse }    from "next/server";
import { z }              from "zod";
import { getAdminSession } from "@/lib/auth";
import { getDocByCode, updateDoc } from "@/lib/data-access";
import { stripe }         from "@/lib/stripe";

const Schema = z.object({
  code: z.string().length(6),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!stripe) {
    return NextResponse.json({ ok: false, error: "Stripe not configured" }, { status: 503 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error" }, { status: 400 });
  }

  const { code } = parsed.data;
  const doc = await getDocByCode(code);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  if (doc.invoice_total <= 0) {
    return NextResponse.json({ ok: false, error: "Invoice total must be greater than 0" }, { status: 400 });
  }

  try {
    const price = await stripe.prices.create({
      currency:     "usd",
      unit_amount:  Math.round(doc.invoice_total * 100),
      product_data: {
        name: `HOS Automations — ${doc.company || doc.name}`,
      },
    });

    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/portal/${doc.slug ?? ""}/invoices?paid=1`;

    const paymentLink = await stripe.paymentLinks.create({
      line_items:  [{ price: price.id, quantity: 1 }],
      metadata:    { doc_code: code, doc_id: doc.id },
      after_completion: {
        type:     "redirect",
        redirect: { url: redirectUrl },
      },
      billing_address_collection: "required",
    });

    await updateDoc(code, {
      payment_link:            paymentLink.url,
      stripe_payment_link_id:  paymentLink.id,
      stripe_payment_link_url: paymentLink.url,
    });

    return NextResponse.json({
      ok:   true,
      data: {
        url:             paymentLink.url,
        payment_link_id: paymentLink.id,
        amount:          doc.invoice_total,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe error";
    console.error("[stripe/create-payment-link]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
