"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteParticipant, type Participant } from "livekit-client";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { postJSON } from "@/lib/comms/http";

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
  // Audio elements we attach for remote tracks — tracked so every one is torn
  // down on unmount/disconnect (previously appended to document.body and leaked
  // when the panel unmounted mid-call or hit an error path).
  const audioElsRef = useRef<HTMLAudioElement[]>([]);
  const [state, setState]           = useState<ConnState>("idle");
  const [error, setError]           = useState<string | null>(null);
  const [muted, setMuted]           = useState(false);
  const [remote, setRemote]         = useState<string | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [peerName, setPeerName]     = useState<string>(me === "admin" ? "them" : "HOS Team");
  const [elapsedMs, setElapsedMs]   = useState(0);
  const [remoteJoinedAt, setRemoteJoinedAt] = useState<number | null>(null);
  const startAtRef = useRef<number>(0);
  // Call-history bookkeeping. talkStartRef holds the ms timestamp the remote
  // first joined (basis for duration); retained until the next connect so a
  // hang-up can still compute talk time. endEmittedRef guards single emission.
  const talkStartRef  = useRef<number | null>(null);
  const endEmittedRef = useRef<boolean>(false);

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

  async function connect() {
    setState("connecting");
    setError(null);
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
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemote(null);
        setRemoteJoinedAt(null);
        setRemoteSpeaking(false);
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = "none";
          audioElsRef.current.push(el);
          document.body.appendChild(el);
        }
      });
      // Speaking indicator — the single strongest "who's talking" signal.
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        setRemoteSpeaking(speakers.some(s => s !== room.localParticipant));
      });
      // Reconnect lifecycle — a dropped connection now reads differently from a
      // deliberate hang-up instead of silently flipping to idle.
      room.on(RoomEvent.Reconnecting, () => setState("reconnecting"));
      room.on(RoomEvent.Reconnected,  () => setState("connected"));
      room.on(RoomEvent.Disconnected, () => {
        emitEnded();
        detachAudio();
        setState("idle");
        setRemoteSpeaking(false);
        onLeave?.();
      });

      await room.connect(data.url, data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      const existing = Array.from(room.remoteParticipants.values())[0];
      if (existing) {
        setRemote(existing.identity);
        setRemoteJoinedAt(Date.now());
        if (talkStartRef.current === null) talkStartRef.current = Date.now();
      }

      startAtRef.current = Date.now();
      setState("connected");
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

  // Record an "ended" call event once per call, with the real talk duration.
  // Only fires when the remote actually joined — a ring the other side never
  // answered leaves a lone "started" that the feed renders as a missed call.
  // Best-effort: call history must never break the call UX, so errors swallow.
  function emitEnded() {
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
    });
    detachAudio();
    room.disconnect();
    roomRef.current = null;
    onRoom?.(null);
    setRemote(null);
    setRemoteJoinedAt(null);
    setRemoteSpeaking(false);
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

  // Talk-time = elapsed since remote actually joined (not since we hit connect).
  // elapsedMs is only read here as a tick-driver; the 1s interval re-renders
  // this component and Date.now() recomputes the display.
  const talkStart = remoteJoinedAt ?? startAtRef.current;
  const seconds   = state === "connected" && (elapsedMs || talkStart)
    ? Math.max(0, Math.floor((Date.now() - talkStart) / 1000))
    : 0;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const inCall = state === "connected" || state === "reconnecting";

  const dotColor =
    state === "reconnecting"        ? GOLD  :
    state === "connected" && remote ? GREEN :
    state === "connected"           ? GOLD  :
    state === "connecting"          ? GOLD  :
    state === "error"               ? RED   :
    BORDER;

  // Dot pulses while the peer is speaking, or while waiting/reconnecting.
  const dotPulse =
    (state === "connected" && remoteSpeaking) ||
    (state === "connected" && !remote) ||
    state === "reconnecting";

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: 20, color: TEXT,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em" }}>Voice</div>
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
        <div style={{
          width: 10, height: 10, borderRadius: 5, flexShrink: 0,
          background: dotColor,
          animation: dotPulse ? "pulseDot 1.2s ease-in-out infinite" : undefined,
        }} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {!inCall && state !== "connecting" ? (
          <button onClick={connect} style={btnPrimary}>
            {state === "error" ? "Try again" : "Join call"}
          </button>
        ) : (
          <>
            <button onClick={toggleMute} disabled={state === "reconnecting"} style={btnSecondary}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button onClick={disconnect} style={btnDanger}>Hang up</button>
          </>
        )}
      </div>
      <style>{`@keyframes pulseDot { 0%,100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>
    </div>
  );
}

const btnBase = {
  padding: "10px 18px", borderRadius: 8, fontSize: 13,
  fontFamily: "var(--font-ui)", fontWeight: 600, letterSpacing: "0.05em",
  textTransform: "uppercase" as const, border: `1px solid ${BORDER}`,
  cursor: "pointer",
};
const btnPrimary   = { ...btnBase, background: TEXT, color: BG,   border: "none" };
const btnSecondary = { ...btnBase, background: BG,   color: TEXT };
const btnDanger    = { ...btnBase, background: RED,  color: "#fff", border: "none" };
