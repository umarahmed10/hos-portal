"use client";
// Discord-style Voice & Video settings — one gear popover replacing the separate
// volume + device buttons. Mic/speaker/camera pickers, live mic meter, output
// volume, and noise-suppression / echo-cancel / auto-gain toggles. Choices
// persist and apply to the live LiveKit room.
import { useCallback, useEffect, useRef, useState } from "react";
import { Track, type Room } from "livekit-client";
import { SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN } from "@/lib/styles";

type Kind = "audioinput" | "videoinput" | "audiooutput";
const LS = { audioinput: "hos_mic", videoinput: "hos_cam", audiooutput: "hos_spk" } as const;
const load = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const loadBool = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === "1"; } catch { return d; } };

interface Props { room: Room | null; audioEls: HTMLAudioElement[] }

export function CallSettings({ room, audioEls }: Props) {
  const [open, setOpen] = useState(false);
  const [devs, setDevs] = useState<Record<Kind, MediaDeviceInfo[]>>({ audioinput: [], videoinput: [], audiooutput: [] });
  const [sel, setSel] = useState<Record<Kind, string>>({ audioinput: "", videoinput: "", audiooutput: "" });
  const [outVol, setOutVol] = useState(100);
  const [level, setLevel] = useState(0);
  const [ns, setNs] = useState(true);
  const [ec, setEc] = useState(true);
  const [agc, setAgc] = useState(true);
  const rafRef = useRef<number | null>(null);
  const acRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSel({ audioinput: load("hos_mic", ""), videoinput: load("hos_cam", ""), audiooutput: load("hos_spk", "") });
    setNs(loadBool("hos_ns", true)); setEc(loadBool("hos_ec", true)); setAgc(loadBool("hos_agc", true));
    setOutVol(Number(load("hos_out_vol", "100")));
  }, []);

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

  // Live mic meter while the panel is open.
  useEffect(() => {
    if (!open || !room) return;
    const mst = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
    if (!mst) return;
    let cancelled = false;
    try {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      acRef.current = ac;
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      ac.createMediaStreamSource(new MediaStream([mst])).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(data);
        setLevel(Math.min(1, (data.reduce((a, b) => a + b, 0) / data.length) / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* no audio */ }
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); acRef.current?.close().catch(() => {}); acRef.current = null; };
  }, [open, room]);

  async function pickDevice(kind: Kind, id: string) {
    setSel(s => ({ ...s, [kind]: id }));
    save(LS[kind], id);
    try { await room?.switchActiveDevice(kind, id); } catch { /* busy */ }
  }

  function setVolume(v: number) {
    setOutVol(v);
    save("hos_out_vol", String(v));
    audioEls.forEach(el => { el.volume = v / 100; });
  }

  async function applyProcessing(next: { ns?: boolean; ec?: boolean; agc?: boolean }) {
    const n = next.ns ?? ns, e = next.ec ?? ec, a = next.agc ?? agc;
    if (next.ns !== undefined) { setNs(n); save("hos_ns", n ? "1" : "0"); }
    if (next.ec !== undefined) { setEc(e); save("hos_ec", e ? "1" : "0"); }
    if (next.agc !== undefined) { setAgc(a); save("hos_agc", a ? "1" : "0"); }
    try {
      await room?.localParticipant.setMicrophoneEnabled(true, { noiseSuppression: n, echoCancellation: e, autoGainControl: a });
    } catch { /* re-acquire failed */ }
  }

  const devLabel = (kind: Kind, d: MediaDeviceInfo, i: number) =>
    d.label || `${kind === "videoinput" ? "Camera" : kind === "audiooutput" ? "Speaker" : "Microphone"} ${i + 1}`;

  const Select = (kind: Kind) => (
    <select value={sel[kind]} onChange={e => pickDevice(kind, e.target.value)}
      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: SURF_2, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 12, fontFamily: "var(--font-body)", cursor: "pointer" }}>
      {devs[kind].length === 0 && <option value="">System default</option>}
      {devs[kind].map((d, i) => <option key={d.deviceId} value={d.deviceId}>{devLabel(kind, d, i)}</option>)}
    </select>
  );

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Voice & video settings" title="Settings"
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
        style={{ width: 44, height: 44, borderRadius: 12, background: SURF_2, color: TEXT, border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 140ms" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", bottom: 54, left: "50%", transform: "translateX(-50%)", zIndex: 41, width: 320, maxHeight: "70vh", overflowY: "auto", background: SURF, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.55)", animation: "fadeIn 160ms ease-out" }}>
            <Section title="Voice">
              <Field label="Input device">{Select("audioinput")}</Field>
              <div style={{ height: 6, borderRadius: 3, background: SURF_2, overflow: "hidden", margin: "6px 0 12px" }}>
                <div style={{ height: "100%", width: `${Math.round(level * 100)}%`, background: GREEN, transition: "width 80ms linear" }} />
              </div>
              <Field label="Output device">{Select("audiooutput")}</Field>
              <Field label={`Output volume — ${outVol}%`}>
                <input type="range" min={0} max={100} value={outVol} onChange={e => setVolume(Number(e.target.value))}
                  style={{ width: "100%", accentColor: GOLD, cursor: "pointer" }} />
              </Field>
            </Section>

            <Section title="Video">
              <Field label="Camera">{Select("videoinput")}</Field>
            </Section>

            <Section title="Processing" last>
              <Toggle label="Noise suppression" on={ns} onChange={v => applyProcessing({ ns: v })} />
              <Toggle label="Echo cancellation" on={ec} onChange={v => applyProcessing({ ec: v })} />
              <Toggle label="Automatic gain control" on={agc} onChange={v => applyProcessing({ agc: v })} />
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 16, paddingBottom: last ? 0 : 14, borderBottom: last ? "none" : `1px solid ${BORDER}` }}>
      <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, fontFamily: "var(--font-mono)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: "7px 0" }}>
      <span style={{ fontSize: 12, color: TEXT, fontFamily: "var(--font-body)" }}>{label}</span>
      <span style={{ width: 38, height: 22, borderRadius: 11, background: on ? GREEN : SURF_2, border: `1px solid ${on ? GREEN : BORDER}`, position: "relative", transition: "background 160ms", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 160ms var(--ease-spring, ease)" }} />
      </span>
    </button>
  );
}
