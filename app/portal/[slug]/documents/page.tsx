// Portal Documents tab — agreement + invoice with sign CTA.
import { notFound, redirect } from "next/navigation";
import Link                   from "next/link";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug, logEvent } from "@/lib/data-access";
import { DocumentPreview }    from "@/components/server/DocumentPreview";
import { TrustBox }           from "@/components/client/TrustBox";
import { BODY, FONT, GREEN, MUTED, TEXT, css } from "@/lib/styles";
import { headers }            from "next/headers";

interface Props {
  params: Promise<{ slug: string }>;
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
  logEvent(doc.id, "viewed", { via: "portal", tab: "documents" }, ip, ua).catch(() => {});

  const isPending = doc.status === "pending";
  const isSigned  = doc.status === "signed";

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          YOUR DOCUMENTS
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 900, letterSpacing: "-0.5px", color: TEXT, marginBottom: 8 }}>
          Review &amp; Sign
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
          Your agreement and invoice are below. Read through everything, then sign to activate your account.
        </p>
      </div>

      {/* Documents */}
      <DocumentPreview doc={doc} showSign={false} />

      {/* Trust box */}
      <TrustBox style={{ marginBottom: 24 }} />

      {/* Sign CTA */}
      {isPending && (
        <div style={{ textAlign: "center", marginTop: 8, marginBottom: 24 }}>
          <Link
            href={`/client/${doc.code}/sign`}
            style={{ ...css.btnP, display: "inline-block", textDecoration: "none", padding: "16px 56px", fontSize: 15 }}
          >
            SIGN AGREEMENT →
          </Link>
          <p style={{ color: "#1c1c1c", fontSize: 12, marginTop: 12, fontFamily: BODY }}>
            Takes about 30 seconds. Your signed copy will be emailed automatically.
          </p>
        </div>
      )}

      {/* Signed state */}
      {isSigned && (
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#22c55e", fontSize: 13, fontFamily: BODY, marginBottom: 12 }}>
            <span style={{ fontWeight: 700 }}>✓</span>
            Agreement signed — {doc.signed_at ? new Date(doc.signed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
          </div>
          <div>
            <a
              href={`/api/pdf?code=${doc.code}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...css.btnS, display: "inline-block", textDecoration: "none", padding: "10px 24px", fontSize: 13 }}
            >
              Download Signed PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
