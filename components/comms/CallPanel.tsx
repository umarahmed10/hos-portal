"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteParticipant, type Participant, type RemoteTrackPublication } from "livekit-client";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { postJSON } from "@/lib/comms/http";
import { playJoin, playLeave, playConnected, playDisconnected } from "@/lib/comms/sounds";
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
      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = "none";
          audioElsRef.current.push(el);
          document.body.appendChild(el);
        }
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(track);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          setRemoteVideoTrack(prev => prev === track ? null : prev);
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
        setLocalVideoTrack(null);
        setRemoteVideoTrack(null);
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
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track as LocalAudioTrack | undefined;
    if (!track) return;
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

  const talkStart = remoteJoinedAt ?? startAtRef.current;
  const seconds   = state === "connected" && (elapsedMs || talkStart)
    ? Math.max(0, Math.floor((Date.now() - talkStart) / 1000))
    : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const inCall = state === "connected" || state === "reconnecting";
  const hasVideo = localVideoTrack || remoteVideoTrack;

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: 20, color: TEXT,
    }}>
      {/* Header: status + participant avatars */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
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
                {" · "}{mm}:{ss}
              </>
            )}
            {state === "connected" && !remote && <>You&apos;re in. Waiting for {peerName}…</>}
            {state === "error"        && "Connection failed"}
          </div>
          {error && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>{error}</div>}
        </div>

        {/* Participant avatars (audio-only mode) */}
        {inCall && !hasVideo && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 12 }}>
            <ParticipantDot
              name={me === "admin" ? "HOS Team" : peerName}
              speaking={false}
              active
              muted={muted}
              isAdmin={me === "admin"}
            />
            {remote && (
              <ParticipantDot
                name={peerName}
                speaking={remoteSpeaking}
                active
                isAdmin={me !== "admin"}
              />
            )}
          </div>
        )}
      </div>

      {/* Video tiles (when video is active) */}
      {inCall && hasVideo && (
        <div style={{
          display: "grid",
          gridTemplateColumns: remoteVideoTrack && localVideoTrack ? "1fr 1fr" : "1fr",
          gap: 8, marginBottom: 12,
        }}>
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
          <VideoTile
            track={localVideoTrack}
            name={me === "admin" ? "HOS Team" : "You"}
            isLocal
            speaking={false}
            muted={muted}
            isAdmin={me === "admin"}
          />
        </div>
      )}

      {/* Event feed */}
      {events.length > 0 && inCall && (
        <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 3 }}>
          {events.map(e => (
            <div key={e.id} style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: e.type === "join" ? GREEN : e.type === "leave" ? RED : MUTED,
              letterSpacing: "0.03em",
              animation: "fadeSlide 300ms ease-out",
            }}>
              {e.type === "join" ? "→" : e.type === "leave" ? "←" : "·"} {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {!inCall && state !== "connecting" ? (
          <button onClick={connect} style={btnPrimary}>
            {state === "error" ? "Try again" : "Join call"}
          </button>
        ) : (
          <>
            <button onClick={toggleMute} disabled={state === "reconnecting"} style={muted ? btnMuted : btnSecondary}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={toggleCamera} disabled={state === "reconnecting"} style={cameraOn ? btnActive : btnSecondary}>
              {cameraOn ? "Cam off" : "Cam on"}
            </button>
            <button onClick={disconnect} style={btnDanger}>Hang up</button>
            <VolumeControls room={roomRef.current} audioEls={audioElsRef.current} />
          </>
        )}
      </div>
      <style>{`
        @keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.4); } 50% { box-shadow: 0 0 0 4px rgba(78,173,135,0.15); } }
      `}</style>
    </div>
  );
}

function ParticipantDot({ name, speaking, active, muted, isAdmin }: {
  name: string; speaking: boolean; active: boolean; muted?: boolean; isAdmin: boolean;
}) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts.length === 0 ? "?" : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: speaking ? `2px solid ${GREEN}` : `2px solid transparent`,
        animation: speaking ? "speakPulse 1s ease-in-out infinite" : undefined,
        transition: "border-color 200ms",
        position: "relative",
      }}>
        {isAdmin ? (
          <HOSTeamAvatar size={32} />
        ) : (
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: active ? "#3A3A3A" : SURF_2,
            color: TEXT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, fontFamily: "var(--font-ui)",
          }}>{ini}</div>
        )}
        {muted && (
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: 12, height: 12, borderRadius: "50%",
            background: RED, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, color: "#fff", fontWeight: 700,
          }}>✕</div>
        )}
      </div>
      <div style={{ fontSize: 8, color: MUTED, letterSpacing: "0.05em", maxWidth: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
        {name.split(" ")[0]}
      </div>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 8, fontSize: 13,
  fontFamily: "var(--font-ui)", fontWeight: 600, letterSpacing: "0.05em",
  textTransform: "uppercase", border: `1px solid ${BORDER}`,
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties   = { ...btnBase, background: TEXT, color: BG,   border: "none" };
const btnSecondary: React.CSSProperties = { ...btnBase, background: BG,   color: TEXT };
const btnActive: React.CSSProperties    = { ...btnBase, background: "rgba(78,173,135,0.12)", color: GREEN, border: `1px solid rgba(78,173,135,0.3)` };
const btnMuted: React.CSSProperties     = { ...btnBase, background: "rgba(201,106,106,0.12)", color: RED, border: `1px solid rgba(201,106,106,0.3)` };
const btnDanger: React.CSSProperties    = { ...btnBase, background: RED,  color: "#fff", border: "none" };
