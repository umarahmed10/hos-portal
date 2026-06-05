"use client";
import { useRouter }   from "next/navigation";
import { CopyButton }  from "./CopyButton";
import { BODY, BORDER, FONT, MONO, MUTED, SURF, TEXT, css } from "@/lib/styles";
import type { Doc }    from "@/types";

interface Props {
  doc: Doc;
}

export function AdminShare({ doc }: Props) {
  const router  = useRouter();
  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || "";
  const docUrl  = `${appUrl}/client/${doc.code}`;
  const message = `Hey ${doc.name}! Review and sign your HOS Automations onboarding docs at ${docUrl} — or open the Client Portal and enter code ${doc.code}. Takes 2 minutes.`;

  return (
    <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ maxWidth: 500, width: "100%", padding: 32, textAlign: "center" }}>

        {/* Icon */}
        <div style={{ width: 64, height: 64, borderRadius: 14, background: SURF, border: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 26 }}>
          🔗
        </div>

        <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
          DOCUMENT READY
        </div>

        <h2 style={{ fontFamily: FONT, fontSize: 52, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1, color: TEXT, marginBottom: 14 }}>
          SHARE WITH<br />YOUR CLIENT
        </h2>

        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
          Send this code to your client. They enter it in the Client Portal, review their documents, and sign — in one shot.
        </p>

        {/* Code box */}
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "28px 32px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: "2.5px", color: "#2e2e2e", fontFamily: BODY, fontWeight: 700, marginBottom: 12 }}>
            CLIENT ACCESS CODE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 700, letterSpacing: "12px", color: TEXT, marginBottom: 18 }}>
            {doc.code}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <CopyButton text={doc.code}  label="Copy Code"    variant="secondary" />
            <CopyButton text={message}   label="Copy Message" variant="secondary" />
          </div>
        </div>

        {/* Suggested message */}
        <div style={{ background: "#0c0c0c", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
          <div style={{ fontSize: 10, letterSpacing: "1.5px", color: "#2e2e2e", fontFamily: BODY, fontWeight: 700, marginBottom: 7 }}>
            SUGGESTED MESSAGE
          </div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            &ldquo;Hey{doc.name ? ` ${doc.name}` : ""}! Review and sign your HOS onboarding docs at the Client Portal — code{" "}
            <span style={{ fontFamily: MONO, fontWeight: 700, color: TEXT, fontSize: 14 }}>{doc.code}</span>
            . Takes 2 minutes.&rdquo;
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => router.push("/admin")} style={css.btnP}>
            DASHBOARD →
          </button>
          <button onClick={() => router.push("/admin/new")} style={css.btnS}>
            New Document
          </button>
        </div>
      </div>
    </div>
  );
}
