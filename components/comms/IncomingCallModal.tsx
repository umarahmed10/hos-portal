"use client";
import { useEffect, useRef, useState } from "react";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { playRingtone } from "@/lib/comms/sounds";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";

interface Props {
  callerName: string;
  onAccept:   () => void;
  onDecline:  () => void;
  expiresAt?: number;
}

export function IncomingCallModal({ callerName, onAccept, onDecline, expiresAt }: Props) {
  const [now, setNow] = useState(Date.now());
  const stopRingRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    stopRingRef.current = playRingtone();

    // Fallback: use an oscillating Audio element for browsers that block AudioContext
    // This creates a subtle beep pattern as backup
    try {
      const oscillatorUrl = createRingtoneDataUrl();
      const audio = new Audio(oscillatorUrl);
      audio.loop = true;
      audio.volume = 0.3;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch { /* fallback not available */ }

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
      stopRingRef.current?.();
      clearInterval(vibrateInterval);
      navigator.vibrate?.(0);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    if (Date.now() >= expiresAt) onDecline();
  }, [now, expiresAt, onDecline]);

  const remaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, backdropFilter: "blur(12px)",
    }}>
      <div style={{
        background: SURF, border: `1px solid ${BORDER}`, borderRadius: 20,
        padding: "40px 36px 32px", minWidth: 300, maxWidth: 360, textAlign: "center",
      }}>
        {/* Pulsing avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          margin: "0 auto 20px",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "ringPulse 1.4s ease-in-out infinite",
          background: "rgba(139,107,62,0.08)",
          border: `2px solid rgba(139,107,62,0.3)`,
        }}>
          <HOSTeamAvatar size={56} />
        </div>

        <div style={{
          fontSize: 10, color: GOLD, letterSpacing: "0.2em", textTransform: "uppercase",
          marginBottom: 8, fontFamily: "var(--font-mono)", fontWeight: 500,
        }}>
          Incoming call
        </div>
        <div style={{
          fontSize: 22, color: TEXT, fontWeight: 600, marginBottom: 6,
          fontFamily: "var(--font-ui)",
        }}>
          {callerName}
        </div>
        {remaining !== null && remaining > 0 && (
          <div style={{
            fontSize: 11, color: MUTED, marginBottom: 24, fontFamily: "var(--font-mono)",
          }}>
            {remaining}s remaining
          </div>
        )}
        {(remaining === null || remaining <= 0) && <div style={{ marginBottom: 24 }} />}

        <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
          <button onClick={onDecline} style={{
            width: 56, height: 56, borderRadius: "50%",
            background: RED, color: "#fff",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 100ms",
          }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.93)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>
          <button onClick={onAccept} style={{
            width: 56, height: 56, borderRadius: "50%",
            background: GREEN, color: "#fff",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 100ms",
            animation: "acceptBounce 2s ease-in-out infinite",
          }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.93)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", gap: 40, justifyContent: "center", marginTop: 10 }}>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-ui)" }}>Decline</span>
          <span style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-ui)" }}>Accept</span>
        </div>
      </div>
      <style>{`
        @keyframes ringPulse {
          0% { box-shadow: 0 0 0 0 rgba(139,107,62,0.4); }
          50% { box-shadow: 0 0 0 20px rgba(139,107,62,0); }
          100% { box-shadow: 0 0 0 0 rgba(139,107,62,0); }
        }
        @keyframes acceptBounce {
          0%, 80%, 100% { transform: scale(1); }
          90% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

function createRingtoneDataUrl(): string {
  const sampleRate = 8000;
  const duration = 2.0;
  const samples = sampleRate * duration;
  const buffer = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    // Two-tone pattern: 440Hz + 480Hz (classic ring), with on/off pattern
    const on = (t % 1.0) < 0.5;
    if (on) {
      buffer[i] = 0.15 * (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 480 * t));
    } else {
      buffer[i] = 0;
    }
  }

  // Encode as WAV
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples * blockAlign;
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wav);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    view.setInt16(headerSize + i * 2, s * 0x7FFF, true);
  }

  const blob = new Blob([wav], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}
