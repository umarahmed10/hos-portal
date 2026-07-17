"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, VideoPresets, LocalAudioTrack, RemoteParticipant, type Participant, type RemoteTrackPublication } from "livekit-client";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { postJSON } from "@/lib/comms/http";
import { playJoin, playLeave, playConnected, playDisconnected, playScreenShare, playScreenShareEnd, playMuteToggle } from "@/lib/comms/sounds";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import { VolumeControls } from "@/components/comms/VolumeControls";
import { VideoTile } from "@/components/comms/VideoTile";

interface TokenData { token: string; url: string; room: string; identity: string; peerName?: string }

interface Props {
  code:      string;
  me:        "admin" | "client";
  autoJoin?: boolean;
  onLeave?:  () => void;
  onRoom?:   (room: Room | null) => void;
}

type ConnState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const SOLO_TIMEOUT_MS = 180_000; // 3 minutes alone = auto-disconnect

export function CallPanel({ code, me, autoJoin, onLeave, onRoom }: Props) {
  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<HTMLAudioElement[]>([]);
  const [state, setState]           = useState<ConnState>("idle");
  const [error, setError]           = useState<string | null>(null);
  const [muted, setMuted]           = useState(false);
  const [cameraOn, setCameraOn]     = useState(false);
  const [screenOn, setScreenOn]     = useState(false);
  const [remote, setRemote]         = useState<string | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [peerName, setPeerName]     = useState<string>(me === "admin" ? "them" : "HOS Team");
  const [elapsedMs, setElapsedMs]   = useState(0);
  const [remoteJoinedAt, setRemoteJoinedAt] = useState<number | null>(null);
  const startAtRef = useRef<number>(0);
  const talkStartRef  = useRef<number | null>(null);
  const endEmittedRef = useRef<boolean>(false);
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [events, setEvents] = useState<{ id: string; text: string; type: "join" | "leave" | "info" }[]>([]);

  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);
  const [screenTrack, setScreenTrack] = useState<Track | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (autoJoin) void connect();
    return () => { disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, code]);

  useEffect(() => {
    if (state !== "connected") return;
    const t = setInterval(() => setElapsedMs(Date.now() - startAtRef.current), 1000);
    return () => clearInterval(t);
  }, [state]);

  // Auto-disconnect if alone for >3 minutes
  useEffect(() => {
    if (soloTimerRef.current) { clearTimeout(soloTimerRef.current); soloTimerRef.current = null; }
    if (state === "connected" && !remote) {
      soloTimerRef.current = setTimeout(() => {
        addEvent("Auto-disconnected — no one joined", "info");
        disconnect();
      }, SOLO_TIMEOUT_MS);
    }
    return () => { if (soloTimerRef.current) clearTimeout(soloTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, remote]);

  function addEvent(text: string, type: "join" | "leave" | "info") {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEvents(prev => [...prev.slice(-4), { id, text, type }]);
  }

  async function connect() {
    setState("connecting");
    setError(null);
    setEvents([]);
    talkStartRef.current  = null;
    endEmittedRef.current = false;
    try {
      const data = await postJSON<TokenData>("/api/comms/token", { code, asRole: me });
      if (data.peerName) setPeerName(data.peerName);

      const room = new Room({
        // adaptiveStream downscales based on the on-screen tile size — good for
        // bandwidth but it makes small tiles look soft. dynacast pauses layers
        // nobody is viewing. We keep both but publish a high-quality top layer
        // and capture at 720p so a large/fullscreen view is crisp.
        adaptiveStream: true,
        dynacast:       true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        publishDefaults: {
          // Three simulcast layers so the receiver can request full quality
          // when the tile is large, and drop cleanly when it's small.
          videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
          videoCodec: "vp8",
          dtx:        true,  // discontinuous transmission — silence uses ~0 bandwidth
          red:        true,  // redundant audio for packet-loss resilience
          screenShareEncoding: {
            maxBitrate:   3_000_000,
            maxFramerate: 15,
          },
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        setRemote(p.identity);
        setRemoteJoinedAt(Date.now());
        if (talkStartRef.current === null) talkStartRef.current = Date.now();
        const name = p.name || p.identity;
        addEvent(`${name} joined`, "join");
        playJoin();
      });
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        setRemote(null);
        setRemoteJoinedAt(null);
        setRemoteSpeaking(false);
        setRemoteVideoTrack(null);
        const name = p.name || p.identity;
        addEvent(`${name} left`, "leave");
        playLeave();
      });
      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = "none";
          audioElsRef.current.push(el);
          document.body.appendChild(el);
        }
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) {
            setRemoteScreenTrack(track);
          } else {
            setRemoteVideoTrack(track);
          }
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, pub: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) {
            setRemoteScreenTrack(prev => prev === track ? null : prev);
          } else {
            setRemoteVideoTrack(prev => prev === track ? null : prev);
          }
        }
      });
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setRemoteSpeaking(speakers.some(s => s !== room.localParticipant));
      });
      room.on(RoomEvent.Reconnecting, () => {
        setState("reconnecting");
        addEvent("Reconnecting…", "info");
      });
      room.on(RoomEvent.Reconnected, () => {
        setState("connected");
        addEvent("Reconnected", "info");
      });
      room.on(RoomEvent.Disconnected, () => {
        emitEnded();
        detachAudio();
        setState("idle");
        setRemoteSpeaking(false);
        setCameraOn(false);
        setScreenOn(false);
        setLocalVideoTrack(null);
        setRemoteVideoTrack(null);
        setScreenTrack(null);
        setRemoteScreenTrack(null);
        playDisconnected();
        onLeave?.();
      });

      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      const existing = Array.from(room.remoteParticipants.values())[0];
      if (existing) {
        setRemote(existing.identity);
        setRemoteJoinedAt(Date.now());
        if (talkStartRef.current === null) talkStartRef.current = Date.now();
        const name = existing.name || existing.identity;
        addEvent(`${name} is here`, "join");
        existing.videoTrackPublications.forEach((pub: RemoteTrackPublication) => {
          if (pub.track && pub.track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(pub.track);
          }
        });
      }

      startAtRef.current = Date.now();
      setState("connected");
      addEvent("You connected", "join");
      playConnected();
      onRoom?.(room);
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  function detachAudio() {
    audioElsRef.current.forEach(el => el.remove());
    audioElsRef.current = [];
  }

  function emitEnded() {
    if (me !== "admin") return;
    if (endEmittedRef.current || talkStartRef.current === null) return;
    endEmittedRef.current = true;
    const durationSec = Math.max(0, Math.round((Date.now() - talkStartRef.current) / 1000));
    void postJSON("/api/comms/call-event", { code, asRole: me, event: "ended", durationSec })
      .catch(() => {});
  }

  function disconnect() {
    const room = roomRef.current;
    if (!room) return;
    emitEnded();
    room.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => pub.track?.detach());
      p.videoTrackPublications.forEach(pub => pub.track?.detach());
    });
    detachAudio();
    room.disconnect();
    roomRef.current = null;
    onRoom?.(null);
    setRemote(null);
    setRemoteJoinedAt(null);
    setRemoteSpeaking(false);
    setCameraOn(false);
    setScreenOn(false);
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
    setScreenTrack(null);
    setRemoteScreenTrack(null);
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track as LocalAudioTrack | undefined;
    if (!track) return;
    playMuteToggle();
    if (muted) { await track.unmute(); setMuted(false); }
    else       { await track.mute();   setMuted(true);  }
  }

  async function toggleCamera() {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
    if (next) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setLocalVideoTrack(pub?.track ?? null);
    } else {
      setLocalVideoTrack(null);
    }
  }

  async function toggleScreenShare() {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next, {
        resolution:  VideoPresets.h1080.resolution,
        contentHint: "detail", // prioritize sharpness over motion for docs/dashboards
      });
      setScreenOn(next);
      if (next) {
        playScreenShare();
        const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        setScreenTrack(pub?.track ?? null);
      } else {
        playScreenShareEnd();
        setScreenTrack(null);
      }
    } catch {
      setScreenOn(false);
      setScreenTrack(null);
    }
  }

  const talkStart = remoteJoinedAt ?? startAtRef.current;
  const seconds   = state === "connected" && (elapsedMs || talkStart)
    ? Math.max(0, Math.floor((Date.now() - talkStart) / 1000))
    : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const inCall = state === "connected" || state === "reconnecting";
  // Local screen share is intentionally NOT rendered as a tile — echoing your
  // own screen (which contains this call) creates an infinite hall-of-mirrors.
  // We show a "You're sharing" badge instead, like Discord. Only the remote
  // side sees your shared screen as a full tile.
  const cameraTiles = [remoteVideoTrack, localVideoTrack].filter(Boolean).length;
  const hasVideo = !!(localVideoTrack || remoteVideoTrack || remoteScreenTrack);

  // Idle state — Discord-style voice channel entry
  if (!inCall && state !== "connecting") {
    return (
      <div style={{
        background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
        color: TEXT, overflow: "hidden",
      }}>
        <button
          onClick={connect}
          style={{
            width: "100%", padding: "14px 20px",
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
            color: TEXT, transition: "background 120ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(78,173,135,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "rgba(78,173,135,0.12)", color: GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {state === "error" ? "Try again" : "Voice Channel"}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>Click to connect</div>
          </div>
          <div style={{
            marginLeft: "auto", fontSize: 10, color: GREEN, fontFamily: "var(--font-mono)",
            letterSpacing: "0.06em", fontWeight: 600,
          }}>JOIN</div>
        </button>
        {error && <div style={{ fontSize: 12, color: RED, padding: "0 20px 12px" }}>{error}</div>}
      </div>
    );
  }

  // Connecting state — loading
  if (state === "connecting") {
    return (
      <div style={{
        background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
        color: TEXT, overflow: "hidden", padding: "20px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
      }}>
        <div style={{ position: "relative", width: 40, height: 40 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" style={{ animation: "spin 1s linear infinite" }}>
            <circle cx="20" cy="20" r="16" fill="none" stroke={BORDER} strokeWidth="3" />
            <circle cx="20" cy="20" r="16" fill="none" stroke={GREEN} strokeWidth="3"
              strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Connecting…</div>
        <div style={{ fontSize: 11, color: MUTED }}>Setting up voice channel</div>
      </div>
    );
  }

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      color: TEXT, overflow: "hidden",
    }}>
      {/* Compact status bar */}
      <div style={{
        padding: "10px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: state === "reconnecting" ? GOLD : GREEN,
            animation: state === "reconnecting" ? "pulse 1s infinite" : undefined,
          }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            {state === "reconnecting" ? "Reconnecting…" : (
              remote
                ? (remoteSpeaking ? `${peerName} speaking` : `With ${peerName}`)
                : `Waiting for ${peerName}…`
            )}
          </span>
        </div>
        <span style={{
          fontSize: 14, fontWeight: 600,
          fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
          color: MUTED,
        }}>{mm}:{ss}</span>
      </div>

      {/* "You're sharing your screen" badge — local screen is not echoed as a tile */}
      {screenTrack && (
        <div style={{
          margin: "8px 8px 0", padding: "8px 12px", borderRadius: 8,
          background: "rgba(78,173,135,0.10)", border: `1px solid rgba(78,173,135,0.25)`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: "rgba(78,173,135,0.15)", color: GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScreenShareIcon />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: GREEN }}>You&apos;re sharing your screen</span>
          <button onClick={toggleScreenShare} style={{
            marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
            background: "transparent", border: `1px solid rgba(78,173,135,0.3)`,
            color: GREEN, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}>Stop</button>
        </div>
      )}

      {/* Video area — screenshare is the hero, cameras are thumbnails below */}
      {hasVideo && (
        <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {remoteScreenTrack && (
            <div style={{ maxHeight: "40vh" }}>
              <VideoTile track={remoteScreenTrack} name={`${peerName}'s screen`} isLocal={false} speaking={false} muted={false} isAdmin={false} />
            </div>
          )}
          {cameraTiles > 0 && (
            <div className="comms-video-grid" style={{
              display: "grid", gap: 4,
              maxHeight: remoteScreenTrack ? "18vh" : "35vh",
              gridTemplateColumns: cameraTiles === 2 ? "1fr 1fr" : "1fr",
            }}>
              {remoteVideoTrack && <VideoTile track={remoteVideoTrack} name={peerName} isLocal={false} speaking={remoteSpeaking} muted={false} isAdmin={me !== "admin"} />}
              {localVideoTrack && <VideoTile track={localVideoTrack} name={me === "admin" ? "HOS" : "You"} isLocal speaking={false} muted={muted} isAdmin={me === "admin"} />}
            </div>
          )}
        </div>
      )}

      {/* Audio-only: participant tiles */}
      {!hasVideo && (
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "center", gap: 16 }}>
          <ParticipantTile name={me === "admin" ? "HOS Team" : "You"} speaking={false} muted={muted} isAdmin={me === "admin"} />
          {remote && <ParticipantTile name={peerName} speaking={remoteSpeaking} muted={false} isAdmin={me !== "admin"} />}
        </div>
      )}

      {/* Event feed */}
      {events.length > 0 && (
        <div style={{ padding: "0 16px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
          {events.map(e => (
            <div key={e.id} style={{
              fontSize: 10, fontFamily: "var(--font-mono)",
              color: e.type === "join" ? GREEN : MUTED,
              letterSpacing: "0.04em", animation: "fadeSlide 300ms ease-out",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{
                width: 4, height: 4, borderRadius: "50%", flexShrink: 0,
                background: e.type === "join" ? GREEN : e.type === "leave" ? MUTED : "rgba(139,107,62,0.5)",
              }} />
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Controls — inline bar */}
      <div style={{
        padding: "8px 16px 10px",
        borderTop: `1px solid ${BORDER}`,
        display: "flex", gap: 6, alignItems: "center", justifyContent: "center",
      }}>
        <ControlButton icon={muted ? <MicOffIcon /> : <MicIcon />} label={muted ? "Unmute" : "Mute"} active={!muted} danger={muted} onClick={toggleMute} disabled={state === "reconnecting"} />
        <ControlButton icon={<CameraIcon />} label={cameraOn ? "Cam off" : "Cam on"} active={cameraOn} onClick={toggleCamera} disabled={state === "reconnecting"} />
        <ControlButton icon={<ScreenShareIcon />} label={screenOn ? "Stop share" : "Share screen"} active={screenOn} onClick={toggleScreenShare} disabled={state === "reconnecting"} />
        <VolumeControls room={roomRef.current} audioEls={audioElsRef.current} />
        <ControlButton icon={<PhoneOffIcon />} label="End" danger onClick={disconnect} />
      </div>

      <style>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.4); } 50% { box-shadow: 0 0 0 6px rgba(78,173,135,0.15); } }
        @keyframes speakGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.5); } 50% { box-shadow: 0 0 12px 3px rgba(78,173,135,0.35); } }
      `}</style>
    </div>
  );
}

function ParticipantTile({ name, speaking, muted, isAdmin }: {
  name: string; speaking: boolean; muted?: boolean; isAdmin: boolean;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts.length === 0 ? "?" : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: speaking ? `2px solid ${GREEN}` : `2px solid transparent`,
        animation: speaking ? "speakGlow 1.2s ease-in-out infinite" : undefined,
        transition: "border-color 200ms, box-shadow 200ms",
        position: "relative",
      }}>
        {isAdmin ? (
          <HOSTeamAvatar size={44} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: speaking ? "rgba(78,173,135,0.15)" : "#3A3A3A",
            color: TEXT, transition: "background 300ms",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, fontFamily: "var(--font-ui)",
          }}>{ini}</div>
        )}
        {muted && (
          <div style={{
            position: "absolute", bottom: -1, right: -1,
            width: 16, height: 16, borderRadius: "50%",
            background: "rgba(201,106,106,0.85)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            </svg>
          </div>
        )}
      </div>
      <div style={{
        fontSize: 10, color: speaking ? GREEN : MUTED, fontWeight: 500,
        fontFamily: "var(--font-ui)", letterSpacing: "0.03em",
        maxWidth: 55, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", textAlign: "center",
        transition: "color 200ms",
      }}>
        {name.split(" ")[0]}
      </div>
    </div>
  );
}

function ControlButton({ icon, label, active, danger, onClick, disabled }: {
  icon: React.ReactNode; label: string; active?: boolean; danger?: boolean;
  onClick: () => void; disabled?: boolean;
}) {
  let bg = BG;
  let color = TEXT;
  let border = `1px solid ${BORDER}`;
  if (danger) { bg = RED; color = "#fff"; border = "none"; }
  else if (active) { bg = "rgba(78,173,135,0.12)"; color = GREEN; border = `1px solid rgba(78,173,135,0.3)`; }

  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} style={{
      width: 36, height: 36, borderRadius: 8,
      background: bg, color, border,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.5 : 1, transition: "all 150ms ease",
    }}>{icon}</button>
  );
}

function MicIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function MicOffIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" /><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .87-.16 1.7-.45 2.47" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function CameraIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
}
function ScreenShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
}
function PhoneOffIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>;
}
