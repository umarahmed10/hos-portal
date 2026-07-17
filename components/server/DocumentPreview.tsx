// Server Component — renders the full client-facing document (agreement + invoice).
// Used in app/client/[code]/page.tsx and (read-only preview) in admin.
import { BODY, BORDER, FONT, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { StatusBadge }   from "./StatusBadge";
import { InvoiceTable }  from "./InvoiceTable";
import type { Doc }      from "@/types";

interface Props {
  doc:       Doc;
  showSign?: boolean; // show sign CTA (client view); false for admin preview
}

const Section = ({ n, t }: { n?: string; t: string }) => (
  <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: "#444", fontFamily: BODY, marginBottom: 16 }}>
    {n && <span style={{ marginRight: 10, color: "#2a2a2a" }}>{n}</span>}
    {t}
  </div>
);

export function DocumentPreview({ doc, showSign = true }: Props) {
  const showAg  = doc.type === "agreement" || doc.type === "both";
  const showInv = doc.type === "invoice"   || doc.type === "both";
  const agNum   = "01";
  const invNum  = showAg ? "02" : "01";

  return (
    <div>
      {/* Agreement */}
      {showAg && doc.agreement_text && (
        <div style={css.card}>
          <Section n={agNum} t="SERVICE AGREEMENT" />
          <div className="doc-text">{doc.agreement_text}</div>
        </div>
      )}

      {/* Invoice */}
      {showInv && (
        <div style={css.card}>
          <InvoiceTable doc={doc} sectionNum={invNum} />
        </div>
      )}

      {/* Sign CTA — pending */}
      {showSign && doc.status === "pending" && (
        <div style={{ ...css.card, textAlign: "center", padding: 32 }}>
          <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, marginBottom: 8, color: TEXT, letterSpacing: "0.5px" }}>
            READY TO GET STARTED?
          </div>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, marginBottom: 22 }}>
            Review everything above, then sign to confirm your agreement with House Of Sales.
          </p>
          {/* Sign button rendered by client page — passed as slot */}
        </div>
      )}

      {/* Already signed */}
      {doc.status === "signed" && (
        <div style={{ ...css.card, textAlign: "center", padding: 24, borderColor: "rgba(34,197,94,0.2)" }}>
          <StatusBadge status="signed" />
          {doc.signed_at && (
            <p style={{ color: MUTED, fontSize: 12, marginTop: 8 }}>
              Signed {new Date(doc.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
          {doc.signature && (
            <div style={{ marginTop: 16, padding: "12px 0", borderTop: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 10, color: "#333", letterSpacing: "1.5px", fontFamily: BODY, marginBottom: 8 }}>SIGNATURE ON FILE</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.signature}
                alt="Client signature"
                style={{ maxWidth: 260, height: "auto", background: SURF, borderRadius: 6, padding: 8 }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
