"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CommsWorkspace }     from "@/components/comms/CommsWorkspace";
import { IncomingCallModal }  from "@/components/comms/IncomingCallModal";
import { HOSTeamAvatar }      from "@/components/comms/HOSTeamAvatar";
import { usePushSubscription, type PushState } from "@/lib/comms/usePushSubscription";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN } from "@/lib/styles";

interface Props {
  code:           string;
  clientName:     string;
  slug?:          string | null;
  vapidPublicKey: string;
}

type SessionState = "checking" | "unauth" | "ready";

export function ClientCommsUI({ code, clientName, slug, vapidPublicKey }: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const [session, setSession] = useState<SessionState>("checking");
  const [incoming, setIncoming] = useState<{ caller: string; expiresAt: number } | null>(null);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/portal-session", {
        method: "POST", headers: { "content-type": "application/json" },
        body:   JSON.stringify({ code }),
      });
      const j = await res.json();
      if (cancelled) return;
      setSession(j.ok ? "ready" : "unauth");
    })();
    return () => { cancelled = true; };
  }, [code]);

  const onIncoming = useCallback((call: { caller: string; expiresAt: number }) => {
    setIncoming(call);
  }, []);

  const onJoinCall = useCallback(() => {
    setInCall(true);
    setIncoming(null);
  }, []);

  const pushState: PushState = usePushSubscription({
    code,
    vapidPublicKey,
    ready: session === "ready",
    onIncoming,
    onJoinCall,
  });

  useEffect(() => {
    if (session !== "ready") return;
    const join = search.get("join");
    if (join && join.toUpperCase() === code) {
      setIncoming({ caller: "HOS Team", expiresAt: Date.now() + 20_000 });
    }
  }, [search, session, code]);

  if (session === "checking") {
    return (
      <div style={{
        background: BG, color: TEXT, minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 14,
      }}>
        <div style={{ position: "relative", width: 48, height: 48 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(243,241,236,0.08)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none" stroke={GOLD} strokeWidth="3"
              strokeDasharray="100" strokeDashoffset="75" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: 13, color: MUTED, fontFamily: "var(--font-body)" }}>Verifying access…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (session === "unauth") {
    return (
      <div style={{
        background: BG, color: TEXT, minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-body)", fontSize: 14, padding: 24, textAlign: "center",
      }}>Access denied for code <code style={{ fontFamily: "var(--font-mono)" }}>{code}</code>.</div>
    );
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, display: "flex", flexDirection: "column" }}>
      {/* Top bar — Discord-style header */}
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", gap: 10,
        background: SURF, flexShrink: 0,
      }}>
        <button
          onClick={() => {
            // Use the real portal slug (NOT the access code — they differ).
            // Fall back to browser history if this client has no slug yet.
            if (slug) router.push(`/portal/${slug}`);
            else router.back();
          }}
          aria-label="Back to portal"
          title="Back to portal"
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: "rgba(243,241,236,0.06)", border: `1px solid ${BORDER}`,
            color: MUTED, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 120ms ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(243,241,236,0.12)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(243,241,236,0.06)"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <HOSTeamAvatar size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: "var(--font-ui)" }}>HOS Team</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>Direct Line</div>
        </div>
        <PushDot state={pushState} />
      </div>

      {/* Discord-style comms workspace — call stage + chat rail */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <CommsWorkspace
          code={code}
          me="client"
          myName={clientName}
          peerName="HOS Team"
          autoJoin={inCall}
          onLeave={() => setInCall(false)}
        />
      </div>

      {incoming && !inCall && (
        <IncomingCallModal
          callerName={incoming.caller}
          expiresAt={incoming.expiresAt}
          onAccept={() => { setInCall(true); setIncoming(null); }}
          onDecline={() => setIncoming(null)}
        />
      )}
    </div>
  );
}

function PushDot({ state }: { state: PushState }) {
  if (state === "subscribed") {
    return (
      <div title="Notifications active" style={{
        width: 8, height: 8, borderRadius: "50%", background: GREEN, flexShrink: 0,
      }} />
    );
  }
  if (state === "denied") {
    return (
      <div title="Notifications blocked" style={{
        width: 8, height: 8, borderRadius: "50%", background: "#C96A6A", flexShrink: 0,
      }} />
    );
  }
  return null;
}
