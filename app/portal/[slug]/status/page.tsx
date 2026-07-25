// Portal Status tab — onboarding progress tracker.
import { notFound, redirect }  from "next/navigation";
import Link                    from "next/link";
import { getPortalSession }    from "@/lib/portal-auth";
import { getDocBySlug, logEvent } from "@/lib/data-access";
import { AutoRefresh }         from "@/components/client/AutoRefresh";
import { ProgressBanner }      from "@/components/client/ProgressBanner";
import { PayButton }           from "@/components/client/PayButton";
import { getAppSettings }      from "@/lib/app-settings";
import { BODY, GREEN, GREEN_DIM, GREEN_BORDER, MUTED, TEXT, css, AMBER_DIM, AMBER_BORDER } from "@/lib/styles";
import { headers }             from "next/headers";
import { money }               from "@/lib/utils";

export const metadata = { title: "Status · HOS Client Portal" };

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalStatusPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  // Active paid clients belong on the dashboard, not the status page
  if (doc.payment_status === "paid" && doc.status === "signed") {
    redirect(`/portal/${slug}/dashboard`);
  }

  const hdrs = await headers();
  const ip   = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua   = hdrs.get("user-agent") ?? null;
  logEvent(doc.id, "viewed", { via: "portal", tab: "status" }, ip, ua, null, null, false).catch(() => {});

  const isSigned   = doc.status === "signed";
  const isPaid     = doc.payment_status === "paid";
  const isPartial  = doc.payment_status === "partially_paid";
  const { payment_cutoff } = await getAppSettings();

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }} className="stagger">
      <AutoRefresh intervalMs={30000} />

      {/* Progress banner */}
      <div style={{ margin: "0 -20px 24px", borderRadius: 0 }}>
        <ProgressBanner doc={doc} />
      </div>

      {/* Hero */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          Onboarding status
        </div>
        <h2 style={{ fontFamily: BODY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.3px", color: TEXT, marginBottom: 10 }}>
          {isSigned && isPaid ? "You're live." : isSigned ? "Awaiting payment." : "Almost there."}
        </h2>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 440, margin: 0 }}>
          {isSigned && isPaid
            ? "Your agreement is signed, payment received, and your campaign is active."
            : isSigned
            ? "Agreement signed. Submit payment to launch your campaign."
            : "Your documents are ready. Sign your agreement to activate your account and begin receiving qualified calls."}
        </p>
      </div>

      {/* Signature required CTA */}
      {!isSigned && (
        <div style={{
          ...css.card,
          padding:     "20px 24px",
          borderColor: AMBER_BORDER,
          background:  AMBER_DIM,
          marginBottom: 12,
        }}>
          <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
            Signature required
          </div>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: "0 0 16px" }}>
            Sign your agreement to activate your account and start receiving calls.
          </p>
          <Link
            href={`/portal/${slug}/sign`}
            style={{ ...css.btnP, display: "inline-flex", textDecoration: "none", padding: "13px 28px", fontSize: 14 }}
          >
            Sign agreement →
          </Link>
        </div>
      )}

      {/* Payment CTA — only show if signed and unpaid/partial */}
      {isSigned && !isPaid && (
        <div style={{
          ...css.card,
          padding:     "20px 24px",
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, letterSpacing: "1px", marginBottom: 8 }}>Next step</div>
          <div style={{ fontFamily: BODY, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
            {isPartial ? "Complete your payment" : "Submit payment to launch"}
          </div>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
            {isPartial
              ? `You've paid ${money(doc.amount_paid)} of ${money(doc.invoice_total)}. Complete your payment to launch your campaign.`
              : "Campaign launch typically takes 3–5 business days after payment is received."}
          </p>
          {doc.payment_link && (
            <div style={{ marginBottom: 12 }}>
              <PayButton paymentLink={doc.payment_link} amount={doc.invoice_total} cutoff={payment_cutoff} />
            </div>
          )}
          <Link
            href={`/portal/${slug}/invoices`}
            style={{ ...css.btnS, display: "inline-flex", textDecoration: "none", padding: "12px 20px", fontSize: 13 }}
          >
            View invoice
          </Link>
        </div>
      )}

      {/* Signed + paid confirmation */}
      {isSigned && isPaid && (
        <div style={{
          ...css.card,
          padding:     "18px 22px",
          borderColor: GREEN_BORDER,
          background:  GREEN_DIM,
          marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontWeight: 700, fontSize: 14, fontFamily: BODY }}>
            <span>✓</span> All set — your campaign is active.
          </div>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.65, margin: "8px 0 0" }}>
            You&apos;ll receive a weekly performance report every Monday.
          </p>
        </div>
      )}
    </div>
  );
}
