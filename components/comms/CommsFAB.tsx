"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BORDER, GOLD, BG, TEXT, GOLD_BORDER, GREEN } from "@/lib/styles";

export function CommsFAB({ code }: { code: string }) {
  const [unread, setUnread] = useState(0);
  const [callActive, setCallActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/comms/unread?code=${code}&asRole=client`);
        const j = await res.json();
        if (!cancelled && j.ok) setUnread(j.data.count);
      } catch { /* best-effort */ }
    };
    void poll();
    const t = setInterval(poll, 30_000);

    // Listen for call overlay state changes
    const onCallState = (e: Event) => {
      setCallActive((e as CustomEvent).detail?.active ?? false);
    };
    window.addEventListener("comms-call-state", onCallState);

    return () => { cancelled = true; clearInterval(t); window.removeEventListener("comms-call-state", onCallState); };
  }, [code]);

  return (
    <Link
      href={`/comms-test/client/${code}`}
      aria-label="Call or message the HOS team"
      style={{
        position: "fixed", bottom: 24, right: 88,
        height: 52, borderRadius: 26, padding: "0 20px 0 16px",
        background: BG, color: GOLD,
        border: `1px solid ${GOLD_BORDER}`,
        cursor: "pointer", zIndex: 200,
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        textDecoration: "none",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>Call or message</span>
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -5, right: -5,
          minWidth: 20, height: 20, borderRadius: 10,
          background: GOLD, color: BG,
          fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 5px",
          fontFamily: "var(--font-mono)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
      {callActive && (
        <span style={{
          position: "absolute", bottom: -2, left: -2,
          width: 12, height: 12, borderRadius: "50%",
          background: GREEN,
          boxShadow: `0 0 6px ${GREEN}`,
          animation: "fabPulse 1.5s ease-in-out infinite",
        }} />
      )}
      <style>{`@keyframes fabPulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
    </Link>
  );
}
