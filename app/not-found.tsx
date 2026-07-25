// Styled 404. Without this, Next's unstyled default renders — on a route real
// clients do hit (expired or mistyped portal links).
import Link from "next/link";
import { HOSLogo } from "@/components/shared/HOSLogo";
import { BG, TEXT, MUTED, css } from "@/lib/styles";

export const metadata = { title: "Not found · HOS Client Portal" };

export default function NotFound() {
  return (
    <main
      style={{
        background:     BG,
        minHeight:      "100vh",
        color:          TEXT,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "48px 24px",
        textAlign:      "center",
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <HOSLogo size={36} theme="dark" showWordmark={false} />
      </div>

      <p
        style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:         "rgba(139,107,62,0.7)",
          marginBottom:  16,
        }}
      >
        Error 404
      </p>

      <h1
        style={{
          fontFamily:    "var(--font-display)",
          fontSize:      "clamp(36px, 6vw, 60px)",
          fontWeight:    300,
          fontStyle:     "italic",
          lineHeight:    1,
          marginBottom:  16,
        }}
      >
        We couldn&rsquo;t find that.
      </h1>

      <p
        style={{
          fontFamily:   "var(--font-body)",
          fontSize:     15,
          color:        MUTED,
          lineHeight:   1.6,
          maxWidth:     380,
          marginBottom: 36,
        }}
      >
        The link may have expired, or the address may be mistyped. If you were
        sent here from an email, your access code will still work.
      </p>

      <Link
        href="/"
        style={{
          ...css.btnP,
          textDecoration: "none",
          fontFamily:     "var(--font-ui)",
          fontSize:       13,
          fontWeight:     600,
          letterSpacing:  "0.08em",
          textTransform:  "uppercase",
        }}
      >
        Back to start →
      </Link>

      <p
        style={{
          marginTop:  40,
          fontSize:   12,
          color:      MUTED,
          fontFamily: "var(--font-body)",
        }}
      >
        Need help?{" "}
        <a href="mailto:team@hosautomations.co" style={{ color: MUTED }}>
          team@hosautomations.co
        </a>
      </p>
    </main>
  );
}
