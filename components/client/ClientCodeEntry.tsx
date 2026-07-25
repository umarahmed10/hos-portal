"use client";
import { useState }   from "react";
import { useRouter }  from "next/navigation";
import { toast }      from "sonner";
import {MUTED, TEXT, css, GOLD_TEXT } from "@/lib/styles";
import { Loader2 }    from "@/components/shared/Icons";

export function ClientCodeEntry() {
  const router   = useRouter();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);

  function sanitize(raw: string) {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  async function handleAccess() {
    const clean = sanitize(code);
    if (clean.length < 6) return;
    setLoading(true);

    // Validated server-side: the browser must never query `docs` directly, since
    // the anon key is public and the access code is the portal's only secret.
    try {
      const res = await fetch(`/api/docs/by-code/${clean}`);

      if (res.status === 429) {
        setLoading(false);
        toast.error("Too many attempts. Please wait a moment and try again.");
        return;
      }

      const json = await res.json().catch(() => ({ ok: false }));
      setLoading(false);

      if (!json.ok) {
        toast.error("That code doesn't look right. Check your email and try again.");
        return;
      }

      router.push(`/client/${clean}`);
    } catch {
      setLoading(false);
      toast.error("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div style={{
      maxWidth:  400,
      width:     "100%",
      padding:   "0 24px",
      animation: "fadeIn 320ms var(--ease-out) both",
    }}>
      {/* Bronze mono label */}
      <div style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      9,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color:         GOLD_TEXT,
        marginBottom:  16,
      }}>
        Client Access
      </div>

      {/* Editorial heading */}
      <h1 style={{
        fontFamily:    "var(--font-display)",
        fontSize:      "clamp(36px, 7vw, 56px)",
        fontWeight:    300,
        fontStyle:     "italic",
        letterSpacing: "-0.01em",
        lineHeight:    0.95,
        color:         TEXT,
        marginBottom:  12,
      }}>
        Enter your code.
      </h1>

      <p style={{
        fontFamily:   "var(--font-body)",
        fontSize:     14,
        color:        MUTED,
        lineHeight:   1.65,
        marginBottom: 28,
      }}>
        Your 6-character access code was included in the email from House Of Sales.
      </p>

      <input
        value={code}
        onChange={e => setCode(sanitize(e.target.value))}
        onKeyDown={e => e.key === "Enter" && handleAccess()}
        maxLength={6}
        placeholder="A1B2C3"
        aria-label="Six-character access code"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        spellCheck={false}
        style={{
          ...css.inp,
          fontSize:      32,
          fontFamily:    "var(--font-mono)",
          letterSpacing: "0.2em",
          textAlign:     "center",
          padding:       "18px 14px",
          marginBottom:  16,
          textTransform: "uppercase",
        }}
      />

      <button
        onClick={handleAccess}
        disabled={code.length < 6 || loading}
        style={{
          ...css.btnP,
          width:         "100%",
          opacity:       code.length < 6 || loading ? 0.35 : 1,
          cursor:        code.length < 6 || loading ? "not-allowed" : "pointer",
          fontSize:      13,
          fontFamily:    "var(--font-ui)",
          fontWeight:    600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {loading ? (
          <>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            Verifying…
          </>
        ) : "Enter My Portal →"}
      </button>

      {/* opacity 0.5 was halving MUTED's contrast — removed so it stays AA. */}
      <p style={{ fontSize: 12, color: MUTED, marginTop: 20, textAlign: "center", fontFamily: "var(--font-body)" }}>
        Questions?{" "}
        <a href="mailto:team@hosautomations.co" style={{ color: MUTED, textDecoration: "underline", textDecorationColor: "rgba(138,138,138,0.4)" }}>
          team@hosautomations.co
        </a>
      </p>
    </div>
  );
}
