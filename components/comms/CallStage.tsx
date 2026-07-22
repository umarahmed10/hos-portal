"use client";
// Discord-style call stage.
//   • Someone is screen-sharing  → SPOTLIGHT the screen (letterboxed, never
//     cropped) with the cameras as a thumbnail strip.
//   • No screen-share (cameras / voice only) → GRID of aspect-correct 16:9 tiles,
//     centered, so a camera is never zoom-cropped into a tall container.
// Tiles: camera (cover-fill inside a true 16:9 box, so no distortion) or avatar,
// with speaking ring, name pill, mute + net badges, and a fade/scale entrance.
import { memo, useEffect, useRef } from "react";
import { Track, ConnectionQuality } from "livekit-client";
import { TEXT, MUTED, GREEN, GOLD, RED } from "@/lib/styles";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import type { CallApi } from "@/components/comms/useCall";

interface Props { call: CallApi; me: "admin" | "client"; myName: string }

interface P {
  key: string; name: string; isAdmin: boolean;
  camera: Track | null; speaking: boolean; muted: boolean;
  mirror: boolean; quality: ConnectionQuality; you?: boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Memoized so a speaking-state change on one participant never re-renders (or
// re-attaches) another participant's <video>. Props are stable while the track is.
const StreamVideo = memo(function StreamVideo({ track, fit, mirror }: { track: Track; fit: "cover" | "contain"; mirror: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay playsInline muted
      controls={false} disablePictureInPicture
      onContextMenu={e => e.preventDefault()}
      style={{
        width: "100%", height: "100%", objectFit: fit,
        transform: mirror ? "scaleX(-1)" : undefined,
        background: "#000", pointerEvents: "none", display: "block",
      }}
    />
  );
});

export function CallStage({ call, me, myName }: Props) {
  const {
    localVideoTrack, remoteVideoTrack, screenTrack, remoteScreenTrack,
    remoteSpeaking, localSpeaking, muted, peerName, remote,
    localQuality, remoteQuality,
  } = call;

  const meName = myName;
  const local: P = { key: "local", name: meName, isAdmin: me === "admin", camera: localVideoTrack, speaking: localSpeaking, muted, mirror: true, quality: localQuality, you: true };
  const remoteP: P | null = remote
    ? { key: "remote", name: peerName, isAdmin: me !== "admin", camera: remoteVideoTrack, speaking: remoteSpeaking, muted: false, mirror: false, quality: remoteQuality }
    : null;

  const screenActive = remoteScreenTrack ?? screenTrack ?? null;

  const keyframes = (
    <style>{`
      @keyframes tileIn { from { opacity: 0; transform: scale(0.965); } to { opacity: 1; transform: scale(1); } }
      @keyframes speakGlow { 0%,100% { box-shadow: 0 0 0 2px ${GREEN}, 0 0 10px 1px rgba(78,173,135,0.35); } 50% { box-shadow: 0 0 0 2px ${GREEN}, 0 0 22px 5px rgba(78,173,135,0.55); } }
      @keyframes waitPulse { 0%,100% { opacity: .45; } 50% { opacity: .9; } }
    `}</style>
  );

  // ── SPOTLIGHT (screen share) ──
  if (screenActive) {
    const isRemoteScreen = screenActive === remoteScreenTrack;
    const thumbs = [remoteP, local].filter(Boolean) as P[];
    return (
      <div style={{ flex: 1, minHeight: 0, background: "#050505", position: "relative", display: "flex", flexDirection: "column" }}>
        {keyframes}
        <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 10, animation: "tileIn 260ms ease-out" }}>
          <StreamVideo track={screenActive} fit="contain" mirror={false} />
          <div style={{
            position: "absolute", top: 16, left: 16, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.6)", padding: "5px 11px", borderRadius: 7, fontSize: 11, color: "#fff", fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED }} />
            {isRemoteScreen ? `${peerName} · screen` : "Your screen"}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "0 12px 12px", justifyContent: "center", flexWrap: "wrap" }}>
          {thumbs.map(p => <Tile key={p.key} p={p} small />)}
        </div>
      </div>
    );
  }

  // ── GRID (cameras / voice only) — aspect-correct tiles, never zoom-cropped ──
  const tiles: (P | "waiting")[] = remoteP ? [remoteP, local] : [local, "waiting"];
  const two = tiles.length >= 2;
  return (
    <div style={{
      flex: 1, minHeight: 0, background: "#0A0A0A",
      display: "flex", flexWrap: "wrap", gap: 14,
      alignItems: "center", justifyContent: "center", padding: 18, alignContent: "center",
    }}>
      {keyframes}
      {tiles.map((t, i) =>
        t === "waiting"
          ? <WaitingTile key="waiting" name={peerName} two={two} />
          : <Tile key={t.key} p={t} two={two} idx={i} />
      )}
    </div>
  );
}

function Tile({ p, small, two, idx = 0 }: { p: P; small?: boolean; two?: boolean; idx?: number }) {
  const size = small
    ? { width: 176 }
    : { flex: "1 1 320px", maxWidth: two ? "calc(50% - 14px)" : "min(94%, 1024px)", minWidth: 220 };
  return (
    <div style={{
      ...size, aspectRatio: "16 / 9", position: "relative", borderRadius: 14, overflow: "hidden",
      background: "#161616",
      border: p.speaking ? `2px solid ${GREEN}` : "2px solid rgba(255,255,255,0.05)",
      // Entrance runs ONCE (constant string → never restarts). Speaking is shown
      // via border + a smooth box-shadow glow transition — NOT by swapping the
      // animation, which used to re-play the fade-in and made the video blink.
      animation: `tileIn 300ms ease-out ${idx * 60}ms both`,
      boxShadow: p.speaking
        ? `0 0 0 1px ${GREEN}, 0 0 20px 2px rgba(78,173,135,0.35)`
        : "0 6px 26px rgba(0,0,0,0.45)",
      transition: "border-color 180ms, box-shadow 220ms",
    }}>
      {p.camera
        ? <StreamVideo track={p.camera} fit="cover" mirror={p.mirror} />
        : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at center, #1c1c1c, #101010)" }}>
            {p.isAdmin
              ? <HOSTeamAvatar size={small ? 40 : 84} />
              : <div style={{
                  width: small ? 40 : 84, height: small ? 40 : 84, borderRadius: "50%", background: "#2E2E2E", color: TEXT,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: small ? 14 : 30, fontWeight: 700, fontFamily: "var(--font-ui)",
                }}>{initials(p.name)}</div>}
          </div>
        )}
      {/* name + badges */}
      <div style={{
        position: "absolute", bottom: 8, left: 10, display: "flex", alignItems: "center", gap: 6,
        background: "rgba(0,0,0,0.5)", padding: "3px 9px", borderRadius: 7,
        fontSize: small ? 10 : 12, color: "#fff", fontWeight: 600, backdropFilter: "blur(4px)",
      }}>
        {p.muted && <MutedGlyph />}
        <span>{p.name.split(" ")[0]}{p.you ? "" : ""}</span>
        {!small && <NetBars quality={p.quality} />}
      </div>
    </div>
  );
}

function WaitingTile({ name, two }: { name: string; two?: boolean }) {
  return (
    <div style={{
      flex: "1 1 320px", maxWidth: two ? "calc(50% - 14px)" : "min(94%, 1024px)", minWidth: 220,
      aspectRatio: "16 / 9", borderRadius: 14, background: "#0E0E0E",
      border: "2px dashed rgba(243,241,236,0.12)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
      animation: "tileIn 300ms ease-out both",
    }}>
      <div style={{ animation: "waitPulse 1.6s ease-in-out infinite" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <span style={{ fontSize: 13, color: MUTED, fontFamily: "var(--font-ui)" }}>Ringing {name.split(" ")[0]}…</span>
    </div>
  );
}

export function NetBars({ quality }: { quality: ConnectionQuality }) {
  if (quality === ConnectionQuality.Unknown) return null;
  const filled = quality === ConnectionQuality.Excellent ? 3 : quality === ConnectionQuality.Good ? 2 : quality === ConnectionQuality.Poor ? 1 : 0;
  const color = quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good ? GREEN
    : quality === ConnectionQuality.Poor ? GOLD : quality === ConnectionQuality.Lost ? RED : MUTED;
  return (
    <span title={`Connection: ${quality}`} style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 11 }}>
      {[0, 1, 2].map(i => <span key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 1, background: i < filled ? color : "rgba(243,241,236,0.2)" }} />)}
    </span>
  );
}

function MutedGlyph() {
  return (
    <span style={{ display: "inline-flex", width: 15, height: 15, borderRadius: "50%", background: RED, alignItems: "center", justifyContent: "center" }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      </svg>
    </span>
  );
}
