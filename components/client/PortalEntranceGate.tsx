"use client";
// Shows the "You're in." celebration only on a client's FIRST entry (per device).
// On every subsequent visit it silently establishes the portal session and
// forwards straight to the portal — no repeated celebration screen.
import { useEffect, useRef, useState } from "react";
import { SignedPortalEntrance } from "@/components/client/SignedPortalEntrance";
import { BODY, BORDER, MUTED, css } from "@/lib/styles";
import type { Doc } from "@/types";

export function PortalEntranceGate({ doc }: { doc: Doc }) {
  // null = deciding, true = show celebration, false = auto-entering (loader)
  const [showCelebration, setShowCelebration] = useState<boolean | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const key = `hos_entered_${doc.code}`;
    let seen = false;
    try { seen = !!localStorage.getItem(key); } catch { /* private mode */ }

    if (!seen) {
      // First entry on this device — mark it and celebrate.
      try { localStorage.setItem(key, Date.now().toString()); } catch { /* ignore */ }
      setShowCelebration(true);
      return;
    }

    // Returning visitor — establish session and forward to the portal silently.
    setShowCelebration(false);
    (async () => {
      try {
        const res = await fetch("/api/portal-session", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ slug: doc.slug ?? undefined, code: doc.code }),
        });
        const json = await res.json();
        if (json.ok && json.data?.slug) {
          window.location.replace(`/portal/${json.data.slug}/status`);
          return;
        }
      } catch { /* fall through */ }
      if (doc.slug) {
        window.location.replace(`/portal/${doc.slug}/status`);
      } else {
        // No slug to forward to — fall back to the celebration screen.
        setShowCelebration(true);
      }
    })();
  }, [doc]);

  if (showCelebration) return <SignedPortalEntrance doc={doc} />;

  // Deciding or auto-entering — minimal branded loader (no celebration flash).
  return (
    <div style={{ ...css.app, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <div style={{
            width: 18, height: 18,
            border: "2px solid rgba(139,107,62,0.2)", borderTop: "2px solid #8B6B3E",
            borderRadius: "50%", animation: "spin 1s linear infinite",
          }} />
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: MUTED, letterSpacing: "0.04em" }}>
          Opening your portal…
        </div>
      </div>
    </div>
  );
}
