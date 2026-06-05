"use client";
// Landing page — split entry: Client (left) + Admin (right).
// Admin side has password gate; client side is zero-friction.
import { useState }               from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast }                  from "sonner";
import { loginAdmin }             from "@/lib/api-client";
import { BODY, BORDER, FONT, GREEN, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { Loader2 }                from "@/components/shared/Icons";
import { Suspense }               from "react";

function LandingContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [panel, setPanel]       = useState<"client" | "admin">(
    searchParams?.get("mode") === "admin" ? "admin" : "client"
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    const res = await loginAdmin(password);
    setLoading(false);
    if (res.ok) {
      router.push("/admin");
    } else {
      toast.error("Incorrect password");
      setPassword("");
    }
  }

  return (
    <div style={{
      ...css.app,
      display:   "flex",
      minHeight: "100vh",
      position:  "relative",
      overflow:  "hidden",
    }}>
      {/* Subtle dot-grid background */}
      <div style={{
        position:   "absolute",
        inset:      0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      <div style={{
        width:          "100%",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "40px 24px",
        position:       "relative",
        zIndex:         1,
        minHeight:      "100vh",
      }}>

        {/* Brand badge */}
        <div style={{
          display:     "inline-flex",
          alignItems:  "center",
          gap:         8,
          padding:     "5px 14px",
          background:  SURF,
          border:      `1px solid ${BORDER}`,
          borderRadius: 100,
          marginBottom: 28,
          animation:   "fadeIn 200ms ease-out",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
          <span style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY, fontWeight: 700 }}>
            HOS AUTOMATIONS
          </span>
        </div>

        <h1
          className="landing-h1"
          style={{
            fontFamily:   FONT,
            fontSize:     72,
            fontWeight:   900,
            letterSpacing: "-1px",
            lineHeight:   0.95,
            color:        TEXT,
            marginBottom: 16,
            textAlign:    "center",
            animation:    "fadeIn 250ms ease-out",
          }}
        >
          CLIENT<br />PORTAL
        </h1>

        <p style={{
          color:        MUTED,
          fontSize:     15,
          lineHeight:   1.7,
          marginBottom: 36,
          textAlign:    "center",
          maxWidth:     300,
          animation:    "fadeIn 300ms ease-out",
        }}>
          Agreements. Invoices. Signatures.<br />
          Onboard a client in under 5 minutes.
        </p>

        {/* Tab toggle */}
        <div style={{
          display:      "flex",
          background:   SURF,
          border:       `1px solid ${BORDER}`,
          borderRadius: 9,
          padding:      4,
          marginBottom: 24,
          gap:          4,
          animation:    "fadeIn 320ms ease-out",
        }}>
          {(["client", "admin"] as const).map(p => (
            <button key={p} onClick={() => setPanel(p)} style={{
              padding:       "9px 28px",
              borderRadius:  6,
              fontSize:      12,
              fontWeight:    700,
              cursor:        "pointer",
              fontFamily:    BODY,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              border:        "none",
              transition:    "all 150ms ease",
              background:    panel === p ? TEXT              : "transparent",
              color:         panel === p ? "#0a0a0a"         : MUTED,
              minHeight:     36,
            }}>
              {p === "client" ? "I'm a Client" : "Admin"}
            </button>
          ))}
        </div>

        {/* Client panel */}
        {panel === "client" && (
          <div style={{ textAlign: "center", maxWidth: 300, width: "100%", animation: "fadeIn 180ms ease-out" }}>
            <button
              onClick={() => router.push("/client")}
              style={{ ...css.btnP, width: "100%", fontSize: 14, padding: "15px 24px" }}
            >
              ACCESS MY DOCUMENTS →
            </button>
            <p style={{ fontSize: 12, color: "#1c1c1c", marginTop: 14 }}>
              You&apos;ll need your 6-character access code from your onboarding email.
            </p>
          </div>
        )}

        {/* Admin panel — password gate */}
        {panel === "admin" && (
          <form onSubmit={handleAdminLogin} className="admin-login-form" style={{ animation: "fadeIn 180ms ease-out" }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              style={{
                ...css.inp,
                marginBottom:  12,
                textAlign:     "center",
                letterSpacing: "4px",
                padding:       "14px 20px",
              }}
            />
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                ...css.btnP,
                width:   "100%",
                opacity: loading || !password ? 0.4 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 24px",
                fontSize: 14,
              }}
            >
              {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {loading ? "VERIFYING…" : "ENTER PORTAL →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
