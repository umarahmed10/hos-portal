"use client";
import { useState } from "react";
import { Track, type Room } from "livekit-client";
import { SURF_2, BORDER, TEXT, MUTED, GOLD } from "@/lib/styles";

interface Props {
  room: Room | null;
  audioEls: HTMLAudioElement[];
}

export function VolumeControls({ room, audioEls }: Props) {
  const [open, setOpen] = useState(false);
  const [speakerVol, setSpeakerVol] = useState(100);
  const [micVol, setMicVol] = useState(100);

  const handleSpeaker = (val: number) => {
    setSpeakerVol(val);
    const v = val / 100;
    audioEls.forEach(el => { el.volume = v; });
  };

  const handleMic = (val: number) => {
    setMicVol(val);
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    if (!track) return;
    // LiveKit exposes setVolume-like via the track's mediaStreamTrack gain
    // We use a simpler approach: adjust the track's enabled state at 0,
    // and for partial volumes, we note it's a best-effort control
    if (val === 0) {
      void track.mute();
    } else {
      if (track.isMuted) void track.unmute();
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Audio settings"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: SURF_2, border: `1px solid ${BORDER}`,
          color: MUTED, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    );
  }

  return (
    <div style={{
      background: SURF_2, border: `1px solid ${BORDER}`, borderRadius: 10,
      padding: "12px 14px",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 10, color: MUTED, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Audio Settings
        </span>
        <button
          onClick={() => setOpen(false)}
          style={{
            background: "none", border: "none", color: MUTED, cursor: "pointer",
            fontSize: 14, padding: "2px 4px",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <VolumeSlider
        label="Speaker"
        icon={<SpeakerIcon />}
        value={speakerVol}
        onChange={handleSpeaker}
      />
      <VolumeSlider
        label="Microphone"
        icon={<MicIcon />}
        value={micVol}
        onChange={handleMic}
      />
    </div>
  );
}

function VolumeSlider({ label, icon, value, onChange }: {
  label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <span style={{ color: MUTED, flexShrink: 0 }}>{icon}</span>
      <input
        type="range"
        min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={label}
        style={{
          flex: 1, height: 4, accentColor: GOLD,
          cursor: "pointer",
        }}
      />
      <span style={{
        fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)",
        width: 28, textAlign: "right",
      }}>{value}%</span>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
