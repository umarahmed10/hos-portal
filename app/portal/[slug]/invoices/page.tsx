// Portal Billing tab — amount hero → pay button → monthly usage → setup invoice.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug, logEvent } from "@/lib/data-access";
import { InvoiceTable }       from "@/components/server/InvoiceTable";
import { AutoRefresh }        from "@/components/client/AutoRefresh";
import {
  BODY, BORDER, GREEN, GREEN_DIM, GREEN_BORDER,
  AMBER, AMBER_DIM, AMBER_BORDER,
  MUTED, TEXT, css, MONO, SUBTLE,
} from "@/lib/styles";
import { money, fmt } from "@/lib/utils";
import { headers }    from "next/headers";

interface Props {
  params: Promise<{ slug: string }>;
}

const PAYMENT_CONFIG = {
  unpaid:         { color: AMBER,  bg: AMBER_DIM,  border: AMBER_BORDER,  label: "Unpaid",         icon: "!" },
  partially_paid: { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", label: "Partially paid", icon: "~" },
  paid:           { color: GREEN,  bg: GREEN_DIM,  border: GREEN_BORDER,  label: "Paid in full",   icon: "✓" },
};

export default async function PortalInvoicesPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const hdrs = await headers();
  const ip   = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua   = hdrs.get("user-agent") ?? null;
  logEvent(doc.id, "invoice_viewed", { via: "portal" }, ip, ua, null, null, false).catch(() => {});

  const invoiceTotal = Number(doc.invoice_total  ?? 0);
  const amtPaid      = Number(doc.amount_paid    ?? 0);
  const payStatus    = doc.payment_status ?? "unpaid";
  const payLink      = doc.stripe_payment_link_url ?? doc.payment_link ?? null;
  const callsQual    = Number(doc.calls_qualified  ?? 0);
  const callCap      = Number(doc.monthly_call_cap ?? 0);
  const ratePerCall  = Number(doc.rate_per_call    ?? 0);
  const hasCallData  = Number(doc.calls_total      ?? 0) > 0;
  const billable     = callCap > 0 ? Math.max(0, callsQual - callCap) : 0;
  const outstandingUsage = billable * ratePerCall;
  const remaining    = Math.max(0, invoiceTotal - amtPaid);
  const isPaid       = payStatus === "paid";

  const ps = PAYMENT_CONFIG[payStatus] ?? PAYMENT_CONFIG.unpaid;

  const monoLabel: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color:         MUTED,
    marginBottom:  8,
  };

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }}>

      {/* 1. Amount hero */}
      <div style={{
        background:   isPaid ? "rgba(78,173,135,0.06)" : "rgba(139,107,62,0.06)",
        border:       `1px solid ${isPaid ? "rgba(78,173,135,0.2)" : "rgba(139,107,62,0.2)"}`,
        borderRadius: 12, padding: "24px 28px", marginBottom: 16,
        display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16,
      }}>
        <div>
          <div style={monoLabel}>Amount Due</div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 44, fontWeight: 600, letterSpacing: "-0.035em", color: TEXT, lineHeight: 1 }}>
            {money(invoiceTotal)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={monoLabel}>Status</div>
          <div style={{ background: ps.bg, border: `1px solid ${ps.border}`, borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: ps.color, fontFamily: "var(--font-ui)" }}>
            {ps.icon} {ps.label}
          </div>
          {doc.due_date && <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 6 }}>Due {fmt(doc.due_date)}</div>}
        </div>
      </div>

      {/* 2. Pay button */}
      {!isPaid && payLink && (
        <a href={payLink} target="_blank" rel="noopener noreferrer" style={{
          display: "block", textAlign: "center", background: "#F3F1EC", color: "#111111",
          textDecoration: "none", padding: "16px 24px", borderRadius: 8,
          fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13, letterSpacing: "0.08em",
          textTransform: "uppercase", marginBottom: 16,
        }}>
          Pay {money(remaining)} Securely →
        </a>
      )}

      {/* No payment link fallback */}
      {!isPaid && !payLink && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", marginBottom: 16, textAlign: "center" }}>
          <p style={{ color: SUBTLE, fontSize: 13, fontFamily: BODY, margin: "0 0 6px", lineHeight: 1.7 }}>
            Payment instructions will be sent within 24 hours of signing.
          </p>
          <a href="mailto:team@hosautomations.co" style={{ color: "#8B6B3E", fontSize: 13, textDecoration: "underline", textDecorationColor: "rgba(139,107,62,0.4)" }}>
            team@hosautomations.co
          </a>
        </div>
      )}

      {/* 3. Monthly Usage */}
      <div style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px", marginBottom: 16 }}>
        <div style={monoLabel}>Monthly Usage</div>
        {hasCallData ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 12 }}>
            {[
              { label: "Calls Included",  value: callCap > 0 ? callCap.toString() : "—"      },
              { label: "Calls Delivered", value: callsQual.toString()                          },
              { label: "Billable Calls",  value: callCap > 0 ? billable.toString() : "—"     },
              { label: "Rate Per Call",   value: ratePerCall > 0 ? money(ratePerCall) : "—"  },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED, marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 600, color: TEXT }}>{value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontFamily: BODY, fontSize: 13, color: MUTED, margin: "10px 0 0", lineHeight: 1.7 }}>
            Monthly call data will appear here once your campaign is live.
            {ratePerCall > 0 && ` You pay ${money(ratePerCall)} per qualified call.`}
          </p>
        )}
        {outstandingUsage > 0 && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(243,241,236,0.06)" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#D4926A", marginBottom: 4 }}>Outstanding Usage</div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 28, fontWeight: 600, color: TEXT }}>{money(outstandingUsage)}</div>
          </div>
        )}
      </div>

      {/* 4. Setup invoice (collapsible) */}
      <details>
        <summary style={{
          cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between",
          padding: "14px 0", borderBottom: "1px solid rgba(243,241,236,0.06)",
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
          textTransform: "uppercase", color: MUTED,
        }}>
          <span>Setup Invoice</span><span>▾</span>
        </summary>
        <div style={{ paddingTop: 16 }}>
          <div style={css.card}>
            <InvoiceTable doc={doc} sectionNum="01" />
          </div>
        </div>
      </details>

      {/* Paid confirmation */}
      {isPaid && (
        <div style={{
          background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`,
          borderRadius: 10, padding: "16px 20px", marginTop: 20,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 14, color: GREEN }}>
              Payment Received
            </div>
            {doc.paid_at && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 2, letterSpacing: "0.06em" }}>
                {new Date(doc.paid_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                {doc.stripe_customer_email ? ` · ${doc.stripe_customer_email}` : ""}
              </div>
            )}
          </div>
        </div>
      )}

      <AutoRefresh intervalMs={15000} />
    </div>
  );
}
