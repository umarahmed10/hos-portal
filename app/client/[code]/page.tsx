// Server Component — client document view.
// Shows a compact summary card (not full agreement) before sign CTA.
// Logs "viewed" event on every load.
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { headers }          from "next/headers";
import { getDocForClient, logEvent, recordFirstView } from "@/lib/data-access";
import { getAdminSession }  from "@/lib/auth";
import { SignedPortalEntrance } from "@/components/client/SignedPortalEntrance";
import { TrustBox }         from "@/components/client/TrustBox";
import { ProgressBanner }   from "@/components/client/ProgressBanner";
import { HOSLogo }          from "@/components/shared/HOSLogo";
import {
  BODY, BORDER, GOLD_DIM, GOLD_BORDER,
  GREEN, MUTED, SURF, TEXT, MONO, css,
} from "@/lib/styles";
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

  if (!isAdminView) {
    // Only log events for real client visits — not admin previews
    logEvent(doc.id, "viewed", { via: "code", code: doc.code }, ip, ua, null, null, false).catch(() => {});
    recordFirstView(doc.code, ip, ua).catch(() => {});
  }

  const isPending = doc.status === "pending";
  const isSigned  = doc.status === "signed";

  // Signed clients go directly to the portal entrance — no document list
  if (isSigned) {
    return <SignedPortalEntrance doc={doc} />;
  }

  return (
    <div style={{ ...css.app, paddingBottom: 80 }}>
      {/* Sticky exit button */}
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 1000 }}>
        <a
          href="/"
          style={{
            fontFamily:     "var(--font-mono)",
            fontSize:       9,
            letterSpacing:  "0.12em",
            textTransform:  "uppercase",
            color:          "#404040",
            textDecoration: "none",
            padding:        "6px 12px",
            border:         "1px solid #2A2A2A",
            borderRadius:   4,
            background:     "#111111",
          }}
        >
          Exit
        </a>
      </div>

      <ProgressBanner doc={doc} />

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 0", marginBottom: 28 }}>
        <div style={{ ...css.wrap, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <HOSLogo size={26} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontSize: 9, letterSpacing: "2px", color: MUTED, fontFamily: "var(--font-mono)", fontWeight: 700, textTransform: "uppercase" }}>
                HOS Automations
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
                <div style={{ fontSize: 20, flexShrink: 0 }}>📄</div>
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
                <div style={{ fontSize: 20, flexShrink: 0 }}>🧾</div>
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
            href={`/api/pdf?code=${doc.code}`}
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
