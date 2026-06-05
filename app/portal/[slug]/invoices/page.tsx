// Portal Invoices tab — invoice details + payment status.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug, logEvent } from "@/lib/data-access";
import { InvoiceTable }       from "@/components/server/InvoiceTable";
import { BODY, BORDER, FONT, GREEN, GREEN_DIM, GREEN_BORDER, AMBER, AMBER_DIM, AMBER_BORDER, MUTED, RED, RED_DIM, SURF, TEXT, css, MONO } from "@/lib/styles";
import { money, fmt }         from "@/lib/utils";
import { headers }            from "next/headers";

interface Props {
  params: Promise<{ slug: string }>;
}

const PAYMENT_CONFIG = {
  unpaid:         { color: AMBER,  bg: AMBER_DIM,  border: AMBER_BORDER,  label: "Unpaid",          icon: "!" },
  partially_paid: { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", label: "Partially Paid", icon: "~" },
  paid:           { color: GREEN,  bg: GREEN_DIM,  border: GREEN_BORDER,  label: "Paid in Full",    icon: "✓" },
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
  logEvent(doc.id, "invoice_viewed", { via: "portal" }, ip, ua).catch(() => {});

  const ps  = PAYMENT_CONFIG[doc.payment_status] ?? PAYMENT_CONFIG.unpaid;
  const remaining = Math.max(0, doc.invoice_total - doc.amount_paid);

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          YOUR INVOICE
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 900, letterSpacing: "-0.5px", color: TEXT, marginBottom: 8 }}>
          Invoice Details
        </h2>
      </div>

      {/* Payment status badge */}
      <div style={{
        background:   ps.bg,
        border:       `1px solid ${ps.border}`,
        borderRadius: 10,
        padding:      "18px 24px",
        marginBottom: 20,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "space-between",
        gap:          16,
        flexWrap:     "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `2px solid ${ps.color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: ps.color, fontSize: 16, fontWeight: 700, flexShrink: 0,
          }}>
            {ps.icon}
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: ps.color, letterSpacing: "0.3px" }}>
              {ps.label}
            </div>
            {doc.payment_status === "partially_paid" && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2, fontFamily: BODY }}>
                {money(doc.amount_paid)} paid of {money(doc.invoice_total)} total
              </div>
            )}
          </div>
        </div>

        {doc.payment_status !== "paid" && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, letterSpacing: "1px", marginBottom: 2 }}>AMOUNT DUE</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 800, color: TEXT }}>
              {money(remaining)}
            </div>
            {doc.due_date && (
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>Due {fmt(doc.due_date)}</div>
            )}
          </div>
        )}
      </div>

      {/* Invoice table */}
      <div style={css.card}>
        <InvoiceTable doc={doc} sectionNum="01" />
      </div>

      {/* Payment instructions */}
      {doc.payment_status !== "paid" && (
        <div style={{ ...css.card, borderColor: BORDER }}>
          <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 14, textTransform: "uppercase" }}>
            Payment Instructions
          </div>
          {doc.pay_notes ? (
            <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, margin: 0, fontFamily: BODY }}>
              {doc.pay_notes}
            </p>
          ) : (
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.8, fontFamily: BODY }}>
              <p style={{ margin: "0 0 8px" }}>
                Please submit payment via one of the following methods:
              </p>
              <p style={{ margin: "0 0 4px" }}>· ACH / Bank Transfer (preferred)</p>
              <p style={{ margin: "0 0 4px" }}>· Check payable to HOS Automations</p>
              <p style={{ margin: "0 0 16px" }}>· Credit card on request</p>
              <p style={{ margin: 0, color: "#444" }}>
                Contact your account manager for payment details or reply to your onboarding email.
              </p>
            </div>
          )}
        </div>
      )}

      {doc.payment_status === "paid" && (
        <div style={{
          ...css.card,
          textAlign:   "center",
          padding:     24,
          borderColor: GREEN_BORDER,
          background:  GREEN_DIM,
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
          <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: GREEN, marginBottom: 4 }}>
            Payment Received — Thank You
          </div>
          <p style={{ color: "#4ade80", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Your account is fully active. We appreciate your business.
          </p>
        </div>
      )}
    </div>
  );
}
