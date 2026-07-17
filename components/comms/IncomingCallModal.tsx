"use client";
import { useEffect, useState } from "react";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { playRingtone } from "@/lib/comms/sounds";

interface Props {
  callerName: string;
  onAccept:   () => void;
  onDecline:  () => void;
  expiresAt?: number;
}

export function IncomingCallModal({ callerName, onAccept, onDecline, expiresAt }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const stopRing = playRingtone();

    const VIBRATE_PATTERN = [400, 200, 400, 200, 400, 200, 800];
    let stopped = false;
    const buzz = () => {
      if (stopped) return;
      navigator.vibrate?.(VIBRATE_PATTERN);
    };
    buzz();
    const vibrateInterval = setInterval(buzz, 2400);

    return () => {
      stopped = true;
      stopRing();
      clearInterval(vibrateInterval);
      navigator.vibrate?.(0);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    if (Date.now() >= expiresAt) onDecline();
  }, [now, expiresAt, onDecline]);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, backdropFilter: "blur(8px)",
    }}>
      <div style={{
        background: SURF, border: `1px solid ${BORDER}`, borderRadius: 16,
        padding: 36, minWidth: 320, textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: `radial-gradient(circle, ${GOLD} 0%, rgba(139,107,62,0.7) 100%)`,
          margin: "0 auto 20px", display: "flex", alignItems: "center",
          justifyContent: "center", color: BG,
          animation: "pulse 1.4s ease-in-out infinite",
          boxShadow: `0 0 0 0 rgba(139,107,62,0.4)`,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={BG} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
          </svg>
        </div>

        <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
          Incoming call
        </div>
        <div style={{ fontSize: 22, color: TEXT, fontWeight: 600, marginBottom: 28 }}>
          {callerName}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={onDecline} style={{
            padding: "14px 28px", borderRadius: 10, background: RED, color: "#fff",
            border: "none", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>Decline</button>
          <button onClick={onAccept} style={{
            padding: "14px 28px", borderRadius: 10, background: GREEN, color: "#fff",
            border: "none", fontWeight: 700, cursor: "pointer", fontSize: 14,
          }}>Accept</button>
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139,107,62,0.5); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 16px rgba(139,107,62,0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(139,107,62,0); }
        }
      `}</style>
    </div>
  );
}
