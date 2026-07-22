"use client";
import { useState } from "react";
import { DISPLAY, UI, BODY, MONO, MUTED, TEXT, GREEN, css } from "@/lib/styles";
import type { Doc } from "@/types";

interface Props {
  doc: Doc;
}

export function SignedPortalEntrance({ doc }: Props) {
  const [loading, setLoading] = useState(false);

  async function enterPortal() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug: doc.slug ?? undefined, code: doc.code }),
      });
      const json = await res.json();
      if (json.ok && json.data?.slug) {
        window.location.href = `/portal/${json.data.slug}/status`;
        return;
      }
    } catch { /* fall through */ }
    if (doc.slug) {
      window.location.href = `/portal/${doc.slug}/status`;
    } else {
      setLoading(false);
    }
  }

  return (
    <div style={{ ...css.app, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "60px 24px", maxWidth: 480, margin: "0 auto", width: "100%" }}>

        {/* Check circle */}
        <div style={{
          width:          72,
          height:         72,
          borderRadius:   "50%",
          border:         "2px solid #4EAD87",
          background:     "rgba(78,173,135,0.09)",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 28px",
          fontSize:       28,
          color:          "#4EAD87",
          animation:      "scalePop 500ms var(--spring)",
        }}>
          ✓
        </div>

        <div style={{
          fontFamily:    MONO,
          fontSize:      9,
          letterSpacing: "0.18em",
          color:         "rgba(139,107,62,0.5)",
          textTransform: "uppercase",
          marginBottom:  14,
        }}>
          Agreement Executed
        </div>

        <h1 style={{
          fontFamily:    DISPLAY,
          fontSize:      "clamp(40px, 6vw, 64px)",
          fontStyle:     "italic",
          fontWeight:    300,
          letterSpacing: "-0.01em",
          lineHeight:    1.0,
          color:         TEXT,
          marginBottom:  32,
          animation:     "slideUp 600ms var(--ease-out) both 120ms",
        }}>
          You&apos;re in.
        </h1>

        {[
          "Agreement Signed",
          "Invoice Confirmed",
          "Campaign Setup Initiated",
        ].map((item, i) => (
          <div key={item} style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12, justifyContent: "center",
            animation: "slideUp 500ms var(--ease-out) both",
            animationDelay: `${360 + i * 160}ms`,
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: "rgba(78,173,135,0.15)", border: "1px solid rgba(78,173,135,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "scalePop 400ms var(--spring) both", animationDelay: `${420 + i * 160}ms`,
            }}>
              <svg width="9" height="8" viewBox="0 0 8 7" fill="none">
                <polyline points="1,3.5 3,5.5 7,1" stroke={GREEN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ fontFamily: BODY, fontSize: 15, color: TEXT }}>{item}</span>
          </div>
        ))}

        <button
          onClick={enterPortal}
          disabled={loading}
          style={{
            ...css.btnP,
            marginTop:     32,
            width:         "100%",
            padding:       "16px 40px",
            fontSize:      13,
            fontFamily:    UI,
            fontWeight:    600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity:       loading ? 0.6 : 1,
            cursor:        loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Opening…" : "Enter My Portal →"}
        </button>

        {doc.slug && (
          <p style={{ fontFamily: MONO, fontSize: 10, color: MUTED, marginTop: 14, letterSpacing: "0.08em" }}>
            portal/{doc.slug}
          </p>
        )}

        <p style={{ fontSize: 12, color: MUTED, marginTop: 20, fontFamily: BODY, opacity: 0.5 }}>
          Questions?{" "}
          <a href="mailto:team@hosautomations.co" style={{ color: MUTED, textDecoration: "underline", textDecorationColor: "rgba(114,114,114,0.3)" }}>
            team@hosautomations.co
          </a>
        </p>
      </div>
    </div>
  );
}
