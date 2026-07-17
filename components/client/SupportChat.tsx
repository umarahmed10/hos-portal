"use client";
import { useState, useRef, useEffect } from "react";
import { BODY, BORDER, FONT, GREEN, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { Loader2 } from "@/components/shared/Icons";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";

interface Message {
  role:    "user" | "assistant";
  content: string;
}

const DEFAULT_GREETING = "Hi there! I'm the House Of Sales support assistant. I can help with billing, onboarding, call quality, and campaign questions. What can I help you with?";

interface Props {
  slug?:       string;
  clientName?: string;
}

export function SupportChat({ clientName }: Props) {
  const greeting: Message = {
    role:    "assistant",
    content: clientName
      ? `Hi ${clientName}! I'm the House Of Sales support assistant. I can help with billing, onboarding, call quality, and campaign questions. What can I help you with?`
      : DEFAULT_GREETING,
  };
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res  = await fetch("/api/support-chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ messages: next.filter(m => m.role !== "assistant" || m !== greeting) }),
      });
      const json = await res.json();

      if (json.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: json.data.content }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting right now. Please reply to your onboarding email for urgent support." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      height:        "100%",
      minHeight:     480,
      background:    SURF,
      border:        `1px solid ${BORDER}`,
      borderRadius:  12,
      overflow:      "hidden",
    }}>
      {/* Chat header */}
      <div style={{
        padding:      "16px 20px",
        borderBottom: `1px solid ${BORDER}`,
        display:      "flex",
        alignItems:   "center",
        gap:          10,
      }}>
        <HOSTeamAvatar size={28} />
        <div>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "0.3px" }}>
            HOS SUPPORT
          </div>
          <div style={{ fontSize: 10, color: GREEN, letterSpacing: "0.5px", fontFamily: BODY }}>
            Online
          </div>
        </div>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 8px" }}>
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={i}
              style={{
                display:       "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                marginBottom:  14,
                animation:     "fadeIn 150ms ease-out",
              }}
            >
              <div style={{
                maxWidth:     "78%",
                padding:      "11px 15px",
                borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                background:   isUser ? TEXT : "#0d0d0d",
                border:       `1px solid ${isUser ? "transparent" : BORDER}`,
                fontSize:     13,
                color:        isUser ? "#0a0a0a" : "#ccc",
                lineHeight:   1.6,
                fontFamily:   BODY,
                whiteSpace:   "pre-wrap",
              }}>
                {msg.content}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
            <div style={{
              padding:    "11px 15px",
              borderRadius: "12px 12px 12px 2px",
              background:   "#0d0d0d",
              border:       `1px solid ${BORDER}`,
              display:      "flex", alignItems: "center", gap: 8,
              color:        MUTED, fontSize: 13, fontFamily: BODY,
            }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: MUTED }} />
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        borderTop:   `1px solid ${BORDER}`,
        padding:     "12px 16px",
        display:     "flex",
        gap:         10,
        alignItems:  "flex-end",
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Ask a question…"
          rows={1}
          style={{
            ...css.inp,
            resize:     "none",
            flex:       1,
            lineHeight: 1.5,
            maxHeight:  100,
            overflow:   "auto",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            ...css.btnP,
            padding:   "10px 18px",
            fontSize:  13,
            flexShrink: 0,
            opacity:   loading || !input.trim() ? 0.4 : 1,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
