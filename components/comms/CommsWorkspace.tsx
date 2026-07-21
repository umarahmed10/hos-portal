"use client";
// Discord-style comms surface: idle shows the chat with call-start buttons in a
// header; in a call the media STAGE takes over with a collapsible chat rail and
// a floating control bar. Responsive: on narrow screens the chat rail stacks
// under the stage. Both admin and client render this; hosts add their chrome.
import { useEffect, useRef, useState } from "react";
import type { Room } from "livekit-client";
import { useCall } from "@/components/comms/useCall";
import { CallStage, NetBars } from "@/components/comms/CallStage";
import { ChatPanel } from "@/components/comms/ChatPanel";
import { VolumeControls } from "@/components/comms/VolumeControls";
import { DeviceSettings } from "@/components/comms/DeviceSettings";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import { playRingtone } from "@/lib/comms/sounds";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";

interface Props {
  code: string;
  me: "admin" | "client";
  myName: string;
  peerName: string;
  autoJoin?: boolean;
  onConnected?: () => void;
  onLeave?: () => void;
  onRoom?: (room: Room | null) => void;
}

export function CommsWorkspace({ code, me, myName, peerName, autoJoin, onConnected, onLeave, onRoom }: Props) {
  const call = useCall({ code, me, autoJoin, onConnected, onLeave, onRoom });
  const [chatOpen, setChatOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [incoming, setIncoming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const ringStopRef = useRef<(() => void) | null>(null);

  const { state, inCall, seconds, remote, remoteSpeaking, peerName: livePeer, localQuality, remoteQuality, error } = call;
  const shownPeer = livePeer && livePeer !== "them" ? livePeer : peerName;
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!fullscreen) { setControlsVisible(true); return; }
    let t: ReturnType<typeof setTimeout>;
    const poke = () => { setControlsVisible(true); clearTimeout(t); t = setTimeout(() => setControlsVisible(false), 3500); };
    poke();
    window.addEventListener("mousemove", poke);
    return () => { clearTimeout(t); window.removeEventListener("mousemove", poke); };
  }, [fullscreen]);

  // Esc exits fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Incoming-call detection via LiveKit room presence — an open page reliably
  // hears a call without depending on push. If the peer is sitting in the room
  // and we haven't joined, we're being rung.
  useEffect(() => {
    if (inCall || state === "connecting") { setIncoming(false); return; }
    let stop = false;
    const poll = async () => {
      if (stop || document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/comms/call-state?code=${code}&asRole=${me}`);
        const j = await r.json();
        if (!stop && j.ok) setIncoming(!!j.data.ringing);
      } catch { /* ignore */ }
    };
    void poll();
    const t = setInterval(poll, 3000);
    return () => { stop = true; clearInterval(t); };
  }, [inCall, state, code, me]);

  useEffect(() => { if (!incoming) setDismissed(false); }, [incoming]);

  const showIncoming = incoming && !dismissed && !inCall;

  // Ringtone + haptics while an incoming call is pulsing.
  useEffect(() => {
    if (showIncoming) {
      ringStopRef.current = playRingtone();
      navigator.vibrate?.([400, 200, 400, 200, 600]);
    }
    return () => { ringStopRef.current?.(); ringStopRef.current = null; navigator.vibrate?.(0); };
  }, [showIncoming]);

  const chat = (
    <ChatPanel code={code} me={me} myName={myName} peerName={shownPeer} room={call.room} />
  );

  const statusLabel =
    state === "connecting" ? "RTC Connecting…" :
    state === "reconnecting" ? "Reconnecting…" :
    remote ? (remoteSpeaking ? `${shownPeer} speaking` : "Voice Connected") :
    "Calling…";

  const controlBar = (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 14px", animation: "barUp 260ms ease-out" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        background: "rgba(22,22,22,0.92)", border: `1px solid ${BORDER}`, borderRadius: 999,
        boxShadow: "0 8px 30px rgba(0,0,0,0.45)", backdropFilter: "blur(10px)",
      }}>
        <CtrlBtn label={call.muted ? "Unmute" : "Mute"} active={!call.muted} danger={call.muted} onClick={call.toggleMute} disabled={state === "reconnecting"}>
          {call.muted ? <MicOff /> : <Mic />}
        </CtrlBtn>
        <CtrlBtn label={call.cameraOn ? "Stop video" : "Start video"} active={call.cameraOn} onClick={call.toggleCamera} disabled={state === "reconnecting"}>
          <Cam />
        </CtrlBtn>
        <CtrlBtn label={call.screenOn ? "Stop share" : "Share screen"} active={call.screenOn} onClick={call.toggleScreenShare} disabled={state === "reconnecting"}>
          <Screen />
        </CtrlBtn>
        <VolumeControls room={call.room} audioEls={call.audioEls} />
        <DeviceSettings room={call.room} />
        <CtrlBtn label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => setFullscreen(f => !f)}>
          {fullscreen ? <Minimize /> : <Maximize />}
        </CtrlBtn>
        <CtrlBtn label={chatOpen ? "Hide chat" : "Show chat"} active={chatOpen} onClick={() => setChatOpen(o => !o)}>
          <ChatIcon />
        </CtrlBtn>
        <span style={{ width: 1, height: 24, background: BORDER, margin: "0 2px" }} />
        <CtrlBtn label="Leave call" danger onClick={call.disconnect}>
          <PhoneOff />
        </CtrlBtn>
      </div>
    </div>
  );

  const stageHeader = (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
      borderBottom: `1px solid ${BORDER}`, background: "#0F0F0F", flexShrink: 0,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: state === "reconnecting" ? GOLD : GREEN, animation: state === "reconnecting" ? "pulse 1s infinite" : undefined }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{statusLabel}</span>
      <NetBars quality={localQuality} />
      {remote && <NetBars quality={remoteQuality} />}
      <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-mono)", color: MUTED, letterSpacing: "0.06em" }}>{mm}:{ss}</span>
    </div>
  );

  // ── Fullscreen immersive stage (chat available as a slide-over rail) ──
  if (inCall && fullscreen) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9500, background: "#000", display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ opacity: controlsVisible ? 1 : 0, transition: "opacity 300ms", pointerEvents: controlsVisible ? "auto" : "none" }}>
            {stageHeader}
          </div>
          <CallStage call={call} me={me} />
          <div style={{
            opacity: controlsVisible ? 1 : 0, transition: "opacity 300ms",
            pointerEvents: controlsVisible ? "auto" : "none",
            background: "rgba(12,12,12,0.9)", borderTop: `1px solid ${BORDER}`,
          }}>
            {controlBar}
          </div>
        </div>
        {chatOpen && (
          <aside style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, minHeight: 0, display: "flex", background: BG, animation: "railIn 240ms ease-out" }}>
            {chat}
          </aside>
        )}
      </div>
    );
  }

  // ── In-call: stage + chat rail ──
  if (inCall) {
    return (
      <div className="comms-ws" style={{ flex: 1, width: "100%", minWidth: 0, display: "flex", height: "100%", minHeight: 0, background: "#0A0A0A" }}>
        <div className="comms-ws-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {stageHeader}
          <CallStage call={call} me={me} />
          <div style={{ flexShrink: 0, background: "#0A0A0A" }}>
            {controlBar}
          </div>
        </div>
        {chatOpen && (
          <aside className="comms-ws-chat" style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, minHeight: 0, display: "flex", background: BG, animation: "railIn 240ms ease-out" }}>
            {chat}
          </aside>
        )}
        <style>{`
          @keyframes barUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes railIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
          @media (max-width: 820px) {
            .comms-ws { flex-direction: column; }
            .comms-ws-chat { width: 100% !important; border-left: none !important; border-top: 1px solid ${BORDER}; min-height: 240px; }
          }
        `}</style>
      </div>
    );
  }

  // ── Incoming call — Discord-style: stage activates, caller avatar pulses ──
  if (showIncoming) {
    const callerName = me === "client" ? "HOS Team" : shownPeer;
    const callerIsAdmin = me === "client";
    const callerInitials = callerName.trim().split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";
    return (
      <div className="comms-ws" style={{ flex: 1, width: "100%", minWidth: 0, display: "flex", height: "100%", minHeight: 0, background: "#0A0A0A" }}>
        <div className="comms-ws-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, alignItems: "center", justifyContent: "center", gap: 26, padding: 24 }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: "0.24em", textTransform: "uppercase", fontFamily: "var(--font-mono)", animation: "fadeIn 300ms ease-out" }}>
            Incoming call
          </div>
          <div style={{ position: "relative", width: 128, height: 128, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${GREEN}`, animation: "ringPulse 1.5s ease-out infinite" }} />
            <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `2px solid ${GREEN}`, animation: "ringPulse 1.5s ease-out infinite 0.5s" }} />
            <div style={{
              width: 108, height: 108, borderRadius: "50%", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#161616", filter: "brightness(0.72)", animation: "callerBob 1.5s ease-in-out infinite",
            }}>
              {callerIsAdmin
                ? <HOSTeamAvatar size={92} />
                : <div style={{ width: 92, height: 92, borderRadius: "50%", background: "#2E2E2E", color: TEXT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, fontFamily: "var(--font-ui)" }}>{callerInitials}</div>}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: TEXT, fontFamily: "var(--font-ui)" }}>{callerName}</div>
          <div style={{ fontSize: 13, color: MUTED }}>is calling you…</div>
          <div style={{ display: "flex", gap: 26, marginTop: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setDismissed(true); }} aria-label="Decline"
                style={{ width: 62, height: 62, borderRadius: "50%", background: RED, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(201,106,106,0.4)" }}>
                <PhoneOff />
              </button>
              <span style={{ fontSize: 11, color: MUTED }}>Decline</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setIncoming(false); void call.connect(); }} aria-label="Accept"
                style={{ width: 62, height: 62, borderRadius: "50%", background: GREEN, color: "#0A0A0A", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 20px rgba(78,173,135,0.45)", animation: "acceptBob 1.6s ease-in-out infinite" }}>
                <Phone />
              </button>
              <span style={{ fontSize: 11, color: MUTED }}>Accept</span>
            </div>
          </div>
        </div>
        {chatOpen && (
          <aside className="comms-ws-chat" style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, minHeight: 0, display: "flex", background: BG }}>
            {chat}
          </aside>
        )}
        <style>{`
          @keyframes ringPulse { 0% { transform: scale(0.85); opacity: 0.9; } 100% { transform: scale(1.35); opacity: 0; } }
          @keyframes callerBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
          @keyframes acceptBob { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @media (max-width: 820px) { .comms-ws { flex-direction: column; } .comms-ws-chat { width: 100% !important; border-left: none !important; border-top: 1px solid ${BORDER}; min-height: 240px; } }
        `}</style>
      </div>
    );
  }

  // ── Idle: chat + call-start header (Discord DM header) ──
  return (
    <div style={{ flex: 1, width: "100%", minWidth: 0, display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: BG }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        borderBottom: `1px solid ${BORDER}`, background: SURF, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Direct line
        </span>
        <button
          onClick={call.connect}
          title={me === "admin" ? "Start a call — rings them" : "Start a call with the HOS team"}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 18px rgba(78,173,135,0.28)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            padding: "9px 20px", borderRadius: 10, background: GREEN, color: "#0A0A0A",
            border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 13,
            transition: "transform 140ms, box-shadow 140ms",
          }}
        >
          <Phone />
          <span>Call</span>
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: RED, padding: "8px 16px" }}>{error}</div>}
      {state === "connecting" && (
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10, color: MUTED, fontSize: 12 }}>
          <span style={{ width: 14, height: 14, border: `2px solid ${BORDER}`, borderTopColor: GREEN, borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} />
          RTC Connecting…
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
        {chat}
      </div>
    </div>
  );
}

function CtrlBtn({ children, label, active, danger, onClick, disabled }: {
  children: React.ReactNode; label: string; active?: boolean; danger?: boolean; onClick: () => void; disabled?: boolean;
}) {
  let bg = SURF_2, color = TEXT, border = `1px solid ${BORDER}`;
  if (danger) { bg = RED; color = "#fff"; border = "none"; }
  else if (active) { bg = "rgba(78,173,135,0.14)"; color = GREEN; border = `1px solid rgba(78,173,135,0.3)`; }
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} title={label}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
      style={{
        width: 44, height: 44, borderRadius: 12, background: bg, color, border,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 140ms var(--ease-spring, ease), background 140ms, color 140ms",
      }}
    >{children}</button>
  );
}

/* icons */
function Phone() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>; }
function PhoneOff() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" /><line x1="23" y1="1" x2="1" y2="23" /></svg>; }
function Mic() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>; }
function MicOff() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" /><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .87-.16 1.7-.45 2.47" /><line x1="12" y1="19" x2="12" y2="23" /></svg>; }
function Cam() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>; }
function Screen() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>; }
function ChatIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>; }
function Maximize() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" /></svg>; }
function Minimize() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></svg>; }
