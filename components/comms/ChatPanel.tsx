"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { RoomEvent, type DataPacket_Kind, type Room, type RemoteParticipant } from "livekit-client";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";

type CallEvent = "started" | "ended" | "missed";
interface CallMeta { event: CallEvent; actor_name: string; duration_sec?: number }

interface Message {
  id:          string;
  sender_role: "admin" | "client";
  body:        string;
  kind:        "text" | "call";
  meta:        CallMeta | null;
  created_at:  string;
}

interface Props {
  code:      string;
  me:        "admin" | "client";
  myName?:   string;
  peerName?: string;
  room?:     Room | null;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const RING_WINDOW_MS = 35_000;
const DATA_CHANNEL_TOPIC = "chat";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(sec = 0): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ChatPanel({ code, me, myName = "You", peerName = "HOS Team", room }: Props) {
  const hasRoom = room?.state === "connected";
  const pollInterval = hasRoom ? 10_000 : 2500;

  const { data, mutate } = useSWR<{ ok: boolean; data: { messages: Message[] } }>(
    `/api/comms/messages?code=${code}&asRole=${me}`,
    fetcher,
    { refreshInterval: pollInterval }
  );
  const serverMessages = useMemo(() => (data?.ok ? data.data.messages : []), [data]);

  // Optimistic messages: shown immediately, reconciled on next poll
  const [optimistic, setOptimistic] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Data-channel incoming messages: merged with server messages
  const [dcMessages, setDcMessages] = useState<Message[]>([]);

  // Merge: server messages are authoritative; DC and optimistic fill the gap.
  const messages = useMemo(() => {
    const serverIds = new Set(serverMessages.map(m => m.id));
    // DC messages not yet reflected in the server poll
    const unsyncedDc = dcMessages.filter(m => !serverIds.has(m.id));
    // Optimistic messages not yet reflected anywhere
    const unsyncedOpt = optimistic.filter(
      m => !serverIds.has(m.id) && !unsyncedDc.some(d => d.id === m.id)
    );
    return [...serverMessages, ...unsyncedDc, ...unsyncedOpt];
  }, [serverMessages, dcMessages, optimistic]);

  // Clean up optimistic + DC once server catches up
  useEffect(() => {
    if (serverMessages.length === 0) return;
    const serverIds = new Set(serverMessages.map(m => m.id));
    setOptimistic(prev => prev.filter(m => !serverIds.has(m.id)));
    setDcMessages(prev => prev.filter(m => !serverIds.has(m.id)));
  }, [serverMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // ── LiveKit data channel: receive ──
  useEffect(() => {
    if (!room || room.state !== "connected") return;

    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (topic !== DATA_CHANNEL_TOPIC || !participant) return;
      try {
        const msg: Message = JSON.parse(new TextDecoder().decode(payload));
        setDcMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch { /* ignore non-JSON payloads */ }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);

  const nameFor = (role: "admin" | "client") => (role === me ? myName : peerName);

  const send = useCallback(async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");

    // Optimistic: show immediately
    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optMsg: Message = {
      id: optId,
      sender_role: me,
      body,
      kind: "text",
      meta: null,
      created_at: new Date().toISOString(),
    };
    setOptimistic(prev => [...prev, optMsg]);

    try {
      const res = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, body, asRole: me }),
      });
      const j = await res.json();
      if (j.ok) {
        const saved: Message = j.data.message;
        // Replace optimistic with real message
        setOptimistic(prev => prev.filter(m => m.id !== optId));

        // Broadcast via data channel if in-call
        if (room?.state === "connected") {
          const payload = new TextEncoder().encode(JSON.stringify(saved));
          try {
            void room.localParticipant.publishData(payload, {
              topic: DATA_CHANNEL_TOPIC,
              reliable: true,
            });
          } catch { /* data channel best-effort */ }
        }

        await mutate();
      }
    } catch {
      // Revert optimistic on failure
      setOptimistic(prev => prev.filter(m => m.id !== optId));
    } finally {
      setSending(false);
    }
  }, [text, sending, me, code, room, mutate]);

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      display: "flex", flexDirection: "column", height: 420,
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
        fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span>Messages · {code}</span>
        {hasRoom && (
          <span style={{
            fontSize: 9, color: GREEN, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%", background: GREEN,
              display: "inline-block",
            }} />
            LIVE
          </span>
        )}
      </div>

      <div ref={listRef} style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
            No messages yet.
          </div>
        )}
        {messages.map((m, i) => {
          if (m.kind === "call") {
            return <CallRow key={m.id} m={m} rest={messages.slice(i + 1)} />;
          }
          const mine = m.sender_role === me;
          const name = nameFor(m.sender_role);
          const isOptimistic = m.id.startsWith("opt-");
          return (
            <div key={m.id} style={{
              display: "flex", flexDirection: mine ? "row-reverse" : "row",
              alignItems: "flex-end", gap: 8,
              opacity: isOptimistic ? 0.6 : 1,
              transition: "opacity 200ms",
            }}>
              <Avatar name={name} role={m.sender_role} />
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10, color: MUTED, margin: "0 4px 3px", display: "flex", gap: 6 }}>
                  <span style={{ fontWeight: 600, color: mine ? GOLD : TEXT, opacity: 0.85 }}>{name}</span>
                  <span>{fmtClock(m.created_at)}</span>
                </div>
                <div style={{
                  background: mine ? GOLD : SURF_2,
                  color: mine ? BG : TEXT,
                  padding: "8px 12px", borderRadius: 10,
                  fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{m.body}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${BORDER}` }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Type a message…"
          style={{
            flex: 1, background: SURF_2, border: `1px solid ${BORDER}`,
            borderRadius: 8, padding: "10px 12px", color: TEXT, fontSize: 14,
            fontFamily: "var(--font-body)",
          }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          style={{
            padding: "0 18px", borderRadius: 8, background: TEXT, color: BG,
            border: "none", fontWeight: 600, cursor: text.trim() ? "pointer" : "not-allowed",
            opacity: text.trim() && !sending ? 1 : 0.4,
          }}
        >Send</button>
      </div>
    </div>
  );
}

function Avatar({ name, role }: { name: string; role: "admin" | "client" }) {
  const bg = role === "admin" ? "rgba(139,107,62,0.9)" : "#3A3A3A";
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: bg, color: role === "admin" ? "#111" : TEXT,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
      fontFamily: "var(--font-ui)",
    }}>{initials(name)}</div>
  );
}

function CallRow({ m, rest }: { m: Message; rest: Message[] }) {
  const meta = m.meta;
  if (!meta) return null;

  let label: string;
  let icon: string;
  let color: string;

  if (meta.event === "ended") {
    label = `Call ended · ${fmtDuration(meta.duration_sec)}`;
    icon  = "✓"; color = GREEN;
  } else {
    const nextStartedIdx = rest.findIndex(r => r.kind === "call" && r.meta?.event === "started");
    const window = nextStartedIdx === -1 ? rest : rest.slice(0, nextStartedIdx);
    const answered = window.some(r => r.kind === "call" && r.meta?.event === "ended");
    const stale = Date.now() - new Date(m.created_at).getTime() > RING_WINDOW_MS;

    if (answered)      { label = `${meta.actor_name} started a call`; icon = "📞"; color = MUTED; }
    else if (meta.event === "missed" || stale) { label = "Missed call"; icon = "✕"; color = RED; }
    else               { label = `${meta.actor_name} is calling…`;     icon = "📞"; color = GOLD; }
  }

  return (
    <div style={{
      alignSelf: "center", display: "flex", alignItems: "center", gap: 8,
      padding: "5px 12px", borderRadius: 20,
      background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
      fontSize: 12, color,
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ color: MUTED, opacity: 0.7 }}>{fmtClock(m.created_at)}</span>
    </div>
  );
}
