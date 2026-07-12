"use client";
import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, LocalAudioTrack, RemoteParticipant } from "livekit-client";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";

interface Props {
  code:      string;
  me:        "admin" | "client";
  autoJoin?: boolean;
  onLeave?:  () => void;
}

type ConnState = "idle" | "connecting" | "connected" | "error";

export function CallPanel({ code, me, autoJoin, onLeave }: Props) {
  const roomRef = useRef<Room | null>(null);
  const [state, setState]           = useState<ConnState>("idle");
  const [error, setError]           = useState<string | null>(null);
  const [muted, setMuted]           = useState(false);
  const [remote, setRemote]         = useState<string | null>(null);
  const [peerName, setPeerName]     = useState<string>(me === "admin" ? "them" : "HOS Team");
  const [elapsedMs, setElapsedMs]   = useState(0);
  const [remoteJoinedAt, setRemoteJoinedAt] = useState<number | null>(null);
  const startAtRef = useRef<number>(0);

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
    try {
      const res = await fetch("/api/comms/token", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ code, asRole: me }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Failed to get token");
      if (json.data.peerName) setPeerName(json.data.peerName);

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        setRemote(p.identity);
        setRemoteJoinedAt(Date.now());
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemote(null);
        setRemoteJoinedAt(null);
      });
      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        setState("idle");
        onLeave?.();
      });

      await room.connect(json.data.url, json.data.token);
      await room.localParticipant.setMicrophoneEnabled(true);

      const existing = Array.from(room.remoteParticipants.values())[0];
      if (existing) {
        setRemote(existing.identity);
        setRemoteJoinedAt(Date.now());
      }

      startAtRef.current = Date.now();
      setState("connected");
    } catch (e) {
      setError((e as Error).message);
      setState("error");
    }
  }

  function disconnect() {
    const room = roomRef.current;
    if (!room) return;
    // Detach any attached audio elements
    room.remoteParticipants.forEach(p => {
      p.audioTrackPublications.forEach(pub => {
        pub.track?.detach().forEach(el => el.remove());
      });
    });
    room.disconnect();
    roomRef.current = null;
    setRemote(null);
    setRemoteJoinedAt(null);
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

  const dotColor =
    state === "connected" && remote ? GREEN :
    state === "connected"           ? GOLD  :
    state === "connecting"          ? GOLD  :
    state === "error"               ? RED   :
    BORDER;

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      padding: 20, color: TEXT,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em" }}>Voice</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {state === "idle"       && "Not connected"}
            {state === "connecting" && "Connecting…"}
            {state === "connected" && remote  && <>Connected with <span style={{ color: GREEN }}>{peerName}</span> · {mm}:{ss}</>}
            {state === "connected" && !remote && <>You&apos;re in. Waiting for {peerName}…</>}
            {state === "error"      && "Connection failed"}
          </div>
          {error && <div style={{ fontSize: 12, color: RED, marginTop: 4 }}>{error}</div>}
        </div>
        <div style={{
          width: 10, height: 10, borderRadius: 5, flexShrink: 0,
          background: dotColor,
          animation: state === "connected" && !remote ? "pulseDot 1.2s ease-in-out infinite" : undefined,
        }} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {state !== "connected" && state !== "connecting" ? (
          <button onClick={connect} style={btnPrimary}>Join call</button>
        ) : (
          <>
            <button onClick={toggleMute} style={btnSecondary}>{muted ? "Unmute" : "Mute"}</button>
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
