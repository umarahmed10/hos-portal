"use client";
import { useState } from "react";
import { toast } from "sonner";
import { CallPanel } from "@/components/comms/CallPanel";
import { ChatPanel } from "@/components/comms/ChatPanel";
import { postJSON } from "@/lib/comms/http";
import { BG, SURF, BORDER, TEXT, MUTED, GOLD } from "@/lib/styles";

interface Client { code: string; name: string; company: string | null }

export function AdminCommsUI({ clients }: { clients: Client[] }) {
  const [active, setActive] = useState<Client | null>(null);
  const [autoJoin, setAutoJoin] = useState(false);
  const [ringing, setRinging] = useState<string | null>(null);

  async function ring(client: Client) {
    setRinging(client.code);
    try {
      const data = await postJSON<{ delivered: number; total: number }>(
        "/api/comms/ring", { code: client.code },
      );
      toast.success(`Ringing · ${data.delivered}/${data.total} device(s) reached`);
      setActive(client);
      setAutoJoin(true);
    } catch (e) {
      toast.error(`Ring failed: ${(e as Error).message}`);
    } finally {
      setRinging(null);
    }
  }

  function openChat(client: Client) {
    setActive(client);
    setAutoJoin(false);
  }

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
          Comms Trial
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 400, fontSize: 40, margin: "0 0 24px" }}>
          Client Comms
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20 }}>
          <div style={{
            background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: 16, maxHeight: "70vh", overflowY: "auto",
          }}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 12 }}>
              Clients
            </div>
            {clients.length === 0 && <div style={{ color: MUTED, fontSize: 13 }}>No clients yet.</div>}
            {clients.map(c => (
              <div key={c.code} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                background: active?.code === c.code ? "rgba(139,107,62,0.12)" : "transparent",
                border: `1px solid ${active?.code === c.code ? "rgba(139,107,62,0.3)" : "transparent"}`,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: "var(--font-mono)" }}>
                    {c.code}{c.company ? ` · ${c.company}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => ring(c)}
                    disabled={ringing === c.code}
                    style={{
                      padding: "6px 12px", borderRadius: 6, background: GOLD, color: BG,
                      border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
                      letterSpacing: "0.05em", textTransform: "uppercase",
                    }}
                  >{ringing === c.code ? "…" : "Call"}</button>
                  <button
                    onClick={() => openChat(c)}
                    style={{
                      padding: "6px 12px", borderRadius: 6, background: "transparent",
                      color: TEXT, border: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", letterSpacing: "0.05em", textTransform: "uppercase",
                    }}
                  >Chat</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!active ? (
              <div style={{
                background: SURF, border: `1px dashed ${BORDER}`, borderRadius: 12,
                padding: 40, color: MUTED, textAlign: "center", fontSize: 14,
              }}>
                Pick a client to ring or chat with.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: MUTED }}>
                  Active: <b style={{ color: TEXT }}>{active.name}</b> · <span style={{ fontFamily: "var(--font-mono)" }}>{active.code}</span>
                </div>
                <CallPanel code={active.code} me="admin" autoJoin={autoJoin} />
                <ChatPanel code={active.code} me="admin" />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
