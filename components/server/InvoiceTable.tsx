import { AMBER, AMBER_DIM, AMBER_BORDER, BORDER, BODY, FONT, GREEN, GREEN_DIM, GREEN_BORDER, MONO, MUTED, TEXT } from "@/lib/styles";
import { fmt, money, rowTotal }                  from "@/lib/utils";
import type { Doc }                              from "@/types";

interface Props {
  doc:        Doc;
  sectionNum?: string;
  showPayment?: boolean;
}

const PAYMENT_COLORS = {
  unpaid:         { color: AMBER, bg: AMBER_DIM,  border: AMBER_BORDER,  label: "Unpaid"        },
  partially_paid: { color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", label: "Partially Paid" },
  paid:           { color: GREEN, bg: GREEN_DIM,  border: GREEN_BORDER,  label: "Paid in Full"  },
};

export function InvoiceTable({ doc, sectionNum, showPayment = true }: Props) {
  const ps = PAYMENT_COLORS[doc.payment_status] ?? PAYMENT_COLORS.unpaid;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          {sectionNum && (
            <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: "#444", fontFamily: BODY, marginBottom: 6 }}>
              <span style={{ marginRight: 10, color: "#2a2a2a" }}>{sectionNum}</span>
              INVOICE
            </div>
          )}
          <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color: TEXT }}>
            HOS AUTOMATIONS
          </div>
          <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
            Lead Generation Services
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
          <div>Issued {fmt(doc.created_at)}</div>
          {doc.due_date && <div>Due {fmt(doc.due_date)}</div>}
          {showPayment && (
            <div style={{
              display:      "inline-block",
              marginTop:    6,
              padding:      "2px 10px",
              borderRadius: 20,
              fontSize:     11,
              fontWeight:   700,
              background:   ps.bg,
              color:        ps.color,
              border:       `1px solid ${ps.border}`,
              letterSpacing: "0.3px",
            }}>
              {ps.label}
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Description", "Qty", "Unit Price", "Total"].map((h, i) => (
              <th key={h} style={{
                padding:       "8px 0",
                fontSize:      10,
                fontWeight:    600,
                letterSpacing: "1px",
                color:         "#444",
                textAlign:     i === 0 ? "left" : "right",
                fontFamily:    BODY,
              }}>
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #161616" }}>
              <td style={{ padding: "12px 0", fontSize: 14, color: TEXT }}>{item.desc}</td>
              <td style={{ padding: "12px 0", fontSize: 14, textAlign: "right", color: MUTED, fontFamily: MONO }}>{item.qty || "—"}</td>
              <td style={{ padding: "12px 0", fontSize: 14, textAlign: "right", color: MUTED, fontFamily: MONO }}>{money(item.price)}</td>
              <td style={{ padding: "12px 0", fontSize: 14, textAlign: "right", fontWeight: 600, color: TEXT, fontFamily: MONO }}>{money(rowTotal(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Total box */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ background: "#0a0a0a", borderRadius: 8, padding: "14px 20px", minWidth: 240 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 48, fontSize: 13, color: MUTED, marginBottom: 8 }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: MONO }}>{money(doc.invoice_total)}</span>
          </div>

          {doc.payment_status === "partially_paid" && doc.amount_paid > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 48, fontSize: 13, color: MUTED, marginBottom: 8 }}>
              <span>Amount Paid</span>
              <span style={{ fontFamily: MONO, color: GREEN }}>− {money(doc.amount_paid)}</span>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${BORDER}`, margin: "8px 0" }} />

          {doc.payment_status === "paid" ? (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 48 }}>
              <span style={{ fontWeight: 700, fontFamily: FONT, fontSize: 16, letterSpacing: "0.5px", color: GREEN }}>
                PAID IN FULL
              </span>
              <span style={{ fontWeight: 800, fontSize: 22, color: GREEN, fontFamily: MONO }}>
                {money(doc.invoice_total)}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 48 }}>
              <span style={{ fontWeight: 700, fontFamily: FONT, fontSize: 16, letterSpacing: "0.5px" }}>
                {doc.payment_status === "partially_paid" ? "BALANCE DUE" : "TOTAL DUE"}
              </span>
              <span style={{ fontWeight: 800, fontSize: 22, color: TEXT, fontFamily: MONO }}>
                {money(Math.max(0, doc.invoice_total - (doc.amount_paid || 0)))}
              </span>
            </div>
          )}
        </div>
      </div>

      {doc.pay_notes && (
        <p style={{ fontSize: 12, color: "#444", marginTop: 14, lineHeight: 1.7 }}>
          {doc.pay_notes}
        </p>
      )}
    </div>
  );
}
