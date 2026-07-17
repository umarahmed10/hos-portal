"use client";
import { useEffect, useRef } from "react";
import type { Track as LKTrack } from "livekit-client";
import { TEXT, GREEN, SURF_2 } from "@/lib/styles";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";

interface Props {
  track:    LKTrack | null;
  name:     string;
  isLocal:  boolean;
  speaking: boolean;
  muted:    boolean;
  isAdmin:  boolean;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function VideoTile({ track, name, isLocal, speaking, muted, isAdmin }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [track]);

  const hasVideo = track && !track.isMuted;

  return (
    <div className="comms-video-tile" style={{
      position: "relative",
      borderRadius: 10,
      overflow: "hidden",
      background: SURF_2,
      border: speaking ? `2px solid ${GREEN}` : "2px solid rgba(255,255,255,0.06)",
      animation: speaking ? "speakPulse 1s ease-in-out infinite" : undefined,
      transition: "border-color 200ms",
      minHeight: 120,
      maxHeight: "40vh",
    }}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: isLocal ? "scaleX(-1)" : undefined,
            display: "block",
          }}
        />
      ) : (
        <div style={{
          width: "100%", height: "100%", minHeight: 120,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 6,
        }}>
          {isAdmin ? (
            <HOSTeamAvatar size={48} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: "#3A3A3A", color: TEXT,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, fontFamily: "var(--font-ui)",
            }}>{initials(name)}</div>
          )}
        </div>
      )}

      {/* Name label */}
      <div style={{
        position: "absolute", bottom: 6, left: 8,
        fontSize: 10, color: "#fff", fontWeight: 600,
        fontFamily: "var(--font-ui)",
        textShadow: "0 1px 3px rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", gap: 4,
        background: "rgba(0,0,0,0.5)", padding: "2px 8px", borderRadius: 4,
      }}>
        {name.split(" ")[0]}
        {isLocal && <span style={{ opacity: 0.6 }}>(you)</span>}
      </div>

      {/* Muted indicator */}
      {muted && (
        <div style={{
          position: "absolute", bottom: 6, right: 8,
          width: 18, height: 18, borderRadius: "50%",
          background: "rgba(201,106,106,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
          </svg>
        </div>
      )}

      {!hasVideo && <video ref={videoRef} style={{ display: "none" }} />}
    </div>
  );
}
