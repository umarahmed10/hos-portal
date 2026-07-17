"use client";
import { useState }               from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast }                  from "sonner";
import { loginAdmin }             from "@/lib/api-client";
import { BODY, BORDER, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { Loader2 }                from "@/components/shared/Icons";
import { HOSLogo }                from "@/components/shared/HOSLogo";
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
      display:        "flex",
      minHeight:      "100vh",
      position:       "relative",
      overflow:       "hidden",
    }}>
      {/* Atmospheric glow */}
      <div style={{
        position:      "fixed",
        inset:         0,
        pointerEvents: "none",
        background:    `
          radial-gradient(ellipse 60% 40% at 50% 0%, rgba(139,107,62,0.07) 0%, transparent 60%),
          radial-gradient(ellipse 40% 60% at 50% 100%, rgba(17,17,17,0.8) 0%, transparent 70%)
        `,
        zIndex:        0,
      }} />

      <div style={{
        width:          "100%",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "48px 24px",
        position:       "relative",
        zIndex:         1,
        minHeight:      "100vh",
      }}>

        {/* Brand mark */}
        <div style={{ marginBottom: 40, animation: "scaleIn 300ms var(--ease-spring) both" }}>
          <HOSLogo size={40} theme="dark" showTagline />
        </div>

        {/* Bronze mono label above heading */}
        <div style={{
          fontFamily:    "var(--font-mono)",
          fontSize:      10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color:         "rgba(139,107,62,0.5)",
          marginBottom:  20,
          animation:     "fadeUp 320ms var(--ease-out) 100ms both",
        }}>
          HOS
        </div>

        {/* Hero */}
        <h1
          className="landing-h1"
          style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "clamp(48px, 8vw, 96px)",
            fontWeight:    300,
            fontStyle:     "italic",
            letterSpacing: "-0.01em",
            lineHeight:    0.95,
            color:         TEXT,
            marginBottom:  16,
            textAlign:     "center",
            animation:     "fadeUp 360ms var(--ease-out) 180ms both",
          }}
        >
          Client Portal
        </h1>

        <p style={{
          fontFamily:   "var(--font-body)",
          fontSize:     15,
          color:        MUTED,
          lineHeight:   1.6,
          marginBottom: 44,
          textAlign:    "center",
          maxWidth:     280,
          animation:    "fadeUp 360ms var(--ease-out) 260ms both",
        }}>
          Review. Sign. Activate.
        </p>

        {/* Tab toggle — sliding underline indicator */}
        <div
          className="landing-tab-toggle"
          style={{
            display:      "flex",
            gap:          0,
            position:     "relative",
            borderBottom: "1px solid rgba(243,241,236,0.08)",
            marginBottom: 32,
            width:        "100%",
            maxWidth:     320,
            animation:    "fadeUp 360ms var(--ease-out) 360ms both",
          }}
        >
          {/* Sliding indicator */}
          <div style={{
            position:     "absolute",
            bottom:       -1,
            left:         panel === "client" ? "0%" : "50%",
            width:        "50%",
            height:       2,
            background:   "#8B6B3E",
            borderRadius: 1,
            transition:   "left 220ms var(--ease-out)",
          }} />
          {(["client", "admin"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              style={{
                flex:          1,
                padding:       "10px 24px",
                background:    "transparent",
                border:        "none",
                borderBottom:  "none",
                color:         panel === p ? TEXT : MUTED,
                fontFamily:    "var(--font-mono)",
                fontSize:      10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor:        "pointer",
                transition:    "color 200ms ease",
                minHeight:     40,
              }}
            >
              {p === "client" ? "Client Access" : "Admin"}
            </button>
          ))}
        </div>

        {/* Client panel */}
        {panel === "client" && (
          <div style={{ textAlign: "center", maxWidth: 320, width: "100%", animation: "fadeUp 280ms var(--ease-out) 440ms both" }}>
            <button
              onClick={() => router.push("/client")}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              onMouseDown={e  => { e.currentTarget.style.transform = "scale(0.97)"; }}
              onMouseUp={e    => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              style={{
                ...css.btnP,
                width:         "100%",
                fontSize:      13,
                fontFamily:    "var(--font-ui)",
                fontWeight:    600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                transition:    "opacity 150ms, transform 150ms, box-shadow 150ms",
              }}
            >
              Enter My Portal →
            </button>
            <p style={{ fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 1.6, fontFamily: "var(--font-body)", opacity: 0.6 }}>
              You&apos;ll need the access code from your onboarding email.
            </p>
          </div>
        )}

        {/* Admin panel */}
        {panel === "admin" && (
          <form onSubmit={handleAdminLogin} className="admin-login-form" style={{ animation: "fadeInFast 200ms var(--ease-out) both", width: "100%", maxWidth: 320 }}>
            <label style={{ ...css.lbl, textAlign: "center", display: "block", marginBottom: 10 }}>
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
              style={{
                ...css.inp,
                marginBottom:  14,
                textAlign:     "center",
                letterSpacing: "8px",
                padding:       "16px 20px",
                fontSize:      18,
              }}
            />
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                ...css.btnP,
                width:   "100%",
                opacity: loading || !password ? 0.4 : 1,
                padding: "14px 24px",
                fontSize: 15,
              }}
            >
              {loading && <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />}
              {loading ? "Verifying…" : "Enter →"}
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, textAlign: "center" }}>
          <p style={{ fontSize: 9, color: "#404040", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
            HOS · House Of Sales
          </p>
        </div>
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
