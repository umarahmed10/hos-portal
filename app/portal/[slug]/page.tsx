"use client";
// Portal entry — magic link landing page.
// Server validates the slug; client enters their 6-char code to receive a session cookie.
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast }  from "sonner";
import { cleanCode } from "@/lib/utils";
import { BODY, BORDER, FONT, GREEN, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { Loader2 } from "@/components/shared/Icons";

// We receive the slug via the component props in the page.tsx below.
// This component is the client UI for the entry verification step.
function PortalEntryUI({ slug, magicToken }: { slug: string; magicToken: string | null }) {
  const router   = useRouter();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/portal-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug, code, magicToken }),
      });
      const json = await res.json();

      if (json.ok) {
        router.push(`/portal/${slug}/status`);
      } else {
        setError(json.error || "Verification failed. Please check your code.");
        setLoading(false);
      }
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
      padding:        24,
    }}>
      {/* Dot-grid bg */}
      <div style={{
        position:   "absolute",
        inset:      0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 400, width: "100%", position: "relative", zIndex: 1, animation: "fadeIn 200ms ease-out" }}>

        {/* Brand */}
        <div style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          8,
          padding:      "4px 12px",
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 100,
          marginBottom: 32,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY }}>
            HOS AUTOMATIONS
          </span>
        </div>

        <div style={{ fontSize: 10, letterSpacing: "2.5px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 10 }}>
          CLIENT PORTAL
        </div>

        <h1 style={{ fontFamily: FONT, fontSize: 44, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.0, color: TEXT, marginBottom: 10 }}>
          VERIFY<br />YOUR<br />IDENTITY
        </h1>

        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Enter the 6-character access code from your onboarding email to access your portal.
        </p>

        <form onSubmit={handleVerify}>
          <div style={{ marginBottom: 16 }}>
            <label style={css.lbl}>Access Code</label>
            <input
              type="text"
              autoFocus
              autoComplete="off"
              value={code}
              onChange={e => setCode(cleanCode(e.target.value))}
              placeholder="A1B2C3"
              maxLength={6}
              style={{
                ...css.inp,
                fontSize:      24,
                fontFamily:    "var(--font-mono)",
                letterSpacing: "6px",
                textAlign:     "center",
                textTransform: "uppercase",
                padding:       "14px 20px",
              }}
            />
          </div>

          {error && (
            <div style={{
              background:   "rgba(239,68,68,0.08)",
              border:       "1px solid rgba(239,68,68,0.2)",
              borderRadius: 7,
              padding:      "10px 14px",
              fontSize:     13,
              color:        "#ef4444",
              marginBottom: 14,
              fontFamily:   BODY,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            style={{
              ...css.btnP,
              width:   "100%",
              opacity: loading || code.length !== 6 ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "14px 24px",
              fontSize: 14,
            }}
          >
            {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "VERIFYING…" : "ACCESS MY PORTAL →"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#1c1c1c", textAlign: "center", marginTop: 20, fontFamily: BODY }}>
          Your code was included in the email from HOS Automations.
        </p>
      </div>
    </div>
  );
}

// The page itself — receives slug from URL params and magicToken from query string.
export default function PortalEntryPage({
  params,
  searchParams,
}: {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ mt?: string }>;
}) {
  const [resolved, setResolved] = useState<{ slug: string; mt: string | null } | null>(null);

  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setResolved({ slug: p.slug, mt: sp.mt ?? null });
    });
  }, [params, searchParams]);

  if (!resolved) {
    return (
      <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ color: MUTED, fontSize: 13, fontFamily: BODY }}>Loading…</div>
      </div>
    );
  }

  return <PortalEntryUI slug={resolved.slug} magicToken={resolved.mt} />;
}
