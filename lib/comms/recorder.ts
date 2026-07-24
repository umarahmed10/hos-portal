"use client";
// Call recording (admin-only, Google Meet style).
//
// Records on the admin's machine: remote screen/camera composited onto a 1080p
// canvas (PiP for the camera during screen shares), both sides' audio mixed via
// Web Audio, encoded with MediaRecorder (VP9 6 Mbps + Opus 192 kbps preferred)
// and saved as a local download on stop — no server storage limits, full quality.
//
// The other participant is ALWAYS notified: a reliable data-channel message on
// topic "recording" fires on start/stop and re-broadcasts when someone joins
// mid-recording (see useCall's listener → banner + toast + sound).
import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteParticipant } from "livekit-client";
import { toast } from "sonner";
import { playRecordingStart, playRecordingStop } from "@/lib/comms/sounds";

export const RECORDING_TOPIC = "recording";

const W = 1920, H = 1080, FPS = 30;

function pickMime(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

// Draw a video into a rect. contain = letterbox (screens); cover = fill (cameras).
function drawFit(ctx: CanvasRenderingContext2D, el: HTMLVideoElement, x: number, y: number, w: number, h: number, mode: "contain" | "cover") {
  const vw = el.videoWidth, vh = el.videoHeight;
  if (!vw || !vh) return;
  const scale = mode === "contain" ? Math.min(w / vw, h / vh) : Math.max(w / vw, h / vh);
  const dw = vw * scale, dh = vh * scale;
  const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
  if (mode === "cover") {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(el, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.drawImage(el, dx, dy, dw, dh);
  }
}

interface Recorder {
  recording: boolean;
  seconds: number;
  start: () => void;
  stop: () => void;
}

export function useCallRecorder(room: Room | null, code: string): Recorder {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cleanupRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<Room | null>(room);
  roomRef.current = room;

  const broadcast = useCallback((active: boolean) => {
    const r = roomRef.current;
    if (!r || r.state !== "connected") return;
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ active }));
      void r.localParticipant.publishData(payload, { topic: RECORDING_TOPIC, reliable: true });
    } catch { /* best-effort */ }
  }, []);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    recRef.current = null;
    try { rec.stop(); } catch { /* already stopped */ }
    // Finalization happens in rec.onstop (needs the last dataavailable chunk).
    setRecording(false);
    broadcast(false);
    playRecordingStop();
  }, [broadcast]);

  const start = useCallback(() => {
    const r = roomRef.current;
    if (!r || r.state !== "connected" || recRef.current) return;

    const mime = pickMime();
    if (!mime || typeof MediaRecorder === "undefined") {
      toast.error("Recording isn't supported in this browser.");
      return;
    }

    try {
      // ── Audio: mix local mic + every remote audio track ──
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const dest = ac.createMediaStreamDestination();
      const addedAudio = new Set<string>();
      const addAudio = (mst: MediaStreamTrack | undefined) => {
        if (!mst || addedAudio.has(mst.id)) return;
        addedAudio.add(mst.id);
        try { ac.createMediaStreamSource(new MediaStream([mst])).connect(dest); } catch { /* dead track */ }
      };
      addAudio(r.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack);
      r.remoteParticipants.forEach(p => p.audioTrackPublications.forEach(pub => addAudio(pub.track?.mediaStreamTrack)));

      // ── Video: hidden <video> elements per source, refreshed on room events ──
      const els: { remoteScreen: HTMLVideoElement | null; remoteCam: HTMLVideoElement | null; localCam: HTMLVideoElement | null } = {
        remoteScreen: null, remoteCam: null, localCam: null,
      };
      const attached: HTMLVideoElement[] = [];
      const mkEl = (track: Track | undefined | null): HTMLVideoElement | null => {
        if (!track) return null;
        const el = document.createElement("video");
        el.muted = true;
        el.playsInline = true;
        track.attach(el);
        void el.play().catch(() => {});
        attached.push(el);
        return el;
      };
      const syncEl = (key: keyof typeof els, track: Track | null | undefined) => {
        if (!track) { els[key] = null; return; }
        const tid = track.sid ?? track.mediaStreamTrack?.id ?? "";
        if (els[key]?.dataset.tid === tid) return; // same track, keep element
        const el = mkEl(track);
        if (el) el.dataset.tid = tid;
        els[key] = el;
      };
      const refresh = () => {
        const rr = roomRef.current;
        if (!rr) return;
        const remote = Array.from(rr.remoteParticipants.values())[0] as RemoteParticipant | undefined;
        syncEl("remoteScreen", remote?.getTrackPublication(Track.Source.ScreenShare)?.track);
        syncEl("remoteCam",    remote?.getTrackPublication(Track.Source.Camera)?.track);
        syncEl("localCam",     rr.localParticipant.getTrackPublication(Track.Source.Camera)?.track);
        // New remote audio tracks (e.g. shared tab audio) join the mix too.
        rr.remoteParticipants.forEach(p => p.audioTrackPublications.forEach(pub => addAudio(pub.track?.mediaStreamTrack)));
      };
      refresh();
      const onTrackChange = () => refresh();
      r.on(RoomEvent.TrackSubscribed, onTrackChange);
      r.on(RoomEvent.TrackUnsubscribed, onTrackChange);
      r.on(RoomEvent.LocalTrackPublished, onTrackChange);
      r.on(RoomEvent.LocalTrackUnpublished, onTrackChange);

      // Late joiners must also learn the call is being recorded.
      const onJoin = () => setTimeout(() => broadcast(true), 800);
      r.on(RoomEvent.ParticipantConnected, onJoin);

      // ── Composite loop (setInterval, NOT rAF — keeps running if tab is hidden) ──
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const drawTimer = setInterval(() => {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        const main = (els.remoteScreen?.videoWidth ? els.remoteScreen : null)
          ?? (els.remoteCam?.videoWidth ? els.remoteCam : null)
          ?? (els.localCam?.videoWidth ? els.localCam : null);
        if (main) drawFit(ctx, main, 0, 0, W, H, main === els.remoteScreen ? "contain" : "cover");
        // PiP: camera over a screen share; local camera over a remote camera.
        const pip = main === els.remoteScreen
          ? (els.remoteCam?.videoWidth ? els.remoteCam : els.localCam)
          : main === els.remoteCam ? els.localCam : null;
        if (pip?.videoWidth) {
          const pw = 384, ph = 216, m = 24;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 24;
          ctx.fillStyle = "#111"; ctx.fillRect(W - pw - m, H - ph - m, pw, ph);
          ctx.restore();
          drawFit(ctx, pip, W - pw - m, H - ph - m, pw, ph, "cover");
        }
      }, Math.round(1000 / FPS));

      // ── Encode ──
      const stream = canvas.captureStream(FPS);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 192_000,
      });
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        cleanupRef.current?.();
        cleanupRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime.split(";")[0] });
        chunksRef.current = [];
        if (blob.size === 0) return;
        const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
        const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `HOS-call-${code}-${stamp}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
        toast.success("Recording saved to your downloads.");
      };
      rec.start(1000);
      recRef.current = rec;

      const startedAt = Date.now();
      setSeconds(0);
      const secTimer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);

      cleanupRef.current = () => {
        clearInterval(drawTimer);
        clearInterval(secTimer);
        r.off(RoomEvent.TrackSubscribed, onTrackChange);
        r.off(RoomEvent.TrackUnsubscribed, onTrackChange);
        r.off(RoomEvent.LocalTrackPublished, onTrackChange);
        r.off(RoomEvent.LocalTrackUnpublished, onTrackChange);
        r.off(RoomEvent.ParticipantConnected, onJoin);
        attached.forEach(el => { el.srcObject = null; el.remove(); });
        void ac.close().catch(() => {});
      };

      setRecording(true);
      broadcast(true);
      playRecordingStart();
      toast.info("Recording — the other participant has been notified.");
    } catch (err) {
      console.error("[recorder] start failed:", err);
      toast.error("Couldn't start the recording.");
    }
  }, [broadcast, code]);

  // If the call ends while recording, finalize and save what we have.
  useEffect(() => {
    if (!room && recRef.current) stop();
  }, [room, stop]);

  return { recording, seconds, start, stop };
}
