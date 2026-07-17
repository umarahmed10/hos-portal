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
          width: 72, height: 72, borderRadius: 36, background: GOLD,
          margin: "0 auto 20px", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 32, color: BG,
          animation: "pulse 1.4s ease-in-out infinite",
        }}>📞</div>

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
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }`}</style>
    </div>
  );
}
