"use client";
// Portal entry UI — magic link auto-auth and code fallback.
// Rendered by the server component page.tsx after session check.
import { useState, useEffect } from "react";
import {BODY, BORDER, MUTED, TEXT, css, GOLD_TEXT } from "@/lib/styles";
import { HOSLogo } from "@/components/shared/HOSLogo";

function sanitizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

interface Props {
  slug:       string;
  magicToken: string | null;
}

export function PortalEntryUI({ slug, magicToken }: Props) {
  const [mode, setMode]       = useState<"auto" | "form" | "error">(magicToken ? "auto" : "form");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Safety timeout — if loading stays true for 8s with no redirect, reset with error
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }, 8000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!magicToken) return;
    const timeout = setTimeout(() => setMode("error"), 8000);
    fetch("/api/portal-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ slug, magicToken }),
    })
      .then(r => r.json())
      .then(json => {
        clearTimeout(timeout);
        if (json.ok) {
          window.location.href = `/portal/${slug}/status`;
        } else {
          setMode("error");
        }
      })
      .catch(() => { clearTimeout(timeout); setMode("error"); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const sanitized = sanitizeCode(code);
    if (sanitized.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/portal-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug, code: sanitized }),
      });
      const json = await res.json();

      if (json.ok) {
        window.location.href = `/portal/${slug}/status`;
        return;
      }

      // Slug mismatch — try to find the correct slug for this code
      if (res.status === 401 || res.status === 404) {
        const lookup = await fetch(`/api/docs/by-code/${sanitized}`);
        const lookupJson = await lookup.json();

        if (lookupJson.ok && lookupJson.data.slug && lookupJson.data.slug !== slug) {
          const retry = await fetch("/api/portal-session", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ slug: lookupJson.data.slug, code: sanitized }),
          });
          const retryJson = await retry.json();
          if (retryJson.ok) {
            window.location.href = `/portal/${lookupJson.data.slug}/status`;
            return;
          }
        }
      }

      setError("That code doesn't look right. Check your email and try again.");
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      ...css.app,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      minHeight:      "100vh",
      padding:        "24px 20px",
      position:       "relative",
    }}>
      {/* Subtle top glow */}
      <div style={{
        position:    "absolute",
        top:         0,
        left:        "50%",
        transform:   "translateX(-50%)",
        width:       "60%",
        height:      240,
        background:  "radial-gradient(ellipse at top, rgba(139,107,62,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 380, width: "100%", position: "relative", zIndex: 1, animation: "fadeIn 320ms var(--ease-out) both" }}>

        {/* Brand mark */}
        <div style={{ marginBottom: 36 }}>
          <HOSLogo size={26} theme="dark" showWordmark={false} />
        </div>

        {/* Auto-auth loading */}
        {mode === "auto" && (
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <div style={{
              width:        60,
              height:       60,
              borderRadius: "50%",
              border:       `1px solid ${BORDER}`,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              margin:       "0 auto 28px",
            }}>
              <div style={{ width: 22, height: 22, border: "2px solid rgba(139,107,62,0.2)", borderTop: "2px solid #8B6B3E", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            </div>
            <div style={{ fontFamily: BODY, fontSize: 15, color: MUTED, letterSpacing: "0.04em" }}>
              OPENING…
            </div>
          </div>
        )}

        {/* Code entry form */}
        {(mode === "form" || mode === "error") && (
          <>
            {/* Bronze mono label */}
            <div style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      9,
              letterSpacing: "0.18em",
              color:         GOLD_TEXT,
              textTransform: "uppercase",
              marginBottom:  16,
            }}>
              {mode === "error" ? "Link Expired" : "Client Portal"}
            </div>

            <h1 style={{
              fontFamily:    "var(--font-display)",
              fontSize:      "clamp(32px, 5vw, 48px)",
              fontWeight:    400,
              fontStyle:     "italic",
              color:         TEXT,
              letterSpacing: "0.005em",
              lineHeight:    1.05,
              marginBottom:  12,
            }}>
              {mode === "error" ? "Link expired." : "Access your portal."}
            </h1>

            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: MUTED, lineHeight: 1.7, marginBottom: 32 }}>
              {mode === "error"
                ? "This link has expired. Enter your backup code below."
                : "Your access code was included in your onboarding email."}
            </p>

            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: 14 }}>
                <label style={{
                  ...css.lbl,
                  color:         GOLD_TEXT,
                  letterSpacing: "0.16em",
                }}>
                  Access Code
                </label>
                <input
                  type="text"
                  autoFocus
                  autoComplete="off"
                  value={code}
                  onChange={e => setCode(sanitizeCode(e.target.value))}
                  placeholder="A1B2C3"
                  maxLength={6}
                  style={{
                    ...css.inp,
                    fontSize:      32,
                    fontFamily:    "var(--font-mono)",
                    letterSpacing: code.length === 6 ? "0.22em" : "0.15em",
                    textAlign:     "center",
                    textTransform: "uppercase",
                    padding:       "16px 20px",
                    background:    code.length === 6 ? "rgba(78,173,135,0.06)" : "#222222",
                    borderColor:   code.length === 6 ? "rgba(78,173,135,0.3)" : "#2A2A2A",
                    transition:    "background 200ms, border-color 200ms, letter-spacing 200ms",
                  }}
                />
              </div>

              {error && (
                <p style={{
                  fontSize:     13,
                  color:        "#C96A6A",
                  marginBottom: 14,
                  fontFamily:   "var(--font-body)",
                  lineHeight:   1.5,
                }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                style={{
                  ...css.btnP,
                  width:         "100%",
                  opacity:       loading || code.length !== 6 ? 0.4 : 1,
                  padding:       "15px 24px",
                  fontSize:      13,
                  fontFamily:    "var(--font-ui)",
                  fontWeight:    600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  transform:     code.length === 6 && !loading ? "scale(1.01)" : "scale(1)",
                  boxShadow:     code.length === 6 && !loading ? "0 0 24px rgba(243,241,236,0.08)" : "none",
                  transition:    "transform 200ms var(--ease-spring), box-shadow 200ms, opacity 150ms",
                }}
              >
                {loading ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <div style={{
                      width:        16,
                      height:       16,
                      border:       "1.5px solid rgba(17,17,17,0.2)",
                      borderTop:    "1.5px solid #111111",
                      borderRadius: "50%",
                      animation:    "spin 600ms linear infinite",
                    }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      Verifying access…
                    </span>
                  </div>
                ) : "Enter My Portal →"}
              </button>
            </form>

            <p style={{ fontSize: 12, color: MUTED, textAlign: "center", marginTop: 20, fontFamily: "var(--font-body)", opacity: 0.5 }}>
              Questions?{" "}
              <a href="mailto:team@hosautomations.co" style={{ color: MUTED, textDecoration: "underline", textDecorationColor: "rgba(114,114,114,0.3)" }}>
                Email team@hosautomations.co
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
