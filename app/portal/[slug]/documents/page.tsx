// Portal Documents tab — agreement in readable sections + PDF download.
import { notFound, redirect } from "next/navigation";
import Link                   from "next/link";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug, logEvent } from "@/lib/data-access";
import { BODY, GREEN, GREEN_DIM, GREEN_BORDER, MUTED, TEXT, css } from "@/lib/styles";
import { headers }            from "next/headers";
import { fmtDateTime }        from "@/lib/utils";

interface Props {
  params: Promise<{ slug: string }>;
}

function parseAgreement(text: string): { title: string; body: string }[] {
  if (!text?.trim()) return [];
  const sections = text.split(/(?=\d+\.\s+[A-Z][A-Z\s&]+\n)/);
  return sections.filter(s => s.trim()).map(s => {
    const match = s.match(/^(\d+\.\s+.+?)\n([\s\S]+)$/);
    if (!match) return { title: "Agreement", body: s.trim() };
    return { title: match[1].replace(/^\d+\.\s+/, "").trim(), body: match[2].trim() };
  });
}

export default async function PortalDocumentsPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const hdrs = await headers();
  const ip   = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua   = hdrs.get("user-agent") ?? null;
  logEvent(doc.id, "viewed", { via: "portal", tab: "documents" }, ip, ua, null, null, false).catch(() => {});

  const isPending = doc.status === "pending";
  const isSigned  = doc.status === "signed";
  const sections  = doc.agreement_text ? parseAgreement(doc.agreement_text) : [];

  return (
    <div style={{ animation: "fadeIn 280ms var(--ease-out)" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          Your documents
        </div>
        <h2 style={{ fontFamily: BODY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.3px", color: TEXT, marginBottom: 8 }}>
          {isSigned ? "Signed agreement" : "Your agreement"}
        </h2>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 480, margin: 0 }}>
          {isSigned
            ? "Your agreement is on file. Download your signed copy below."
            : "Review your service agreement below, then sign to activate your account."}
        </p>
      </div>

      {/* Agreement sections */}
      <div style={{ ...css.card, padding: "24px 28px", marginBottom: 16 }}>
        {sections.length > 0 ? (
          <>
            {sections.map(({ title, body }, i) => (
              <div key={title} style={{
                marginBottom: 12,
                paddingBottom: 20,
                borderBottom: i < sections.length - 1 ? "1px solid rgba(243,241,236,0.06)" : "none",
              }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(139,107,62,0.55)", marginBottom: 10 }}>
                  {title}
                </div>
                <p style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.75, color: MUTED, margin: 0 }}>
                  {body}
                </p>
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontFamily: BODY, fontSize: 14, color: MUTED, lineHeight: 1.75, margin: 0 }}>
            {doc.agreement_text ?? "Agreement not yet generated."}
          </p>
        )}

        {/* PDF download */}
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(243,241,236,0.06)" }}>
          <a href={`/api/pdf?code=${doc.code}`} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8B6B3E", textDecoration: "none" }}>
            Download Signed PDF ↗
          </a>
        </div>
      </div>

      {/* Sign CTA — stays inside portal via /portal/[slug]/sign route */}
      {isPending && (
        <div style={{
          ...css.card,
          padding:    "20px 24px",
          marginTop:  8,
          background: "rgba(201,169,110,0.04)",
          borderColor: "rgba(201,169,110,0.2)",
          textAlign:  "center",
        }}>
          <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            Ready to activate your account? Sign your agreement to get started.
          </p>
          <Link
            href={`/portal/${slug}/sign`}
            style={{ ...css.btnP, display: "inline-flex", textDecoration: "none", padding: "15px 48px", fontSize: 15 }}
          >
            Sign now →
          </Link>
          <p style={{ color: MUTED, fontSize: 12, marginTop: 12, fontFamily: BODY, opacity: 0.6 }}>
            Your signed copy will be emailed automatically.
          </p>
        </div>
      )}

      {/* Signed state */}
      {isSigned && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            color: GREEN, fontSize: 13, fontFamily: BODY, fontWeight: 600,
            marginBottom: 16, padding: "12px 16px",
            background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`, borderRadius: 10,
          }}>
            <span>✓</span>
            Agreement signed
            {doc.signed_at ? ` · ${fmtDateTime(doc.signed_at)}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
