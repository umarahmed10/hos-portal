"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { RoomEvent, type DataPacket_Kind, type Room, type RemoteParticipant } from "livekit-client";
import { toast } from "sonner";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, RED } from "@/lib/styles";
import { playSend, playReceive, playUploadComplete } from "@/lib/comms/sounds";
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
const GROUP_WINDOW_MS = 5 * 60_000; // group consecutive same-sender messages within 5 min
const DATA_CHANNEL_TOPIC = "chat";
const READ_RECEIPT_TOPIC = "read-receipt";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(iso, now.toISOString())) return "Today";
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(iso, y.toISOString())) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });
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

  const [optimistic, setOptimistic] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMsgCountRef = useRef(0);

  const [dcMessages, setDcMessages] = useState<Message[]>([]);

  const messages = useMemo(() => {
    const serverIds = new Set(serverMessages.map(m => m.id));
    const unsyncedDc = dcMessages.filter(m => !serverIds.has(m.id));
    const allKnownIds = new Set([...serverIds, ...unsyncedDc.map(m => m.id)]);
    const unsyncedOpt = optimistic.filter(m => !allKnownIds.has(m.id));
    return [...serverMessages, ...unsyncedDc, ...unsyncedOpt];
  }, [serverMessages, dcMessages, optimistic]);

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

  useEffect(() => {
    const count = messages.filter(m => m.kind === "text" && m.sender_role !== me && !m.id.startsWith("opt-")).length;
    if (count > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      playReceive();
    }
    prevMsgCountRef.current = count;
  }, [messages, me]);

  // Jump to the newest message. First population is instant (reliable landing on
  // the latest, like Discord opening a DM); later messages animate.
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: didInitialScrollRef.current ? "smooth" : "auto" });
    if (messages.length > 0) didInitialScrollRef.current = true;
  }, [messages.length]);

  const appliedReadRef = useRef<Set<string>>(new Set());

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
          setDcMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
        } catch { /* ignore */ }
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
      id: optId, sender_role: me, body, kind: "text",
      meta: null, created_at: new Date().toISOString(), read_at: null,
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
        toast.error(j.error || "Message failed to send");
      }
    } catch {
      setOptimistic(prev => prev.filter(m => m.id !== optId));
      toast.error("Message failed to send");
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
      playUploadComplete();

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
        toast.error(msgJson.error || "Upload failed");
      }
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message || "Something went wrong"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [uploading, code, me, room, mutate]);

  return (
    <div style={{
      background: SURF,
      display: "flex", flexDirection: "column", height: "100%", minHeight: 300,
      flex: 1, width: "100%", minWidth: 0,
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
        fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em",
        display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
      }}>
        <span>Messages · {code}</span>
        {hasRoom && (
          <span style={{ fontSize: 9, color: GREEN, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
            LIVE
          </span>
        )}
      </div>

      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "8px 0", minHeight: 0 }}>
        {messages.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
            No messages yet.
          </div>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showDivider = !prev || !sameDay(prev.created_at, m.created_at);

          if (m.kind === "call") {
            return (
              <div key={m.id}>
                {showDivider && <DateDivider iso={m.created_at} />}
                <CallRow m={m} rest={messages.slice(i + 1)} />
              </div>
            );
          }

          const mine = m.sender_role === me;
          const name = nameFor(m.sender_role);
          const isOptimistic = m.id.startsWith("opt-");

          // Group with previous message from the same sender within the window.
          const grouped = !showDivider && !!prev && prev.kind !== "call"
            && prev.sender_role === m.sender_role
            && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < GROUP_WINDOW_MS;

          let att: Attachment | null = null;
          if (m.kind === "attachment") {
            try { att = JSON.parse(m.body); } catch { att = null; }
          }

          return (
            <div key={m.id}>
              {showDivider && <DateDivider iso={m.created_at} />}
              <MessageRow
                grouped={grouped}
                mine={mine}
                name={name}
                role={m.sender_role}
                iso={m.created_at}
                optimistic={isOptimistic}
                readAt={m.read_at}
                showReceipt={mine && me === "admin"}
              >
                {att
                  ? <AttachmentBubble att={att} />
                  : <span style={{ fontSize: 14.5, lineHeight: 1.5, color: TEXT, fontFamily: "var(--font-body)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</span>}
              </MessageRow>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, padding: 12, borderTop: `1px solid ${BORDER}`, alignItems: "center", flexShrink: 0 }}>
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
            padding: "0 18px", height: 40, borderRadius: 8, background: TEXT, color: BG,
            border: "none", fontWeight: 600, cursor: text.trim() ? "pointer" : "not-allowed",
            opacity: text.trim() && !sending ? 1 : 0.4,
          }}
        >Send</button>
      </div>

      <style>{`
        .comms-msg-row:hover { background: rgba(243,241,236,0.03); }
        .comms-msg-row:hover .comms-hover-time { opacity: 0.6; }
      `}</style>
    </div>
  );
}

const READ_BLUE = "#5BA0D0";

// Discord-style message row: avatar + name/time header on group start, tight
// continuation lines when grouped. Everything left-aligned.
function MessageRow({ grouped, mine, name, role, iso, optimistic, readAt, showReceipt, children }: {
  grouped: boolean; mine: boolean; name: string; role: "admin" | "client";
  iso: string; optimistic: boolean; readAt: string | null; showReceipt: boolean; children: React.ReactNode;
}) {
  return (
    <div className="comms-msg-row" style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      padding: grouped ? "1px 16px" : "6px 16px 1px",
      opacity: optimistic ? 0.55 : 1, transition: "opacity 300ms, background 120ms",
      position: "relative",
    }}>
      <div style={{ width: 32, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: grouped ? 0 : 2 }}>
        {grouped
          ? <span className="comms-hover-time" style={{ fontSize: 9, color: MUTED, opacity: 0, fontFamily: "var(--font-mono)", lineHeight: "20px" }}>
              {new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/i, "")}
            </span>
          : <Avatar name={name} role={role} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!grouped && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: mine ? GOLD : TEXT, fontFamily: "var(--font-ui)" }}>{name}</span>
            <span style={{ fontSize: 10, color: MUTED }}>{fmtClock(iso)}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
          <div style={{ minWidth: 0 }}>{children}</div>
          {showReceipt && <ReadReceipt optimistic={optimistic} readAt={readAt} />}
        </div>
      </div>
    </div>
  );
}

function DateDivider({ iso }: { iso: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 16px 6px" }}>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span style={{
        fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)",
        letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap",
      }}>{dayLabel(iso)}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

function ReadReceipt({ optimistic, readAt }: { optimistic: boolean; readAt: string | null }) {
  const isRead = !optimistic && !!readAt;
  return (
    <span style={{
      fontSize: 10, flexShrink: 0,
      color: isRead ? READ_BLUE : MUTED, opacity: isRead ? 1 : 0.45,
      fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
    }}>
      {isRead ? "✓✓" : "✓"}
    </span>
  );
}

function Avatar({ name, role }: { name: string; role: "admin" | "client" }) {
  if (role === "admin") return <HOSTeamAvatar size={32} />;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: "#3A3A3A", color: TEXT,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", fontFamily: "var(--font-ui)",
    }}>{initials(name)}</div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentBubble({ att }: { att: Attachment }) {
  const isImage = att.type.startsWith("image/");
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block", textDecoration: "none",
        background: SURF_2, borderRadius: 10, overflow: "hidden",
        maxWidth: 280, border: `1px solid ${BORDER}`, marginTop: 2,
      }}
    >
      {isImage ? (
        <img src={att.url} alt={att.filename} style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover" }} />
      ) : (
        <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{att.filename}</div>
            <div style={{ fontSize: 10, color: MUTED }}>{fmtSize(att.size)}</div>
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
  let iconType: "ended" | "phone" | "missed" | "calling" = "phone";
  let color: string;

  if (meta.event === "ended") {
    const dur = meta.duration_sec ?? 0;
    const mins = Math.floor(dur / 60);
    const secs = dur % 60;
    const durStr = mins > 0 ? `${mins} minute${mins !== 1 ? "s" : ""}` : `${secs} second${secs !== 1 ? "s" : ""}`;
    label = `${meta.actor_name} started a call that lasted ${durStr}`;
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
      <div style={{ width: 32, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <CallIcon type={iconType} color={color} />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 10, color: MUTED, opacity: 0.7 }}>{fmtClock(m.created_at)}</span>
    </div>
  );
}

function CallIcon({ type, color }: { type: "ended" | "phone" | "missed" | "calling"; color: string }) {
  if (type === "ended") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
      </svg>
    );
  }
  if (type === "missed") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-2.67m-2.67-3.34a19.79 19.79 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91" />
        <line x1="23" y1="1" x2="1" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}
