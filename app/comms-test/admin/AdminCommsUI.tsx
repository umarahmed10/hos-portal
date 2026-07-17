"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Room } from "livekit-client";
import { CallPanel } from "@/components/comms/CallPanel";
import { ChatPanel } from "@/components/comms/ChatPanel";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import { postJSON } from "@/lib/comms/http";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN, SUBTLE } from "@/lib/styles";

interface Client { code: string; name: string; company: string | null }

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminCommsUI({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [active, setActive] = useState<Client | null>(null);
  const [autoJoin, setAutoJoin] = useState(false);
  const [ringing, setRinging] = useState<string | null>(null);
  const [lkRoom, setLkRoom] = useState<Room | null>(null);
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.company?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

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
    <div style={{ display: "flex", height: "100vh", background: BG, color: TEXT }}>

      {/* ── Sidebar: client list ── */}
      <div style={{
        width: 280, flexShrink: 0,
        background: SURF, borderRight: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column",
      }}>
        {/* Sidebar header */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          }}>
            <button
              onClick={() => router.push("/admin")}
              aria-label="Back to dashboard"
              title="Back to dashboard"
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: "rgba(243,241,236,0.06)", border: `1px solid ${BORDER}`,
                color: MUTED, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 120ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(243,241,236,0.12)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(243,241,236,0.06)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <HOSTeamAvatar size={24} />
            <span style={{
              fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: TEXT,
            }}>HOS Comms</span>
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients…"
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6,
              background: SURF_2, border: `1px solid ${BORDER}`,
              color: TEXT, fontSize: 12, fontFamily: "var(--font-body)",
              outline: "none",
            }}
          />
        </div>

        {/* Client list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div style={{
            fontSize: 9, fontFamily: "var(--font-mono)",
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: MUTED, padding: "8px 8px 6px", fontWeight: 500,
          }}>
            Clients — {filtered.length}
          </div>

          {filtered.map(c => {
            const isActive = active?.code === c.code;
            return (
              <button
                key={c.code}
                onClick={() => openChat(c)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "8px 10px", borderRadius: 6,
                  background: isActive ? "rgba(139,107,62,0.12)" : "transparent",
                  border: "none", cursor: "pointer",
                  marginBottom: 2, textAlign: "left",
                  transition: "background 120ms ease",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(243,241,236,0.04)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "#2A2A2A", color: TEXT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, fontFamily: "var(--font-ui)",
                }}>{initials(c.name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: isActive ? 600 : 400, color: TEXT,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{c.name}</div>
                  <div style={{
                    fontSize: 10, color: SUBTLE, fontFamily: "var(--font-mono)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.code}{c.company ? ` · ${c.company}` : ""}
                  </div>
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: "20px 0" }}>
              No clients found.
            </div>
          )}
        </div>

        {/* Sidebar footer — admin identity */}
        <div style={{
          padding: "10px 12px",
          borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <HOSTeamAvatar size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>HOS Team</div>
            <div style={{ fontSize: 9, color: GREEN, fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>Online</div>
          </div>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {!active ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
          }}>
            <HOSTeamAvatar size={56} />
            <div style={{
              fontSize: 14, color: MUTED, fontFamily: "var(--font-body)",
              textAlign: "center", maxWidth: 240,
            }}>
              Select a client to start chatting or ring them for a call.
            </div>
          </div>
        ) : (
          <>
            {/* Active client header */}
            <div style={{
              padding: "12px 20px",
              borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: SURF, flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: "#2A2A2A", color: TEXT,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, fontFamily: "var(--font-ui)",
                }}>{initials(active.name)}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{active.name}</div>
                  <div style={{ fontSize: 10, color: MUTED, fontFamily: "var(--font-mono)" }}>
                    {active.code}{active.company ? ` · ${active.company}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => ring(active)}
                  disabled={ringing === active.code}
                  style={{
                    padding: "7px 14px", borderRadius: 6,
                    background: "rgba(78,173,135,0.12)", color: GREEN,
                    border: "1px solid rgba(78,173,135,0.25)",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    letterSpacing: "0.04em", textTransform: "uppercase",
                    display: "flex", alignItems: "center", gap: 6,
                    opacity: ringing === active.code ? 0.5 : 1,
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                  </svg>
                  {ringing === active.code ? "Ringing…" : "Ring"}
                </button>
              </div>
            </div>

            {/* Call + Chat — side by side, chat always visible */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              overflow: "hidden", minHeight: 0,
            }}>
              {/* Call panel — constrained height, never pushes chat off screen */}
              <div style={{ flexShrink: 0, padding: "12px 20px 0", maxHeight: "45vh", overflow: "auto" }}>
                <CallPanel code={active.code} me="admin" autoJoin={autoJoin} onRoom={setLkRoom} />
              </div>
              {/* Chat panel — always visible, fills remaining space */}
              <div style={{ flex: 1, padding: "12px 20px 20px", minHeight: 250, overflow: "hidden" }}>
                <div style={{ height: "100%" }}>
                  <ChatPanel code={active.code} me="admin" myName="HOS Team" peerName={active.name} room={lkRoom} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
