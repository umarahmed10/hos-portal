"use client";
// Call engine hook — owns the LiveKit room, media tracks, and call state.
// UI (CommsWorkspace / CallStage / call bar) is a pure function of what this
// returns. Extracted from the old CallPanel monolith so multiple surfaces can
// share one call model.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room, RoomEvent, Track, VideoPresets, AudioPresets, ConnectionQuality,
  LocalAudioTrack, RemoteParticipant,
  type Participant, type RemoteTrackPublication, type LocalTrackPublication,
} from "livekit-client";
import { toast } from "sonner";
import { postJSON } from "@/lib/comms/http";
import {
  playJoin, playLeave, playConnected, playDisconnected,
  playScreenShare, playScreenShareEnd, playMuteToggle, playRecordingStart,
} from "@/lib/comms/sounds";

function isPermissionError(e: unknown): boolean {
  const name = (e as { name?: string })?.name;
  return name === "NotAllowedError" || name === "PermissionDeniedError";
}

interface TokenData { token: string; url: string; room: string; identity: string; peerName?: string }

export type ConnState = "idle" | "connecting" | "connected" | "reconnecting" | "error";
export interface CallEventItem { id: string; text: string; type: "join" | "leave" | "info" }

export interface UseCallOptions {
  code: string;
  me: "admin" | "client";
  autoJoin?: boolean;
  onLeave?: () => void;
  onRoom?: (room: Room | null) => void;
  onConnected?: () => void;
}

const SOLO_TIMEOUT_MS = 180_000; // 3 minutes alone = auto-disconnect

export function useCall({ code, me, autoJoin, onLeave, onRoom, onConnected }: UseCallOptions) {
  const roomRef = useRef<Room | null>(null);
  const audioElsRef = useRef<HTMLAudioElement[]>([]);
  const [state, setState] = useState<ConnState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [remote, setRemote] = useState<string | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  // The other side is recording this call (announced over the data channel).
  const [remoteRecording, setRemoteRecording] = useState(false);
  const [peerName, setPeerName] = useState<string>(me === "admin" ? "them" : "HOS Team");
  const [remoteJoinedAt, setRemoteJoinedAt] = useState<number | null>(null);
  const startAtRef = useRef<number>(0);
  const talkStartRef = useRef<number | null>(null);
  const endEmittedRef = useRef<boolean>(false);
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [events, setEvents] = useState<CallEventItem[]>([]);

  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);
  const [screenTrack, setScreenTrack] = useState<Track | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<Track | null>(null);

  const [localQuality, setLocalQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);
  const [remoteQuality, setRemoteQuality] = useState<ConnectionQuality>(ConnectionQuality.Unknown);

  const addEvent = useCallback((text: string, type: "join" | "leave" | "info") => {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEvents(prev => [...prev.slice(-4), { id, text, type }]);
  }, []);

  const detachAudio = useCallback(() => {
    audioElsRef.current.forEach(el => el.remove());
    audioElsRef.current = [];
  }, []);

  const emitEnded = useCallback(() => {
    if (me !== "admin") return;
    if (endEmittedRef.current || talkStartRef.current === null) return;
    endEmittedRef.current = true;
    const durationSec = Math.max(0, Math.round((Date.now() - talkStartRef.current) / 1000));
    void postJSON("/api/comms/call-event", { code, asRole: me, event: "ended", durationSec }).catch(() => {});
  }, [code, me]);

  const resetMedia = useCallback(() => {
    setRemoteSpeaking(false);
    setLocalSpeaking(false);
    setRemoteMuted(false);
    setRemoteRecording(false);
    setCameraOn(false);
    setScreenOn(false);
    setLocalVideoTrack(null);
    setRemoteVideoTrack(null);
    setScreenTrack(null);
    setRemoteScreenTrack(null);
    setLocalQuality(ConnectionQuality.Unknown);
    setRemoteQuality(ConnectionQuality.Unknown);
  }, []);

  const disconnect = useCallback(() => {
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
    resetMedia();
  }, [emitEnded, detachAudio, onRoom, resetMedia]);

  const connect = useCallback(async () => {
    if (roomRef.current) return;
    setState("connecting");
    setError(null);
    setEvents([]);
    talkStartRef.current = null;
    endEmittedRef.current = false;
    try {
      const data = await postJSON<TokenData>("/api/comms/token", { code, asRole: me });
      if (data.peerName) setPeerName(data.peerName);

      const room = new Room({
        // adaptiveStream downscales received video to the on-screen element size —
        // that's what made screen shares blurry (a 1440p share shown in a smaller
        // tile got a low layer). Off = always deliver full published quality
        // (Discord/Meet behavior), which is what a good connection expects.
        adaptiveStream: false,
        dynacast: true,
        videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        publishDefaults: {
          videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720, VideoPresets.h1080],
          videoCodec: "vp8",
          // Rich audio (music-grade Opus) instead of low speech bitrate — sharper
          // voices and usable shared system/tab audio.
          audioPreset: AudioPresets.musicHighQuality,
          dtx: true,
          red: true,
          // High-quality screen share for crisp text/dashboards.
          screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: 30 },
        },
      });
      roomRef.current = room;

      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        setRemote(p.identity);
        setRemoteJoinedAt(Date.now());
        if (talkStartRef.current === null) talkStartRef.current = Date.now();
        addEvent(`${p.name || p.identity} joined`, "join");
        playJoin();
      });
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        setRemote(null);
        setRemoteJoinedAt(null);
        setRemoteSpeaking(false);
        setRemoteMuted(false);
        setRemoteRecording(false);
        setRemoteVideoTrack(null);
        setRemoteScreenTrack(null);
        setRemoteQuality(ConnectionQuality.Unknown);
        addEvent(`${p.name || p.identity} left`, "leave");
        playLeave();
      });
      room.on(RoomEvent.TrackSubscribed, (track, pub) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach() as HTMLAudioElement;
          el.autoplay = true;
          el.style.display = "none";
          audioElsRef.current.push(el);
          document.body.appendChild(el);
        }
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) setRemoteScreenTrack(track);
          else setRemoteVideoTrack(track);
        }
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, pub: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Video) {
          if (pub.source === Track.Source.ScreenShare) setRemoteScreenTrack(prev => prev === track ? null : prev);
          else setRemoteVideoTrack(prev => prev === track ? null : prev);
        }
      });
      // Native browser "Stop sharing" unpublishes the local screen track.
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
        setLocalSpeaking(speakers.some(s => s === room.localParticipant));
      });
      // Recording notices from the other side (Meet-style consent banner).
      room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        if (!participant || topic !== "recording") return;
        try {
          const { active } = JSON.parse(new TextDecoder().decode(payload)) as { active: boolean };
          setRemoteRecording(prev => {
            if (active && !prev) {
              playRecordingStart();
              toast.info("This call is being recorded.");
            }
            return active;
          });
        } catch { /* ignore */ }
      });
      // Track the remote participant's mic mute so the admin can see when the
      // client mutes (CallStage only surfaces this on the admin side).
      room.on(RoomEvent.TrackMuted, (pub, participant) => {
        if (pub.source === Track.Source.Microphone && participant !== room.localParticipant) setRemoteMuted(true);
      });
      room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
        if (pub.source === Track.Source.Microphone && participant !== room.localParticipant) setRemoteMuted(false);
      });
      room.on(RoomEvent.Reconnecting, () => { setState("reconnecting"); addEvent("Reconnecting…", "info"); });
      room.on(RoomEvent.Reconnected, () => { setState("connected"); addEvent("Reconnected", "info"); });
      room.on(RoomEvent.Disconnected, () => {
        emitEnded();
        detachAudio();
        setState("idle");
        resetMedia();
        playDisconnected();
        onLeave?.();
      });

      await room.connect(data.url, data.token);
      try {
        // Honor saved audio-processing prefs (CallSettings), defaulting to on.
        const pref = (k: string) => { try { const v = localStorage.getItem(k); return v === null ? true : v === "1"; } catch { return true; } };
        await room.localParticipant.setMicrophoneEnabled(true, {
          noiseSuppression: pref("hos_ns"),
          echoCancellation: pref("hos_ec"),
          autoGainControl:  pref("hos_agc"),
        });
      } catch (e) {
        if (isPermissionError(e)) toast.error("Microphone blocked. Allow mic access in your browser's site settings to be heard.");
        else toast.error("Couldn't access your microphone.");
      }

      // Apply saved device preferences (A2 device pipeline).
      try {
        const mic = localStorage.getItem("hos_mic");
        const spk = localStorage.getItem("hos_spk");
        if (mic) await room.switchActiveDevice("audioinput", mic).catch(() => {});
        if (spk) await room.switchActiveDevice("audiooutput", spk).catch(() => {});
      } catch { /* devices not available */ }

      const existing = Array.from(room.remoteParticipants.values())[0];
      if (existing) {
        setRemote(existing.identity);
        setRemoteJoinedAt(Date.now());
        setRemoteMuted(existing.getTrackPublication(Track.Source.Microphone)?.isMuted ?? false);
        if (talkStartRef.current === null) talkStartRef.current = Date.now();
        addEvent(`${existing.name || existing.identity} is here`, "join");
        existing.videoTrackPublications.forEach((pub: RemoteTrackPublication) => {
          if (pub.track && pub.track.kind === Track.Kind.Video) {
            if (pub.source === Track.Source.ScreenShare) setRemoteScreenTrack(pub.track);
            else setRemoteVideoTrack(pub.track);
          }
        });
      }

      startAtRef.current = Date.now();
      setState("connected");
      addEvent(existing ? "You connected" : "Waiting for them to pick up…", "join");
      playConnected();
      onRoom?.(room);
      onConnected?.();
    } catch (e) {
      setError((e as Error).message);
      setState("error");
      roomRef.current = null;
    }
  }, [code, me, addEvent, detachAudio, emitEnded, onConnected, onLeave, onRoom, resetMedia]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track as LocalAudioTrack | undefined;
    if (!track) return;
    playMuteToggle();
    if (muted) { await track.unmute(); setMuted(false); }
    else { await track.mute(); setMuted(true); }
  }, [muted]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    let cam: string | null = null;
    try { cam = localStorage.getItem("hos_cam"); } catch { /* ignore */ }
    try {
      await room.localParticipant.setCameraEnabled(next, cam ? { deviceId: cam } : undefined);
    } catch (e) {
      if (isPermissionError(e)) toast.error("Camera blocked. Allow camera access in your browser's site settings.");
      else toast.error("Couldn't start your camera. Another app may be using it.");
      setCameraOn(false);
      setLocalVideoTrack(null);
      return;
    }
    setCameraOn(next);
    if (next) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      setLocalVideoTrack(pub?.track ?? null);
    } else {
      setLocalVideoTrack(null);
    }
  }, [cameraOn]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next, {
        audio: true,                          // share system / tab audio too
        resolution: VideoPresets.h1440.resolution, // crisp text at 1440p
        contentHint: "detail",
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
  }, [screenOn]);

  // Auto-join
  useEffect(() => {
    if (autoJoin) void connect();
    return () => { disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin, code]);

  // Solo auto-disconnect
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

  // Timestamp the call started counting from — a self-ticking <CallTimer> renders
  // the clock so the whole call tree no longer re-renders every second.
  const startAt = (state === "connected" || state === "reconnecting")
    ? (remoteJoinedAt ?? startAtRef.current) : 0;

  return {
    // state
    state, error, muted, cameraOn, screenOn,
    remote, remoteSpeaking, localSpeaking, remoteMuted, remoteRecording, peerName,
    startAt, events, localQuality, remoteQuality,
    // tracks
    localVideoTrack, remoteVideoTrack, screenTrack, remoteScreenTrack,
    // actions
    connect, disconnect, toggleMute, toggleCamera, toggleScreenShare,
    // refs for CallSettings (mic meter, output volume)
    room: roomRef.current, audioEls: audioElsRef.current,
    inCall: state === "connected" || state === "reconnecting",
  };
}

export type CallApi = ReturnType<typeof useCall>;
