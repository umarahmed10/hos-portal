"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteParticipant, type Participant, type RemoteTrackPublication } from "livekit-client";
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
  const [events, setEvents] = useState<{ id: string; text: string; type: "join" | "leave" | "info" }[]>([]);

  // Video track state
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

      const room = new Room({ adaptiveStream: true, dynacast: true });
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
        // Check if existing participant has video
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
      await room.localParticipant.setScreenShareEnabled(next);
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
  const hasVideo = localVideoTrack || remoteVideoTrack || screenTrack || remoteScreenTrack;

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      color: TEXT, overflow: "hidden",
    }}>
      {/* Status header */}
      <div style={{ padding: "14px 20px", borderBottom: inCall ? `1px solid ${BORDER}` : "none" }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>
          {hasVideo ? "Video" : "Voice"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>
          {state === "idle"         && "Not connected"}
          {state === "connecting"   && "Connecting…"}
          {state === "reconnecting" && <span style={{ color: GOLD }}>Reconnecting…</span>}
          {state === "connected" && remote  && (
            <>
              {remoteSpeaking
                ? <><span style={{ color: GREEN }}>{peerName}</span> is speaking</>
                : <>Connected with <span style={{ color: GREEN }}>{peerName}</span></>}
            </>
          )}
          {state === "connected" && !remote && <>Waiting for {peerName}…</>}
          {state === "error"        && "Connection failed"}
        </div>
        {error && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>{error}</div>}
      </div>

      {/* Participant area */}
      {inCall && (
        <div style={{ padding: "16px 20px" }}>
          {/* Timer */}
          {state === "connected" && (
            <div style={{
              textAlign: "center", fontSize: 24, fontWeight: 600,
              fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
              color: TEXT, marginBottom: 16, opacity: 0.7,
            }}>{mm}:{ss}</div>
          )}

          {/* Video tiles or audio participant grid */}
          {hasVideo ? (
            <div className="comms-video-grid" style={{
              position: "relative",
              display: "grid",
              gap: 6, marginBottom: 12,
              maxHeight: "50vh",
              gridTemplateColumns: (remoteScreenTrack || screenTrack) ? "1fr" :
                (remoteVideoTrack && localVideoTrack ? "1fr 1fr" : "1fr"),
            }}>
              {remoteScreenTrack && (
                <VideoTile
                  track={remoteScreenTrack}
                  name={`${peerName}'s screen`}
                  isLocal={false}
                  speaking={false}
                  muted={false}
                  isAdmin={false}
                />
              )}
              {screenTrack && (
                <VideoTile
                  track={screenTrack}
                  name="Your screen"
                  isLocal
                  speaking={false}
                  muted={false}
                  isAdmin={false}
                />
              )}
              {remoteVideoTrack && (
                <VideoTile
                  track={remoteVideoTrack}
                  name={peerName}
                  isLocal={false}
                  speaking={remoteSpeaking}
                  muted={false}
                  isAdmin={me !== "admin"}
                />
              )}
              {localVideoTrack && (
                <VideoTile
                  track={localVideoTrack}
                  name={me === "admin" ? "HOS" : "You"}
                  isLocal
                  speaking={false}
                  muted={muted}
                  isAdmin={me === "admin"}
                />
              )}
            </div>
          ) : (
            <div style={{
              display: "flex", justifyContent: "center", gap: 20,
              marginBottom: 16,
            }}>
              <ParticipantTile
                name={me === "admin" ? "HOS Team" : "You"}
                speaking={false}
                muted={muted}
                isAdmin={me === "admin"}
              />
              {remote && (
                <ParticipantTile
                  name={peerName}
                  speaking={remoteSpeaking}
                  muted={false}
                  isAdmin={me !== "admin"}
                />
              )}
            </div>
          )}

          {/* Event feed */}
          {events.length > 0 && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 3 }}>
              {events.map(e => (
                <div key={e.id} style={{
                  fontSize: 10, fontFamily: "var(--font-mono)",
                  color: e.type === "join" ? GREEN : e.type === "leave" ? MUTED : MUTED,
                  letterSpacing: "0.04em",
                  animation: "fadeSlide 300ms ease-out",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: e.type === "join" ? GREEN : e.type === "leave" ? MUTED : "rgba(139,107,62,0.5)",
                  }} />
                  {e.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom control bar */}
      <div style={{
        padding: "12px 20px",
        borderTop: inCall ? `1px solid ${BORDER}` : "none",
        display: "flex", gap: 8, alignItems: "center", justifyContent: "center",
      }}>
        {!inCall && state !== "connecting" ? (
          <button onClick={connect} style={btnPrimary}>
            {state === "error" ? "Try again" : "Join call"}
          </button>
        ) : (
          <>
            <ControlButton
              icon={muted ? <MicOffIcon /> : <MicIcon />}
              label={muted ? "Unmute" : "Mute"}
              active={!muted}
              danger={muted}
              onClick={toggleMute}
              disabled={state === "reconnecting"}
            />
            <ControlButton
              icon={<CameraIcon />}
              label={cameraOn ? "Cam off" : "Cam on"}
              active={cameraOn}
              onClick={toggleCamera}
              disabled={state === "reconnecting"}
            />
            <ControlButton
              icon={<ScreenShareIcon />}
              label={screenOn ? "Stop share" : "Share screen"}
              active={screenOn}
              onClick={toggleScreenShare}
              disabled={state === "reconnecting"}
            />
            <VolumeControls room={roomRef.current} audioEls={audioElsRef.current} />
            <ControlButton
              icon={<PhoneOffIcon />}
              label="End"
              danger
              onClick={disconnect}
            />
          </>
        )}
      </div>
      <style>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.4); } 50% { box-shadow: 0 0 0 4px rgba(78,173,135,0.15); } }
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: speaking ? `3px solid ${GREEN}` : `3px solid transparent`,
        animation: speaking ? "speakPulse 1s ease-in-out infinite" : undefined,
        transition: "border-color 200ms",
        position: "relative",
      }}>
        {isAdmin ? (
          <HOSTeamAvatar size={48} />
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "#3A3A3A", color: TEXT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, fontFamily: "var(--font-ui)",
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
        fontSize: 11, color: MUTED, fontWeight: 500,
        fontFamily: "var(--font-ui)", letterSpacing: "0.03em",
        maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", textAlign: "center",
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
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        width: 40, height: 40, borderRadius: 10,
        background: bg, color, border,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        transition: "all 150ms ease",
      }}
    >{icon}</button>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
      <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .87-.16 1.7-.45 2.47" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function ScreenShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 8, fontSize: 13,
  fontFamily: "var(--font-ui)", fontWeight: 600, letterSpacing: "0.05em",
  textTransform: "uppercase", border: "none",
  cursor: "pointer", background: TEXT, color: BG,
};
