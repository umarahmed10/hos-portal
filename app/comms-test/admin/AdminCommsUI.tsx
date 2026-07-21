"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CommsWorkspace } from "@/components/comms/CommsWorkspace";
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
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.company?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  // Ring the client's devices — fired automatically when the admin joins the
  // call (Discord model: you sit in the call, it rings them).
  async function notifyRing(client: Client) {
    try {
      const data = await postJSON<{ delivered: number; total: number }>(
        "/api/comms/ring", { code: client.code },
      );
      toast.success(`Ringing ${client.name.split(" ")[0]} · ${data.delivered}/${data.total} device(s)`);
    } catch (e) {
      toast.error(`Ring failed: ${(e as Error).message}`);
    }
  }

  function openChat(client: Client) {
    setActive(client);
    setAutoJoin(false);
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: BG, color: TEXT }}>

      {/* ── Sidebar: client list (collapsible) ── */}
      <div style={{
        width: sidebarOpen ? 280 : 0, flexShrink: 0, overflow: "hidden",
        background: SURF, borderRight: sidebarOpen ? `1px solid ${BORDER}` : "none",
        display: "flex", flexDirection: "column",
        transition: "width 200ms ease",
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
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              style={{
                marginLeft: "auto", width: 26, height: 26, borderRadius: 6,
                background: "transparent", border: `1px solid ${BORDER}`, color: MUTED,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Show chats sidebar"
            title="Show chats"
            style={{
              position: "absolute", top: 12, left: 12, zIndex: 20,
              height: 34, padding: "0 12px", borderRadius: 8,
              background: SURF, border: `1px solid ${BORDER}`, color: TEXT,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
              fontSize: 12, fontWeight: 600, fontFamily: "var(--font-ui)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Chats
          </button>
        )}
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
              padding: "12px 20px", paddingLeft: sidebarOpen ? 20 : 108,
              borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: SURF, flexShrink: 0, transition: "padding-left 200ms ease",
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

            </div>

            {/* Discord-style workspace — call stage + chat rail.
                Joining the voice channel auto-rings the client (Discord model). */}
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
              <CommsWorkspace
                key={active.code}
                code={active.code}
                me="admin"
                myName="HOS Team"
                peerName={active.name}
                autoJoin={autoJoin}
                onConnected={() => notifyRing(active)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
