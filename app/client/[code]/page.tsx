// Server Component — client document view.
// Shows a compact summary card (not full agreement) before sign CTA.
// Logs "viewed" event on every load.
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { headers }          from "next/headers";
import { getDocForClient, logEvent, recordFirstView } from "@/lib/data-access";
import { getAdminSession }  from "@/lib/auth";
import { signPdfToken }     from "@/lib/pdf-token";
import { PortalEntranceGate } from "@/components/client/PortalEntranceGate";
import { TrustBox }         from "@/components/client/TrustBox";
import { ProgressBanner }   from "@/components/client/ProgressBanner";
import { HOSLogo }          from "@/components/shared/HOSLogo";
import { BORDER, GOLD_DIM, GOLD_BORDER, MUTED, TEXT, MONO, css } from "@/lib/styles";
import { money, fmt }       from "@/lib/utils";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ClientDocPage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc) notFound();

  const hdrs        = await headers();
  const ip          = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua          = hdrs.get("user-agent") ?? null;
  const adminSess   = await getAdminSession();
  const isAdminView = !!adminSess;
  // This flow is code-authenticated with no session, so the PDF link carries a
  // short-lived token bound to this code.
  const pdfToken    = await signPdfToken(doc.code);

  if (!isAdminView) {
    // Only log events for real client visits — not admin previews
    logEvent(doc.id, "viewed", { via: "code", code: doc.code }, ip, ua, null, null, false).catch(() => {});
    recordFirstView(doc.code, ip, ua).catch(() => {});
  }

  const isPending = doc.status === "pending";
  const isSigned  = doc.status === "signed";

  // Signed clients see the "You're in." celebration once (per device); on
  // return visits the gate silently forwards them into the portal.
  if (isSigned) {
    return <PortalEntranceGate doc={doc} />;
  }

  return (
    <div style={{ ...css.app, paddingBottom: 80 }}>
      {/* Sticky exit button */}
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 1000 }}>
        <Link
          href="/"
          style={{
            fontFamily:     "var(--font-mono)",
            fontSize:       9,
            letterSpacing:  "0.12em",
            textTransform:  "uppercase",
            // Was #404040 — 1.82:1 against the near-black background, well under
            // the 4.5:1 WCAG AA minimum for a functional control.
            color:          MUTED,
            textDecoration: "none",
            padding:        "6px 12px",
            border:         "1px solid #2A2A2A",
            borderRadius:   4,
            background:     "#111111",
          }}
        >
          Exit
        </Link>
      </div>

      <ProgressBanner doc={doc} />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 0", marginBottom: 28 }}>
        <div style={{ ...css.wrap, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HOSLogo size={26} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontSize: 9, letterSpacing: "2px", color: MUTED, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase" }}>
                HOS
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: TEXT }}>
                Client Portal
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: TEXT }}>{doc.name}</div>
            {doc.company && <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{doc.company}</div>}
          </div>
        </div>
      </div>

      <div style={{ ...css.wrap, animation: "fadeIn 320ms var(--ease-out)" }}>

        {/* Document summary card */}
        <div style={{ ...css.card, marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: MUTED, fontFamily: "var(--font-mono)", marginBottom: 16, textTransform: "uppercase" }}>
            Your documents
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Agreement */}
            {(doc.type === "both" || doc.type === "agreement") && (
              <div style={{
                display:      "flex",
                alignItems:   "center",
                gap:          12,
                padding:      "14px 16px",
                background:   "rgba(255,255,255,0.02)",
                borderRadius: 8,
                border:       `1px solid ${BORDER}`,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B6B3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: TEXT, fontFamily: "var(--font-body)" }}>Service agreement</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {doc.agreement_text ? `${doc.agreement_text.length > 80 ? doc.agreement_text.slice(0, 80) + "…" : doc.agreement_text}` : "Ready to review"}
                  </div>
                </div>
                {isPending && <span style={{ fontSize: 11, color: MUTED }}>Pending</span>}
              </div>
            )}

            {/* Invoice */}
            {(doc.type === "both" || doc.type === "invoice") && doc.invoice_total > 0 && (
              <div style={{
                display:      "flex",
                alignItems:   "center",
                gap:          12,
                padding:      "14px 16px",
                background:   "rgba(255,255,255,0.02)",
                borderRadius: 8,
                border:       `1px solid ${BORDER}`,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B6B3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2z" />
                  <line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: TEXT, fontFamily: "var(--font-body)" }}>Invoice</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                    Total: <span style={{ fontFamily: MONO, color: TEXT }}>{money(doc.invoice_total)}</span>
                    {doc.due_date ? ` · Due ${fmt(doc.due_date)}` : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sign CTA */}
        {isPending && (
          <>
            <TrustBox style={{ marginBottom: 16 }} />
            <div style={{
              ...css.card,
              background:  GOLD_DIM,
              borderColor: GOLD_BORDER,
              textAlign:   "center",
              padding:     "22px 24px",
            }}>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>
                Ready to activate your account? Review and sign in about 2 minutes.
              </p>
              <Link
                href={`/client/${doc.code}/sign`}
                style={{ ...css.btnP, display: "inline-flex", textDecoration: "none", padding: "15px 48px", fontSize: 15 }}
              >
                Review & sign →
              </Link>
              <p style={{ color: MUTED, fontSize: 12, marginTop: 12, opacity: 0.6 }}>
                Your signed copy will be emailed automatically.
              </p>
            </div>
          </>
        )}

        {/* PDF always available */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a
            href={`/api/pdf?code=${doc.code}&t=${pdfToken}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: MUTED, fontFamily: "var(--font-body)", opacity: 0.5, textDecoration: "none" }}
          >
            Download PDF copy ↗
          </a>
        </div>

        <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 20, fontFamily: "var(--font-body)", opacity: 0.5 }}>
          Questions?{" "}
          <a href="mailto:team@hosautomations.co" style={{ color: MUTED, textDecoration: "underline", textDecorationColor: "rgba(114,114,114,0.3)" }}>
            team@hosautomations.co
          </a>
        </p>
      </div>
    </div>
  );
}
