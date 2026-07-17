"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room, RoomEvent, Track, VideoPresets, ConnectionQuality,
  LocalAudioTrack, RemoteParticipant,
  type Participant, type RemoteTrackPublication, type LocalTrackPublication,
} from "livekit-client";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { postJSON } from "@/lib/comms/http";
import { playJoin, playLeave, playConnected, playDisconnected, playScreenShare, playScreenShareEnd, playMuteToggle } from "@/lib/comms/sounds";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import { VolumeControls } from "@/components/comms/VolumeControls";
import { VideoTile } from "@/components/comms/VideoTile";

interface TokenData { token: string; url: string; room: string; identity: string; peerName?: string }

interface Props {
  code:        string;
  me:          "admin" | "client";
  autoJoin?:   boolean;
  onLeave?:    () => void;
  onRoom?:     (room: Room | null) => void;
  onConnected?: () => void;   // fired once the local participant joins (admin uses this to ring)
}

type ConnState = "idle" | "connecting" | "connected" | "reconnecting" | "error";

const SOLO_TIMEOUT_MS = 180_000; // 3 minutes alone = auto-disconnect

export function CallPanel({ code, me, autoJoin, onLeave, onRoom, onConnected }: Props) {
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

  // Per-participant connection quality — tells you WHOSE network is at fault.
  const [localQuality, setLocalQuality]   = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [remoteQuality, setRemoteQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);

  // Fullscreen focus stage (FaceTime / Discord screen-share view)
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Auto-disconnect if alone for >3 minutes (Discord's unanswered-call behavior)
  useEffect(() => {
    if (soloTimerRef.current) { clearTimeout(soloTimerRef.current); soloTimerRef.current = null; }
    if (state === "connected" && !remote) {
      soloTimerRef.current = setTimeout(() => {
        addEvent("No answer — call ended", "info");
        disconnect();
      }, SOLO_TIMEOUT_MS);
    }
    return () => { if (soloTimerRef.current) clearTimeout(soloTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, remote]);

  // Auto-hide floating controls in fullscreen after inactivity.
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);

  useEffect(() => {
    if (!fullscreen) { setControlsVisible(true); return; }
    pokeControls();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [fullscreen, pokeControls]);

  // Escape exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

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
        // adaptiveStream sizes each stream to the on-screen tile; dynacast pauses
        // layers nobody watches. We capture at 1080p and publish three simulcast
        // layers so a fullscreen view is crisp while small tiles stay cheap.
        adaptiveStream: true,
        dynacast:       true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h1080.resolution,
        },
        publishDefaults: {
          videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720, VideoPresets.h1080],
          videoCodec: "vp8",
          dtx:        true,  // silence uses ~0 bandwidth
          red:        true,  // redundant audio for packet-loss resilience
          screenShareEncoding: {
            maxBitrate:   4_000_000,
            maxFramerate: 30,
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
        setRemoteScreenTrack(null);
        setRemoteQuality(ConnectionQuality.Unknown);
        const name = p.name || p.identity;
        addEvent(`${name} left`, "leave");
        playLeave();
      });
      room.on(RoomEvent.TrackSubscribed, (track, pub, _participant) => {
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
            setFullscreen(true); // remote started sharing — focus it, like Discord
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
      // Native "Stop sharing" (browser bar) unpublishes the local screen track —
      // sync our UI state so the button + preview clear correctly.
      room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare) {
          setScreenOn(false);
          setScreenTrack(null);
          playScreenShareEnd();
        }
        if (pub.source === Track.Source.Camera) {
          setCameraOn(false);
          setLocalVideoTrack(null);
        }
      });
      room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant: Participant) => {
        if (participant === room.localParticipant) setLocalQuality(quality);
        else setRemoteQuality(quality);
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
        setFullscreen(false);
        setRemoteSpeaking(false);
        setCameraOn(false);
        setScreenOn(false);
        setLocalVideoTrack(null);
        setRemoteVideoTrack(null);
        setScreenTrack(null);
        setRemoteScreenTrack(null);
        setLocalQuality(ConnectionQuality.Unknown);
        setRemoteQuality(ConnectionQuality.Unknown);
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
            if (pub.source === Track.Source.ScreenShare) { setRemoteScreenTrack(pub.track); setFullscreen(true); }
            else setRemoteVideoTrack(pub.track);
          }
        });
      }

      startAtRef.current = Date.now();
      setState("connected");
      addEvent(remote ? "You connected" : "Waiting for them to pick up…", "join");
      playConnected();
      onRoom?.(room);
      onConnected?.();
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
    setFullscreen(false);
    setRemote(null);
    setRemoteJoinedAt(null);
    setRemoteSpeaking(false);
    setCameraOn(false);
    setScreenOn(false);
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
    setScreenTrack(null);
    setRemoteScreenTrack(null);
    setLocalQuality(ConnectionQuality.Unknown);
    setRemoteQuality(ConnectionQuality.Unknown);
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
        contentHint: "detail",
      });
      setScreenOn(next);
      if (next) {
        playScreenShare();
        const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        setScreenTrack(pub?.track ?? null);
        setFullscreen(true); // focus your own share so you get a live preview
      } else {
        playScreenShareEnd();
        setScreenTrack(null);
      }
    } catch {
      // user cancelled the picker, or permission denied
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
  const anyVideo = !!(localVideoTrack || remoteVideoTrack || screenTrack || remoteScreenTrack);

  // Which track is the "hero" on the main stage, and which go to the PiP strip.
  const mainTrack = remoteScreenTrack ?? screenTrack ?? remoteVideoTrack ?? localVideoTrack ?? null;
  const mainIsScreen = mainTrack === remoteScreenTrack || mainTrack === screenTrack;
  const mainIsLocal  = mainTrack === screenTrack || (mainTrack === localVideoTrack && mainTrack !== null);
  const pipTracks: { track: Track; label: string; isLocal: boolean; isAdmin: boolean; speaking: boolean }[] = [];
  if (remoteVideoTrack && remoteVideoTrack !== mainTrack) pipTracks.push({ track: remoteVideoTrack, label: peerName, isLocal: false, isAdmin: me !== "admin", speaking: remoteSpeaking });
  if (localVideoTrack && localVideoTrack !== mainTrack)   pipTracks.push({ track: localVideoTrack, label: me === "admin" ? "HOS" : "You", isLocal: true, isAdmin: me === "admin", speaking: false });
  if (screenTrack && screenTrack !== mainTrack)           pipTracks.push({ track: screenTrack, label: "Your screen", isLocal: true, isAdmin: false, speaking: false });

  // ── Idle — Discord-style voice channel entry ──
  if (!inCall && state !== "connecting") {
    return (
      <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, color: TEXT, overflow: "hidden" }}>
        <button
          onClick={connect}
          style={{
            width: "100%", padding: "14px 20px",
            background: "transparent", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12, color: TEXT, transition: "background 120ms",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(78,173,135,0.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: "rgba(78,173,135,0.12)", color: GREEN,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PhoneIcon />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {state === "error" ? "Try again" : me === "admin" ? "Start call" : "Voice Channel"}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {me === "admin" ? "Joins and rings them" : "Click to connect"}
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: GREEN, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", fontWeight: 600 }}>
            {me === "admin" ? "CALL" : "JOIN"}
          </div>
        </button>
        {error && <div style={{ fontSize: 12, color: RED, padding: "0 20px 12px" }}>{error}</div>}
      </div>
    );
  }

  // ── Connecting — loader ──
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
            <circle cx="20" cy="20" r="16" fill="none" stroke={GREEN} strokeWidth="3" strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Connecting…</div>
        <div style={{ fontSize: 11, color: MUTED }}>Setting up your call</div>
      </div>
    );
  }

  // Shared control bar (used inline and in fullscreen)
  const controlBar = (
    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
      <ControlButton icon={muted ? <MicOffIcon /> : <MicIcon />} label={muted ? "Unmute" : "Mute"} active={!muted} danger={muted} onClick={toggleMute} disabled={state === "reconnecting"} />
      <ControlButton icon={<CameraIcon />} label={cameraOn ? "Cam off" : "Cam on"} active={cameraOn} onClick={toggleCamera} disabled={state === "reconnecting"} />
      <ControlButton icon={<ScreenShareIcon />} label={screenOn ? "Stop share" : "Share screen"} active={screenOn} onClick={toggleScreenShare} disabled={state === "reconnecting"} />
      <VolumeControls room={roomRef.current} audioEls={audioElsRef.current} />
      {anyVideo && (
        <ControlButton
          icon={fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
          label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={() => setFullscreen(f => !f)}
        />
      )}
      <ControlButton icon={<PhoneOffIcon />} label="End" danger onClick={disconnect} />
    </div>
  );

  const connBanner = <ConnectionBanner localQuality={localQuality} remoteQuality={remoteQuality} peerName={peerName} remote={!!remote} />;

  // ── Fullscreen focus stage ──
  if (fullscreen && anyVideo) {
    return (
      <div
        onMouseMove={pokeControls}
        onClick={pokeControls}
        style={{
          position: "fixed", inset: 0, zIndex: 9500, background: "#000",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Top overlay — identity, timer, quality */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 3,
          padding: "14px 18px",
          background: "linear-gradient(rgba(0,0,0,0.6), transparent)",
          display: "flex", alignItems: "center", gap: 10,
          opacity: controlsVisible ? 1 : 0, transition: "opacity 300ms",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {remote ? `With ${peerName}` : `Calling ${peerName}…`}
          </span>
          <NetIndicator quality={localQuality} label="You" />
          {remote && <NetIndicator quality={remoteQuality} label={peerName.split(" ")[0]} />}
          <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#fff", letterSpacing: "0.06em" }}>
            {mm}:{ss}
          </span>
        </div>

        {/* Main stage — screen share / hero video, letterboxed */}
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          {mainTrack ? (
            <StageVideo track={mainTrack} contain={mainIsScreen} mirror={mainIsLocal && !mainIsScreen} />
          ) : (
            <div style={{ color: MUTED, fontSize: 14 }}>Waiting for video…</div>
          )}
          {mainIsScreen && (
            <div style={{
              position: "absolute", top: 60, left: 18,
              fontSize: 11, color: "#fff", background: "rgba(0,0,0,0.5)",
              padding: "4px 10px", borderRadius: 6, fontWeight: 600,
              opacity: controlsVisible ? 1 : 0, transition: "opacity 300ms",
            }}>
              {mainTrack === screenTrack ? "Your screen" : `${peerName}'s screen`}
            </div>
          )}
        </div>

        {/* Camera PiP strip — bottom-right corner, FaceTime-style */}
        {pipTracks.length > 0 && (
          <div style={{
            position: "absolute", right: 16, bottom: controlsVisible ? 96 : 24, zIndex: 4,
            display: "flex", flexDirection: "column", gap: 8,
            transition: "bottom 300ms",
          }}>
            {pipTracks.map((p, i) => (
              <div key={i} style={{ width: 190, aspectRatio: "16 / 10", boxShadow: "0 4px 16px rgba(0,0,0,0.5)", borderRadius: 10, overflow: "hidden" }}>
                <VideoTile track={p.track} name={p.label} isLocal={p.isLocal} speaking={p.speaking} muted={p.isLocal ? muted : false} isAdmin={p.isAdmin} />
              </div>
            ))}
          </div>
        )}

        {/* Connection banner */}
        <div style={{ position: "absolute", top: 56, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 4, pointerEvents: "none" }}>
          {connBanner}
        </div>

        {/* Floating controls — auto-hide */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 5,
          padding: "20px 18px 22px",
          background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
          display: "flex", justifyContent: "center",
          opacity: controlsVisible ? 1 : 0, transition: "opacity 300ms",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}>
          <div style={{ background: "rgba(20,20,20,0.9)", borderRadius: 14, padding: "8px 12px", border: `1px solid ${BORDER}` }}>
            {controlBar}
          </div>
        </div>
      </div>
    );
  }

  // ── Inline compact view ──
  return (
    <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, color: TEXT, overflow: "hidden" }}>
      {/* Status bar */}
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
              remote ? (remoteSpeaking ? `${peerName} speaking` : `With ${peerName}`) : `Calling ${peerName}…`
            )}
          </span>
          <NetIndicator quality={localQuality} label="You" compact />
          {remote && <NetIndicator quality={remoteQuality} label={peerName.split(" ")[0]} compact />}
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", color: MUTED }}>
          {mm}:{ss}
        </span>
      </div>

      {connBanner}

      {/* You're sharing badge */}
      {screenTrack && !remoteScreenTrack && (
        <div style={{
          margin: "8px 8px 0", padding: "8px 12px", borderRadius: 8,
          background: "rgba(78,173,135,0.10)", border: `1px solid rgba(78,173,135,0.25)`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: "rgba(78,173,135,0.15)", color: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScreenShareIcon />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: GREEN }}>You&apos;re sharing your screen</span>
          <button onClick={() => setFullscreen(true)} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, background: "transparent", border: `1px solid rgba(78,173,135,0.3)`, color: GREEN, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Preview</button>
          <button onClick={toggleScreenShare} style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: `1px solid ${BORDER}`, color: MUTED, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Stop</button>
        </div>
      )}

      {/* Video area — hero + camera thumbs, tap to go fullscreen */}
      {anyVideo && (
        <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {mainTrack && (
            <div
              onClick={() => setFullscreen(true)}
              title="Click for fullscreen"
              style={{ maxHeight: "34vh", cursor: "pointer", position: "relative" }}
            >
              <VideoTile track={mainTrack} name={mainIsScreen ? (mainTrack === screenTrack ? "Your screen" : `${peerName}'s screen`) : peerName} isLocal={mainIsLocal} speaking={!mainIsScreen && remoteSpeaking} muted={false} isAdmin={me !== "admin" && !mainIsLocal} />
              <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: 5, color: "#fff", display: "flex" }}>
                <MaximizeIcon />
              </div>
            </div>
          )}
          {pipTracks.length > 0 && (
            <div className="comms-video-grid" style={{
              display: "grid", gap: 4, maxHeight: "16vh",
              gridTemplateColumns: pipTracks.length >= 2 ? "1fr 1fr" : "1fr",
            }}>
              {pipTracks.map((p, i) => (
                <VideoTile key={i} track={p.track} name={p.label} isLocal={p.isLocal} speaking={p.speaking} muted={p.isLocal ? muted : false} isAdmin={p.isAdmin} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audio-only participant tiles */}
      {!anyVideo && (
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "center", gap: 16 }}>
          <ParticipantTile name={me === "admin" ? "HOS Team" : "You"} speaking={false} muted={muted} isAdmin={me === "admin"} />
          {remote
            ? <ParticipantTile name={peerName} speaking={remoteSpeaking} muted={false} isAdmin={me !== "admin"} />
            : <WaitingTile name={peerName} />}
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
              <span style={{ width: 4, height: 4, borderRadius: "50%", flexShrink: 0, background: e.type === "join" ? GREEN : e.type === "leave" ? MUTED : "rgba(139,107,62,0.5)" }} />
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: "8px 16px 10px", borderTop: `1px solid ${BORDER}` }}>
        {controlBar}
      </div>

      <style>{`
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes speakPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.4); } 50% { box-shadow: 0 0 0 6px rgba(78,173,135,0.15); } }
        @keyframes speakGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(78,173,135,0.5); } 50% { box-shadow: 0 0 12px 3px rgba(78,173,135,0.35); } }
        @keyframes waitPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
      `}</style>
    </div>
  );
}

// Full-bleed video for the fullscreen stage.
function StageVideo({ track, contain, mirror }: { track: Track; contain: boolean; mirror: boolean }) {
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
      autoPlay
      playsInline
      muted
      controls={false}
      disablePictureInPicture
      onContextMenu={e => e.preventDefault()}
      style={{
        width: "100%", height: "100%",
        objectFit: contain ? "contain" : "cover",
        transform: mirror ? "scaleX(-1)" : undefined,
        background: "#000",
      }}
    />
  );
}

// Signal-bars connection indicator — colored by quality.
function NetIndicator({ quality, label, compact }: { quality: ConnectionQuality; label: string; compact?: boolean }) {
  const filled =
    quality === ConnectionQuality.Excellent ? 3 :
    quality === ConnectionQuality.Good ? 2 :
    quality === ConnectionQuality.Poor ? 1 : 0;
  const color =
    quality === ConnectionQuality.Excellent || quality === ConnectionQuality.Good ? GREEN :
    quality === ConnectionQuality.Poor ? GOLD :
    quality === ConnectionQuality.Lost ? RED : MUTED;
  if (quality === ConnectionQuality.Unknown) return null;
  return (
    <span title={`${label}: ${quality}`} style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 12 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 3, height: 4 + i * 3, borderRadius: 1,
          background: i < filled ? color : "rgba(243,241,236,0.18)",
        }} />
      ))}
      {!compact && <span style={{ fontSize: 9, color, marginLeft: 3, fontFamily: "var(--font-mono)" }}>{label}</span>}
    </span>
  );
}

// Banner naming whose connection is unstable.
function ConnectionBanner({ localQuality, remoteQuality, peerName, remote }: {
  localQuality: ConnectionQuality; remoteQuality: ConnectionQuality; peerName: string; remote: boolean;
}) {
  const localBad  = localQuality === ConnectionQuality.Poor || localQuality === ConnectionQuality.Lost;
  const remoteBad = remote && (remoteQuality === ConnectionQuality.Poor || remoteQuality === ConnectionQuality.Lost);
  if (!localBad && !remoteBad) return null;
  const msg = localBad && remoteBad ? "Both connections are unstable"
    : localBad ? "Your connection is unstable"
    : `${peerName.split(" ")[0]}'s connection is unstable`;
  return (
    <div style={{
      margin: "8px 8px 0", padding: "6px 12px", borderRadius: 8,
      background: "rgba(201,106,106,0.12)", border: `1px solid rgba(201,106,106,0.3)`,
      display: "flex", alignItems: "center", gap: 8, alignSelf: "center",
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C96A6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#C96A6A" }}>{msg}</span>
    </div>
  );
}

function WaitingTile({ name }: { name: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `2px dashed rgba(243,241,236,0.2)`, animation: "waitPulse 1.6s ease-in-out infinite",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 500, fontFamily: "var(--font-ui)", maxWidth: 70, textAlign: "center" }}>
        Ringing {name.split(" ")[0]}…
      </div>
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
        transition: "border-color 200ms, box-shadow 200ms", position: "relative",
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
              <line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
            </svg>
          </div>
        )}
      </div>
      <div style={{
        fontSize: 10, color: speaking ? GREEN : MUTED, fontWeight: 500,
        fontFamily: "var(--font-ui)", letterSpacing: "0.03em",
        maxWidth: 55, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", textAlign: "center", transition: "color 200ms",
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
      width: 38, height: 38, borderRadius: 9,
      background: bg, color, border,
      cursor: disabled ? "not-allowed" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.5 : 1, transition: "all 150ms ease",
    }}>{icon}</button>
  );
}

function PhoneIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>;
}
function MicIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function MicOffIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" /><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .87-.16 1.7-.45 2.47" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>;
}
function CameraIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
}
function ScreenShareIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
}
function PhoneOffIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>;
}
function MaximizeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>;
}
function MinimizeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></svg>;
}
