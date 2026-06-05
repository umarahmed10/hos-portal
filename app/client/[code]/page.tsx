// Server Component — fetches doc server-side, renders document + sign CTA.
// Also logs a "viewed" event with IP/UA for admin tracking.
import { notFound }         from "next/navigation";
import Link                 from "next/link";
import { headers }          from "next/headers";
import { getDocForClient, logEvent, recordFirstView } from "@/lib/data-access";
import { DocumentPreview }  from "@/components/server/DocumentPreview";
import { BODY, BORDER, FONT, MUTED, TEXT, css } from "@/lib/styles";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ClientDocPage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc) notFound();

  // Log view event (non-blocking — admin uses service role separately)
  const hdrs = await headers();
  const ip   = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua   = hdrs.get("user-agent") ?? null;

  logEvent(doc.id, "viewed", { via: "code", code: doc.code }, ip, ua).catch(() => {});
  recordFirstView(doc.code, ip, ua).catch(() => {});

  return (
    <div style={{ ...css.app, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "18px 0", marginBottom: 32 }}>
        <div style={{ ...css.wrap, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", color: "#333", fontFamily: BODY, fontWeight: 700, marginBottom: 4 }}>
              HOS AUTOMATIONS
            </div>
            <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, letterSpacing: "0.3px", color: TEXT }}>
              REVIEW YOUR DOCUMENTS
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{doc.name}</div>
            {doc.company && <div style={{ fontSize: 12, color: MUTED }}>{doc.company}</div>}
          </div>
        </div>
      </div>

      <div style={css.wrap}>
        <DocumentPreview doc={doc} showSign />

        {/* Sign button — only shown if pending */}
        {doc.status === "pending" && (
          <div style={{ textAlign: "center", marginTop: -4 }}>
            <Link href={`/client/${doc.code}/sign`} style={{ ...css.btnP, display: "inline-block", textDecoration: "none", padding: "14px 48px", fontSize: 14 }}>
              SIGN AGREEMENT →
            </Link>
          </div>
        )}

        {/* PDF download always available */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a
            href={`/api/pdf?code=${doc.code}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12, color: MUTED, fontFamily: BODY }}
          >
            Download PDF copy
          </a>
        </div>
      </div>
    </div>
  );
}
