"use client";
// Device pipeline (A2): mic / camera / speaker selectors + a live mic level meter,
// applied to the live LiveKit room via switchActiveDevice and persisted so the
// next call reuses them. Rendered as a gear popover in the call control bar.
import { useCallback, useEffect, useRef, useState } from "react";
import { Track, type Room } from "livekit-client";
import { SURF, SURF_2, BORDER, TEXT, MUTED, GREEN } from "@/lib/styles";

type Kind = "audioinput" | "videoinput" | "audiooutput";
const LS = { audioinput: "hos_mic", videoinput: "hos_cam", audiooutput: "hos_spk" } as const;

export function saveDevice(kind: Kind, id: string) { try { localStorage.setItem(LS[kind], id); } catch { /* ignore */ } }
export function loadDevice(kind: Kind): string { try { return localStorage.getItem(LS[kind]) ?? ""; } catch { return ""; } }

export function DeviceSettings({ room }: { room: Room | null }) {
  const [open, setOpen] = useState(false);
  const [devs, setDevs] = useState<Record<Kind, MediaDeviceInfo[]>>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [sel, setSel] = useState<Record<Kind, string>>({ audioinput: loadDevice("audioinput"), videoinput: loadDevice("videoinput"), audiooutput: loadDevice("audiooutput") });
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const acRef = useRef<AudioContext | null>(null);

  const enumerate = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevs({
        audioinput: all.filter(d => d.kind === "audioinput"),
        videoinput: all.filter(d => d.kind === "videoinput"),
        audiooutput: all.filter(d => d.kind === "audiooutput"),
      });
    } catch { /* permissions not granted yet */ }
  }, []);

  useEffect(() => { if (open) void enumerate(); }, [open, enumerate]);

  // Live mic level meter while the panel is open.
  useEffect(() => {
    if (!open || !room) return;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const mst = pub?.track?.mediaStreamTrack;
    if (!mst) return;
    let cancelled = false;
    try {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(new MediaStream([mst]));
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setLevel(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* audio not available */ }
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      acRef.current?.close().catch(() => {});
      acRef.current = null;
    };
  }, [open, room]);

  async function pick(kind: Kind, id: string) {
    setSel(s => ({ ...s, [kind]: id }));
    saveDevice(kind, id);
    if (!room) return;
    try { await room.switchActiveDevice(kind, id); } catch { /* device busy */ }
  }

  const label = (kind: Kind, d: MediaDeviceInfo, i: number) =>
    d.label || `${kind === "videoinput" ? "Camera" : kind === "audiooutput" ? "Speaker" : "Microphone"} ${i + 1}`;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Device settings" title="Devices"
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
        style={{
          width: 44, height: 44, borderRadius: 12, background: SURF_2, color: TEXT, border: `1px solid ${BORDER}`,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 140ms",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)", zIndex: 41,
            width: 280, background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)", animation: "fadeIn 160ms ease-out",
          }}>
            <Row label="Microphone">
              <Select value={sel.audioinput} options={devs.audioinput} onChange={id => pick("audioinput", id)} render={label} kind="audioinput" />
            </Row>
            {/* mic meter */}
            <div style={{ height: 6, borderRadius: 3, background: SURF_2, overflow: "hidden", margin: "2px 0 12px" }}>
              <div style={{ height: "100%", width: `${Math.round(level * 100)}%`, background: GREEN, transition: "width 80ms linear" }} />
            </div>
            <Row label="Speaker">
              <Select value={sel.audiooutput} options={devs.audiooutput} onChange={id => pick("audiooutput", id)} render={label} kind="audiooutput" />
            </Row>
            <Row label="Camera">
              <Select value={sel.videoinput} options={devs.videoinput} onChange={id => pick("videoinput", id)} render={label} kind="videoinput" />
            </Row>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, fontFamily: "var(--font-mono)", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Select({ value, options, onChange, render, kind }: {
  value: string; options: MediaDeviceInfo[]; onChange: (id: string) => void;
  render: (kind: Kind, d: MediaDeviceInfo, i: number) => string; kind: Kind;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 8, background: SURF_2,
        border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12, fontFamily: "var(--font-body)", cursor: "pointer",
      }}
    >
      {options.length === 0 && <option value="">System default</option>}
      {options.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{render(kind, d, i)}</option>)}
    </select>
  );
}
