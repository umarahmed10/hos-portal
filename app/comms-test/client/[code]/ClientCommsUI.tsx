"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Room } from "livekit-client";
import { CallPanel }          from "@/components/comms/CallPanel";
import { ChatPanel }          from "@/components/comms/ChatPanel";
import { IncomingCallModal }  from "@/components/comms/IncomingCallModal";
import { usePushSubscription, type PushState } from "@/lib/comms/usePushSubscription";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN } from "@/lib/styles";

interface Props {
  code:           string;
  clientName:     string;
  vapidPublicKey: string;
}

type SessionState = "checking" | "unauth" | "ready";

export function ClientCommsUI({ code, clientName, vapidPublicKey }: Props) {
  const search = useSearchParams();
  const [session, setSession] = useState<SessionState>("checking");
  const [incoming, setIncoming] = useState<{ caller: string; expiresAt: number } | null>(null);
  const [inCall, setInCall] = useState(false);
  const [lkRoom, setLkRoom] = useState<Room | null>(null);

  // ── Establish portal session (uses code as credential for the test module) ──
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

  // ── In-page ring: if URL has ?join=<code>, show accept prompt / auto-join ──
  useEffect(() => {
    if (session !== "ready") return;
    const join = search.get("join");
    if (join && join.toUpperCase() === code) {
      setIncoming({ caller: "HOS Team", expiresAt: Date.now() + 20_000 });
    }
  }, [search, session, code]);

  if (session === "checking") {
    return <Full>Verifying access…</Full>;
  }
  if (session === "unauth") {
    return <Full>Access denied for code <code style={{ fontFamily: "var(--font-mono)" }}>{code}</code>.</Full>;
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, padding: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          HOS · Direct Line
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: 34, margin: "0 0 6px" }}>
          Hi {clientName.split(" ")[0]}.
        </h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
          Call or message the team any time — free, no phone charges.
        </p>

        <PushBanner state={pushState} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <CallPanel code={code} me="client" autoJoin={inCall} onLeave={() => setInCall(false)} onRoom={setLkRoom} />
          <ChatPanel code={code} me="client" myName={clientName} peerName="HOS Team" room={lkRoom} />
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: MUTED, textAlign: "center", opacity: 0.6 }}>
          For the best experience, add this page to your home screen (Share → Add to Home Screen on iPhone).
        </div>
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

function Full({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: BG, color: TEXT, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-body)", fontSize: 14, padding: 24, textAlign: "center",
    }}>{children}</div>
  );
}

function PushBanner({ state }: { state: "idle" | "subscribed" | "denied" | "unsupported" }) {
  if (state === "subscribed") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8, fontSize: 12,
        background: "rgba(78,173,135,0.09)", border: `1px solid rgba(78,173,135,0.22)`, color: GREEN,
      }}>✓ Notifications on — you&apos;ll ring when the team calls.</div>
    );
  }
  if (state === "denied") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8, fontSize: 12,
        background: "rgba(201,106,106,0.10)", border: `1px solid rgba(201,106,106,0.3)`, color: "#C96A6A",
      }}>Notifications are blocked. Enable them in your browser settings to receive calls.</div>
    );
  }
  if (state === "unsupported") {
    return (
      <div style={{
        padding: "10px 14px", borderRadius: 8, fontSize: 12,
        background: SURF, border: `1px solid ${BORDER}`, color: MUTED,
      }}>This browser can&apos;t receive incoming call notifications. Keep this tab open.</div>
    );
  }
  return (
    <div style={{
      padding: "10px 14px", borderRadius: 8, fontSize: 12,
      background: "rgba(139,107,62,0.09)", border: `1px solid rgba(139,107,62,0.22)`, color: GOLD,
    }}>Setting up notifications…</div>
  );
}

