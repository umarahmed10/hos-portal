"use client";
// Discord-style call stage: a big spotlight (screenshare / focused camera) with
// a thumbnail strip of participant cameras, speaking rings, name tags, mute and
// stream badges. Voice-only falls back to centered avatars with speaking rings.
import { useEffect, useRef } from "react";
import { Track, ConnectionQuality } from "livekit-client";
import { TEXT, MUTED, GREEN, GOLD, RED, BORDER } from "@/lib/styles";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import type { CallApi } from "@/components/comms/useCall";

interface Props {
  call: CallApi;
  me: "admin" | "client";
  dark?: boolean; // stage uses black bg; call bar preview uses surface
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Attaches a LiveKit track to a <video>. Local mirrored (camera only).
function StreamVideo({ track, contain, mirror }: { track: Track; contain: boolean; mirror: boolean }) {
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
        width: "100%", height: "100%",
        objectFit: contain ? "contain" : "cover",
        transform: mirror ? "scaleX(-1)" : undefined,
        background: "#000", pointerEvents: "none", display: "block",
      }}
    />
  );
}

export function CallStage({ call, me }: Props) {
  const {
    localVideoTrack, remoteVideoTrack, screenTrack, remoteScreenTrack,
    remoteSpeaking, localSpeaking, muted, peerName, remote,
    localQuality, remoteQuality,
  } = call;

  const meName = me === "admin" ? "HOS Team" : "You";
  const meIsAdmin = me === "admin";
  const peerIsAdmin = me !== "admin";

  const anyVideo = !!(localVideoTrack || remoteVideoTrack || screenTrack || remoteScreenTrack);

  // Spotlight priority: remote screen → my screen → remote camera → my camera.
  const spotlight =
    remoteScreenTrack ? { track: remoteScreenTrack, label: `${peerName} · screen`, isScreen: true, mirror: false }
    : screenTrack ? { track: screenTrack, label: "Your screen", isScreen: true, mirror: false }
    : remoteVideoTrack ? { track: remoteVideoTrack, label: peerName, isScreen: false, mirror: false }
    : localVideoTrack ? { track: localVideoTrack, label: meName, isScreen: false, mirror: true }
    : null;

  // Thumbnails = every camera + a local screen preview not already in spotlight.
  const thumbs: { key: string; track: Track | null; label: string; speaking: boolean; muted: boolean; isAdmin: boolean; mirror: boolean; isScreen?: boolean }[] = [];
  if (remoteVideoTrack && remoteVideoTrack !== spotlight?.track)
    thumbs.push({ key: "rcam", track: remoteVideoTrack, label: peerName, speaking: remoteSpeaking, muted: false, isAdmin: peerIsAdmin, mirror: false });
  if (localVideoTrack && localVideoTrack !== spotlight?.track)
    thumbs.push({ key: "lcam", track: localVideoTrack, label: meName, speaking: localSpeaking, muted, isAdmin: meIsAdmin, mirror: true });
  if (screenTrack && screenTrack !== spotlight?.track)
    thumbs.push({ key: "lscreen", track: screenTrack, label: "Your screen", speaking: false, muted: false, isAdmin: false, mirror: false, isScreen: true });
  // When a participant has no camera, still show their avatar tile in the strip.
  if (!remoteVideoTrack && remote && spotlight?.track !== remoteScreenTrack)
    thumbs.push({ key: "ravatar", track: null, label: peerName, speaking: remoteSpeaking, muted: false, isAdmin: peerIsAdmin, mirror: false });
  if (!localVideoTrack)
    thumbs.push({ key: "lavatar", track: null, label: meName, speaking: localSpeaking, muted, isAdmin: meIsAdmin, mirror: false });

  // ── Voice-only stage — centered avatars, Discord voice-channel style ──
  if (!anyVideo) {
    return (
      <div style={{
        flex: 1, minHeight: 0, background: "#0C0C0C",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap",
        padding: 24,
      }}>
        <VoiceAvatar name={meName} isAdmin={meIsAdmin} speaking={localSpeaking} muted={muted} quality={localQuality} youLabel />
        {remote
          ? <VoiceAvatar name={peerName} isAdmin={peerIsAdmin} speaking={remoteSpeaking} muted={false} quality={remoteQuality} />
          : <WaitingAvatar name={peerName} />}
      </div>
    );
  }

  // ── Video/screen stage — spotlight + thumbnail strip ──
  return (
    <div style={{ flex: 1, minHeight: 0, background: "#000", position: "relative", display: "flex", flexDirection: "column" }}>
      {/* Spotlight */}
      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {spotlight
          ? <StreamVideo track={spotlight.track} contain={spotlight.isScreen} mirror={spotlight.mirror} />
          : <div style={{ color: MUTED, fontSize: 13 }}>Waiting for video…</div>}
        {spotlight && (
          <div style={{
            position: "absolute", top: 12, left: 12, display: "flex", alignItems: "center", gap: 6,
            background: "rgba(0,0,0,0.55)", padding: "4px 10px", borderRadius: 6,
            fontSize: 11, color: "#fff", fontWeight: 600,
          }}>
            {spotlight.isScreen && <StreamDot />}
            {spotlight.label}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 0 && (
        <div style={{
          flexShrink: 0, display: "flex", gap: 8, padding: 10, justifyContent: "center",
          background: "linear-gradient(transparent, rgba(0,0,0,0.4))", flexWrap: "wrap",
        }}>
          {thumbs.map(({ key, ...t }) => (
            <Thumb key={key} {...t} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ track, label, speaking, muted, isAdmin, mirror, isScreen }: {
  track: Track | null; label: string; speaking: boolean; muted: boolean; isAdmin: boolean; mirror: boolean; isScreen?: boolean;
}) {
  return (
    <div style={{
      position: "relative", width: 168, aspectRatio: "16 / 10", borderRadius: 10, overflow: "hidden",
      background: "#161616",
      border: speaking ? `2px solid ${GREEN}` : "2px solid rgba(255,255,255,0.06)",
      boxShadow: speaking ? `0 0 0 3px rgba(78,173,135,0.25)` : "0 2px 12px rgba(0,0,0,0.5)",
      transition: "border-color 150ms, box-shadow 150ms",
    }}>
      {track
        ? <StreamVideo track={track} contain={!!isScreen} mirror={mirror} />
        : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isAdmin ? <HOSTeamAvatar size={40} /> : (
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: "#3A3A3A", color: TEXT,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, fontFamily: "var(--font-ui)",
              }}>{initials(label)}</div>
            )}
          </div>
        )}
      <div style={{
        position: "absolute", bottom: 4, left: 6, display: "flex", alignItems: "center", gap: 4,
        fontSize: 10, color: "#fff", fontWeight: 600, textShadow: "0 1px 3px rgba(0,0,0,0.8)",
      }}>
        {muted && <MutedDot />}
        {isScreen && <StreamDot />}
        {label.split(" ")[0]}
      </div>
    </div>
  );
}

function VoiceAvatar({ name, isAdmin, speaking, muted, quality, youLabel }: {
  name: string; isAdmin: boolean; speaking: boolean; muted: boolean; quality: ConnectionQuality; youLabel?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 96, height: 96, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
        border: speaking ? `3px solid ${GREEN}` : "3px solid transparent",
        boxShadow: speaking ? `0 0 0 6px rgba(78,173,135,0.18)` : "none",
        transition: "border-color 150ms, box-shadow 150ms",
      }}>
        {isAdmin ? <HOSTeamAvatar size={84} /> : (
          <div style={{
            width: 84, height: 84, borderRadius: "50%", background: "#2A2A2A", color: TEXT,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, fontFamily: "var(--font-ui)",
          }}>{initials(name)}</div>
        )}
        {muted && (
          <div style={{ position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: "50%", background: RED, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0C0C0C" }}>
            <MicOffGlyph />
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: "var(--font-ui)" }}>{name}{youLabel ? "" : ""}</span>
        <NetBars quality={quality} />
      </div>
    </div>
  );
}

function WaitingAvatar({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 96, height: 96, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "3px dashed rgba(243,241,236,0.18)", animation: "waitPulse 1.6s ease-in-out infinite",
      }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <span style={{ fontSize: 13, color: MUTED, fontFamily: "var(--font-ui)" }}>Ringing {name.split(" ")[0]}…</span>
      <style>{`@keyframes waitPulse { 0%,100% { opacity:.4 } 50% { opacity:.9 } }`}</style>
    </div>
  );
}

export function NetBars({ quality }: { quality: ConnectionQuality }) {
  if (quality === ConnectionQuality.Unknown) return null;
  const filled =
    quality === ConnectionQuality.Excellent ? 3 :
    quality === ConnectionQuality.Good ? 2 :
    quality === ConnectionQuality.Poor ? 1 : 0;
  const color =
    quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good ? GREEN :
    quality === ConnectionQuality.Poor ? GOLD :
    quality === ConnectionQuality.Lost ? RED : MUTED;
  return (
    <span title={`Connection: ${quality}`} style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 11 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 1, background: i < filled ? color : "rgba(243,241,236,0.18)" }} />
      ))}
    </span>
  );
}

function StreamDot() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: RED, fontSize: 9, fontWeight: 700 }}>
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: RED }} />
  </span>;
}
function MutedDot() {
  return <span style={{ display: "inline-flex", width: 14, height: 14, borderRadius: "50%", background: RED, alignItems: "center", justifyContent: "center" }}>
    <MicOffGlyph small />
  </span>;
}
function MicOffGlyph({ small }: { small?: boolean }) {
  const s = small ? 8 : 12;
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
    <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
  </svg>;
}

export { BORDER };
