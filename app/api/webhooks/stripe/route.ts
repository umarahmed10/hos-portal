import { NextResponse }          from "next/server";
import { stripe }                from "@/lib/stripe";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/env";
import {
  getDocByCode,
  updateDoc,
  logDocEvent,
} from "@/lib/data-access";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] Signature verification failed:", msg);
    return NextResponse.json({ error: `Webhook signature invalid: ${msg}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handlePaymentCompleted(session);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log("[stripe/webhook] Payment failed:", intent.id, intent.last_payment_error?.message);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentCompleted(session: Stripe.Checkout.Session) {
  try {
    const docCode = session.metadata?.doc_code;
    if (!docCode) {
      console.warn("[stripe/webhook] No doc_code in session metadata:", session.id);
      return;
    }

    const doc = await getDocByCode(docCode);
    if (!doc) {
      console.warn("[stripe/webhook] Doc not found for code:", docCode);
      return;
    }

    if (doc.payment_status === "paid") {
      console.log("[stripe/webhook] Already paid — skipping:", docCode);
      return;
    }

    const amountPaid = (session.amount_total ?? 0) / 100;

    await updateDoc(docCode, {
      payment_status:       "paid",
      amount_paid:          amountPaid,
      stripe_session_id:    session.id,
      stripe_customer_email: session.customer_details?.email ?? null,
      paid_at:              new Date().toISOString(),
    });

    const emailStr = session.customer_details?.email ?? "";
    const detail   = `$${amountPaid.toFixed(2)} received via Stripe${emailStr ? ` · ${emailStr}` : ""}`;

    await logDocEvent(doc.id, {
      event_type:        "PAYMENT_PROCESSED",
      detail,
      posted_by:         "system",
      visible_to_client: true,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    // Admin notification
    fetch(`${appUrl}/api/notify`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event:     "payment_received",
        name:      doc.name,
        company:   doc.company,
        code:      docCode,
        amount:    amountPaid,
        email:     session.customer_details?.email,
        sessionId: session.id,
      }),
    }).catch(() => {});

    // Client receipt email
    if (doc.email) {
      fetch(`${appUrl}/api/email-payment-receipt`, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-internal-secret": process.env.INTERNAL_SECRET ?? "",
        },
        body: JSON.stringify({
          to:        doc.email,
          name:      doc.name,
          company:   doc.company,
          amount:    amountPaid,
          sessionId: session.id,
          portalSlug: doc.slug,
        }),
      }).catch(() => {});
    }

    console.log("[stripe/webhook] Payment processed:", docCode, "$" + amountPaid);
  } catch (err) {
    console.error("[stripe/webhook] handlePaymentCompleted error:", err);
  }
}
