"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { RoomEvent, type DataPacket_Kind, type Room, type RemoteParticipant } from "livekit-client";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { playSend, playReceive } from "@/lib/comms/sounds";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";

type CallEvent = "started" | "ended" | "missed";
interface CallMeta { event: CallEvent; actor_name: string; duration_sec?: number }

interface Attachment { url: string; filename: string; size: number; type: string }

interface Message {
  id:          string;
  sender_role: "admin" | "client";
  body:        string;
  kind:        "text" | "call" | "attachment";
  meta:        CallMeta | null;
  created_at:  string;
  read_at:     string | null;
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
const READ_RECEIPT_TOPIC = "read-receipt";

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

  // Optimistic messages shown immediately; cleaned up when server confirms.
  // Key fix: we never manually remove optimistic messages — the cleanup effect
  // handles it when the server poll returns data containing the real message.
  // This prevents the send→unsend→resend flicker.
  const [optimistic, setOptimistic] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);

  // Data-channel incoming messages
  const [dcMessages, setDcMessages] = useState<Message[]>([]);

  // Merge: server authoritative; DC and optimistic fill the gap
  const messages = useMemo(() => {
    const serverIds = new Set(serverMessages.map(m => m.id));
    const unsyncedDc = dcMessages.filter(m => !serverIds.has(m.id));
    const allKnownIds = new Set([...serverIds, ...unsyncedDc.map(m => m.id)]);
    const unsyncedOpt = optimistic.filter(m => !allKnownIds.has(m.id));
    return [...serverMessages, ...unsyncedDc, ...unsyncedOpt];
  }, [serverMessages, dcMessages, optimistic]);

  // Clean up once server catches up
  useEffect(() => {
    if (serverMessages.length === 0) return;
    const serverIds = new Set(serverMessages.map(m => m.id));
    setOptimistic(prev => {
      const next = prev.filter(m => !serverIds.has(m.id));
      return next.length === prev.length ? prev : next;
    });
    setDcMessages(prev => {
      const next = prev.filter(m => !serverIds.has(m.id));
      return next.length === prev.length ? prev : next;
    });
  }, [serverMessages]);

  // Broadcast read-receipt via data channel when we see new peer messages
  const sentReadRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!room || room.state !== "connected") return;
    const peerMsgIds = serverMessages
      .filter(m => m.sender_role !== me && m.kind === "text" && !sentReadRef.current.has(m.id))
      .map(m => m.id);
    if (peerMsgIds.length === 0) return;
    peerMsgIds.forEach(id => sentReadRef.current.add(id));
    try {
      const payload = new TextEncoder().encode(JSON.stringify({ messageIds: peerMsgIds }));
      void room.localParticipant.publishData(payload, { topic: READ_RECEIPT_TOPIC, reliable: true });
    } catch { /* best-effort */ }
  }, [serverMessages, room, me]);

  // Play receive sound for new incoming messages
  useEffect(() => {
    const count = messages.filter(m => m.kind === "text" && m.sender_role !== me && !m.id.startsWith("opt-")).length;
    if (count > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      playReceive();
    }
    prevMsgCountRef.current = count;
  }, [messages, me]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Track which read-receipt IDs we've already applied locally via data channel
  const appliedReadRef = useRef<Set<string>>(new Set());

  // LiveKit data channel: receive chat messages + read receipts
  useEffect(() => {
    if (!room || room.state !== "connected") return;

    const onData = (
      payload: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: DataPacket_Kind,
      topic?: string,
    ) => {
      if (!participant) return;

      if (topic === DATA_CHANNEL_TOPIC) {
        try {
          const msg: Message = JSON.parse(new TextDecoder().decode(payload));
          setDcMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        } catch { /* ignore non-JSON payloads */ }
        return;
      }

      if (topic === READ_RECEIPT_TOPIC) {
        try {
          const { messageIds } = JSON.parse(new TextDecoder().decode(payload)) as { messageIds: string[] };
          const now = new Date().toISOString();
          messageIds.forEach(id => appliedReadRef.current.add(id));
          setDcMessages(prev => prev.map(m =>
            messageIds.includes(m.id) && !m.read_at ? { ...m, read_at: now } : m
          ));
        } catch { /* ignore */ }
      }
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

    const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optMsg: Message = {
      id: optId,
      sender_role: me,
      body,
      kind: "text",
      meta: null,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setOptimistic(prev => [...prev, optMsg]);
    playSend();

    try {
      const res = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, body, asRole: me }),
      });
      const j = await res.json();
      if (j.ok) {
        const saved: Message = j.data.message;

        // Swap the optimistic ID for the real one so dedup works
        setOptimistic(prev => prev.map(m => m.id === optId ? { ...m, id: saved.id } : m));

        // Broadcast via data channel if in-call
        if (room?.state === "connected") {
          try {
            const payload = new TextEncoder().encode(JSON.stringify(saved));
            void room.localParticipant.publishData(payload, {
              topic: DATA_CHANNEL_TOPIC,
              reliable: true,
            });
          } catch { /* data channel best-effort */ }
        }

        // Revalidate SWR — the cleanup effect will remove the optimistic copy
        // once the server data includes the real message
        void mutate();
      } else {
        setOptimistic(prev => prev.filter(m => m.id !== optId));
      }
    } catch {
      setOptimistic(prev => prev.filter(m => m.id !== optId));
    } finally {
      setSending(false);
    }
  }, [text, sending, me, code, room, mutate]);

  const uploadFile = useCallback(async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("code", code);
      form.append("asRole", me);
      const uploadRes = await fetch("/api/comms/upload", { method: "POST", body: form });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.ok) throw new Error(uploadJson.error || "Upload failed");

      const att: Attachment = uploadJson.data;
      const body = JSON.stringify(att);

      const optId = `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optMsg: Message = {
        id: optId, sender_role: me, body, kind: "attachment",
        meta: null, created_at: new Date().toISOString(), read_at: null,
      };
      setOptimistic(prev => [...prev, optMsg]);
      playSend();

      const msgRes = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, body, asRole: me, kind: "attachment" }),
      });
      const msgJson = await msgRes.json();
      if (msgJson.ok) {
        const saved: Message = msgJson.data.message;
        setOptimistic(prev => prev.map(m => m.id === optId ? { ...m, id: saved.id } : m));
        if (room?.state === "connected") {
          try {
            const payload = new TextEncoder().encode(JSON.stringify(saved));
            void room.localParticipant.publishData(payload, { topic: DATA_CHANNEL_TOPIC, reliable: true });
          } catch { /* best-effort */ }
        }
        void mutate();
      } else {
        setOptimistic(prev => prev.filter(m => m.id !== optId));
      }
    } catch {
      // silently fail — toast could be added later
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploading, code, me, room, mutate]);

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

          if (m.kind === "attachment") {
            let att: Attachment | null = null;
            try { att = JSON.parse(m.body); } catch { /* fallback to text */ }
            if (att) {
              return (
                <div key={m.id} style={{
                  display: "flex", flexDirection: mine ? "row-reverse" : "row",
                  alignItems: "flex-end", gap: 8,
                  opacity: isOptimistic ? 0.55 : 1,
                  transition: "opacity 300ms ease",
                }}>
                  <Avatar name={name} role={m.sender_role} />
                  <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 10, color: MUTED, margin: "0 4px 3px", display: "flex", gap: 6 }}>
                      <span style={{ fontWeight: 600, color: mine ? GOLD : TEXT, opacity: 0.85 }}>{name}</span>
                      <span>{fmtClock(m.created_at)}</span>
                    </div>
                    <AttachmentBubble att={att} mine={mine} />
                    {mine && <ReadReceipt optimistic={isOptimistic} readAt={m.read_at} />}
                  </div>
                </div>
              );
            }
          }

          return (
            <div key={m.id} style={{
              display: "flex", flexDirection: mine ? "row-reverse" : "row",
              alignItems: "flex-end", gap: 8,
              opacity: isOptimistic ? 0.55 : 1,
              transition: "opacity 300ms ease",
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
                {mine && (
                  <ReadReceipt optimistic={isOptimistic} readAt={m.read_at} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, padding: 12, borderTop: `1px solid ${BORDER}`, alignItems: "center" }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Attach file"
          title="Attach file"
          style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: "rgba(243,241,236,0.06)", border: `1px solid ${BORDER}`,
            color: uploading ? GOLD : MUTED, cursor: uploading ? "wait" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {uploading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          )}
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          enterKeyHint="send"
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

const READ_BLUE = "#5BA0D0";

function ReadReceipt({ optimistic, readAt }: { optimistic: boolean; readAt: string | null }) {
  const isRead = !optimistic && !!readAt;
  return (
    <span style={{
      fontSize: 10, marginTop: 2, marginRight: 2,
      color: isRead ? READ_BLUE : MUTED,
      opacity: isRead ? 1 : 0.5,
      fontFamily: "var(--font-mono)",
      letterSpacing: "-0.02em",
    }}>
      {isRead ? "✓✓" : "✓"}
    </span>
  );
}

function Avatar({ name, role }: { name: string; role: "admin" | "client" }) {
  if (role === "admin") return <HOSTeamAvatar size={28} />;
  return (
    <div style={{
      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
      background: "#3A3A3A", color: TEXT,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.02em",
      fontFamily: "var(--font-ui)",
    }}>{initials(name)}</div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentBubble({ att, mine }: { att: Attachment; mine: boolean }) {
  const isImage = att.type.startsWith("image/");
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block", textDecoration: "none",
        background: mine ? GOLD : SURF_2,
        borderRadius: 10, overflow: "hidden",
        maxWidth: 240,
        border: `1px solid ${mine ? "transparent" : BORDER}`,
      }}
    >
      {isImage ? (
        <img
          src={att.url}
          alt={att.filename}
          style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "cover" }}
        />
      ) : (
        <div style={{
          padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mine ? BG : MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: mine ? BG : TEXT,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{att.filename}</div>
            <div style={{ fontSize: 10, color: mine ? "rgba(0,0,0,0.5)" : MUTED }}>
              {fmtSize(att.size)}
            </div>
          </div>
        </div>
      )}
    </a>
  );
}

function CallRow({ m, rest }: { m: Message; rest: Message[] }) {
  const meta = m.meta;
  if (!meta) return null;

  let label: string;
  let icon: string;
  let color: string;

  let iconType: "ended" | "phone" | "missed" | "calling" = "phone";

  if (meta.event === "ended") {
    label = `Call ended · ${fmtDuration(meta.duration_sec)}`;
    iconType = "ended"; color = GREEN;
  } else {
    const nextStartedIdx = rest.findIndex(r => r.kind === "call" && r.meta?.event === "started");
    const window = nextStartedIdx === -1 ? rest : rest.slice(0, nextStartedIdx);
    const answered = window.some(r => r.kind === "call" && r.meta?.event === "ended");
    const stale = Date.now() - new Date(m.created_at).getTime() > RING_WINDOW_MS;

    if (answered)      { label = `${meta.actor_name} started a call`; iconType = "phone"; color = MUTED; }
    else if (meta.event === "missed" || stale) { label = "Missed call"; iconType = "missed"; color = RED; }
    else               { label = `${meta.actor_name} is calling…`;     iconType = "calling"; color = GOLD; }
  }

  return (
    <div style={{
      alignSelf: "center", display: "flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 20,
      background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`,
      fontSize: 12, color,
    }}>
      <CallIcon type={iconType} color={color} />
      <span style={{ fontWeight: 600 }}>{label}</span>
      <span style={{ color: MUTED, opacity: 0.7, fontSize: 10 }}>{fmtClock(m.created_at)}</span>
    </div>
  );
}

function CallIcon({ type, color }: { type: "ended" | "phone" | "missed" | "calling"; color: string }) {
  if (type === "ended") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "missed") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
        <line x1="23" y1="1" x2="1" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
