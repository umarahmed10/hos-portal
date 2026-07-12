"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD } from "@/lib/styles";

interface Message {
  id:          string;
  sender_role: "admin" | "client";
  body:        string;
  created_at:  string;
}

interface Props {
  code: string;
  me:   "admin" | "client";
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function ChatPanel({ code, me }: Props) {
  const { data, mutate } = useSWR<{ ok: boolean; data: { messages: Message[] } }>(
    `/api/comms/messages?code=${code}&asRole=${me}`,
    fetcher,
    { refreshInterval: 2500 }
  );
  const messages = data?.ok ? data.data.messages : [];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/comms/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, body, asRole: me }),
      });
      const j = await res.json();
      if (j.ok) { setText(""); await mutate(); }
    } finally { setSending(false); }
  }

  return (
    <div style={{
      background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
      display: "flex", flexDirection: "column", height: 420,
    }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
        fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em",
      }}>Messages · {code}</div>

      <div ref={listRef} style={{
        flex: 1, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, textAlign: "center", marginTop: 40 }}>
            No messages yet.
          </div>
        )}
        {messages.map(m => {
          const mine = m.sender_role === me;
          return (
            <div key={m.id} style={{
              alignSelf: mine ? "flex-end" : "flex-start",
              background: mine ? GOLD : SURF_2,
              color: mine ? BG : TEXT,
              padding: "8px 12px", borderRadius: 10, maxWidth: "78%",
              fontSize: 14, lineHeight: 1.4, whiteSpace: "pre-wrap",
            }}>{m.body}</div>
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
