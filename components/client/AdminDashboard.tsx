"use client";
import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import useSWR                  from "swr";
import { toast }                from "sonner";
import { fetchAllDocs, archiveDoc } from "@/lib/api-client";
import { money, fmtDateTime }   from "@/lib/utils";
import { AMBER, BORDER, BODY, FONT, GREEN, MUTED, SURF, SURF_HOVER, TEXT, css } from "@/lib/styles";
import { StatusBadge }          from "@/components/server/StatusBadge";
import { CopyButton }           from "./CopyButton";
import { EventTimeline }        from "./EventTimeline";
import { Search, Plus, Edit, Archive, Download, LogOut } from "@/components/shared/Icons";
import { logoutAdmin }                       from "@/lib/api-client";
import type { Doc, DocEvent }                from "@/types";

interface Props {
  initialDocs: Doc[];
}

const NOW = new Date();
const MONTH_START = new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString();

function thisMonth(iso: string | null): boolean {
  if (!iso) return false;
  return iso >= MONTH_START;
}

async function fetchEvents(code: string): Promise<DocEvent[]> {
  const res = await fetch(`/api/docs/${code}/events`);
  const json = await res.json();
  return json.ok ? json.data : [];
}

export function AdminDashboard({ initialDocs }: Props) {
  const router  = useRouter();
  const [query, setQuery]             = useState("");
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [archiving, setArchiving]     = useState<string | null>(null);
  const [eventsMap, setEventsMap]     = useState<Record<string, DocEvent[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<string | null>(null);

  const { data: docs = initialDocs } = useSWR<Doc[]>(
    "/api/docs",
    fetchAllDocs,
    { refreshInterval: 8000, fallbackData: initialDocs }
  );

  const filtered = query.trim()
    ? docs.filter(d =>
        d.name.toLowerCase().includes(query.toLowerCase()) ||
        (d.company ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : docs;

  // ── Metrics ───────────────────────────────────────────────────────────────
  const active   = docs.filter(d => d.status === "pending" || d.status === "signed").length;
  const pending  = docs.filter(d => d.status === "pending").length;
  const revenue  = docs
    .filter(d => d.status === "signed" && thisMonth(d.signed_at))
    .reduce((s, d) => s + Number(d.invoice_total), 0);
  const collected = docs
    .filter(d => d.amount_paid > 0 && thisMonth(d.updated_at))
    .reduce((s, d) => s + Number(d.amount_paid), 0);

  // ── "Opened not signed" detection (from cached events) ────────────────────
  function hasViewed(doc: Doc): boolean {
    const events = eventsMap[doc.code] ?? [];
    return events.some(e => e.event_type === "viewed" || e.event_type === "invoice_viewed");
  }

  // ── Expand + load events ──────────────────────────────────────────────────
  async function handleExpand(code: string) {
    const next = expanded === code ? null : code;
    setExpanded(next);
    if (next && !eventsMap[next]) {
      setLoadingEvents(next);
      const events = await fetchEvents(next);
      setEventsMap(prev => ({ ...prev, [next]: events }));
      setLoadingEvents(null);
    }
  }

  async function handleArchive(code: string, name: string) {
    if (!confirm(`Archive doc for ${name}? This cannot be undone.`)) return;
    setArchiving(code);
    const res = await archiveDoc(code);
    setArchiving(null);
    if (res.ok) toast.success(`${name} archived`);
    else        toast.error(`Archive failed: ${res.error}`);
  }

  async function handleLogout() {
    await logoutAdmin();
    router.push("/");
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const shareMsg = (d: Doc) =>
    `Hey ${d.name}! Review and sign your HOS Automations onboarding docs at ${process.env.NEXT_PUBLIC_APP_URL || ""}/client — code: ${d.code}. Takes 2 mins.`;

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>
      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0" }}>
        <div style={{ ...css.wrap, maxWidth: 900, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", color: MUTED, fontFamily: BODY, fontWeight: 700 }}>HOS AUTOMATIONS</div>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: "0.3px" }}>ADMIN DASHBOARD</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.push("/admin/new")} style={{ ...css.btnP, display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 12 }}>
              <Plus size={13} /> New Doc
            </button>
            <button onClick={handleLogout} style={{ ...css.btnS, display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12 }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...css.wrap, maxWidth: 900, paddingTop: 24 }}>

        {/* Metrics bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Active Clients",     value: active,           color: TEXT,  note: null },
            { label: "Pending Signatures", value: pending,          color: AMBER, note: null },
            { label: "Signed",             value: docs.filter(d => d.status === "signed").length, color: GREEN, note: null },
            { label: "Monthly Revenue",    value: money(revenue),   color: GREEN, note: "This month" },
            { label: "Collected",          value: money(collected), color: GREEN, note: "This month" },
          ].map(({ label, value, color, note }) => (
            <div key={label} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{value}</div>
              {note && <div style={{ fontSize: 10, color: "#2a2a2a", fontFamily: BODY, marginTop: 3 }}>{note}</div>}
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or company…"
            style={{ ...css.inp, paddingLeft: 36 }}
          />
        </div>

        {/* Docs table */}
        <div style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: MUTED, fontSize: 13, fontFamily: BODY }}>
              {query ? "No results for that search." : "No documents yet. Create one to get started."}
            </div>
          ) : (
            filtered.map((doc) => {
              // "Opened not signed" indicator: pending + has a viewed event
              const openedNotSigned = doc.status === "pending" && hasViewed(doc);

              return (
                <div key={doc.id}>
                  <div
                    style={{
                      display:        "flex",
                      alignItems:     "center",
                      gap:            12,
                      padding:        "14px 20px",
                      borderBottom:   `1px solid ${BORDER}`,
                      cursor:         "pointer",
                      transition:     "background 120ms",
                    }}
                    onClick={() => handleExpand(doc.code)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = SURF_HOVER)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Status */}
                    <StatusBadge status={doc.status} />

                    {/* "Opened not signed" dot */}
                    {openedNotSigned && (
                      <div title="Client has viewed but not yet signed" style={{
                        width:      8, height: 8,
                        borderRadius: "50%",
                        background: AMBER,
                        flexShrink: 0,
                      }} />
                    )}

                    {/* Name / company */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>
                        {doc.company || "—"} · {fmtDateTime(doc.created_at)}
                      </div>
                    </div>

                    {/* Code */}
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: "2px", flexShrink: 0 }}>
                      {doc.code}
                    </div>

                    {/* Invoice total */}
                    {doc.invoice_total > 0 && (
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: MUTED, flexShrink: 0 }}>
                        {money(doc.invoice_total)}
                      </div>
                    )}

                    {/* Quick actions */}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <CopyButton text={doc.code}        label="Code"    size="sm" />
                      <CopyButton text={shareMsg(doc)}   label="Message" size="sm" />
                      <button
                        onClick={() => window.open(`/api/pdf?code=${doc.code}`, "_blank")}
                        title="Download PDF"
                        style={{ ...css.btnS, padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center" }}
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={() => router.push(`/admin/edit/${doc.code}`)}
                        title="Edit"
                        style={{ ...css.btnS, padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center" }}
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        onClick={() => handleArchive(doc.code, doc.name)}
                        disabled={archiving === doc.code}
                        title="Archive"
                        style={{ ...css.btnS, padding: "6px 10px", fontSize: 11, display: "flex", alignItems: "center", opacity: archiving === doc.code ? 0.5 : 1 }}
                      >
                        <Archive size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded row */}
                  {expanded === doc.code && (
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, background: "#0c0c0c", animation: "fadeIn 150ms ease-out" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                        {doc.agreement_text && (
                          <div>
                            <div style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY, marginBottom: 8, textTransform: "uppercase" }}>Agreement Preview</div>
                            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7, fontFamily: "var(--font-serif)", maxHeight: 120, overflow: "hidden", maskImage: "linear-gradient(to bottom, black 60%, transparent)" }}>
                              {doc.agreement_text.slice(0, 400)}…
                            </div>
                          </div>
                        )}
                        {doc.signature && (
                          <div>
                            <div style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY, marginBottom: 8, textTransform: "uppercase" }}>Signature</div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={doc.signature} alt="Signature" style={{ maxWidth: 260, height: "auto", background: SURF, borderRadius: 6, padding: 6, border: `1px solid ${BORDER}` }} />
                          </div>
                        )}
                      </div>

                      {/* Event timeline */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY, marginBottom: 10, textTransform: "uppercase" }}>
                          Event Timeline
                        </div>
                        {loadingEvents === doc.code ? (
                          <div style={{ color: MUTED, fontSize: 12, fontFamily: BODY }}>Loading events…</div>
                        ) : (
                          <EventTimeline events={eventsMap[doc.code] ?? []} />
                        )}
                      </div>

                      {/* Portal link if slug available */}
                      {doc.slug && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, color: MUTED, letterSpacing: "1.5px", fontFamily: BODY, marginBottom: 6, textTransform: "uppercase" }}>Portal Link</div>
                          <div style={{ fontSize: 12, color: "#555", fontFamily: "var(--font-mono)" }}>
                            {(process.env.NEXT_PUBLIC_APP_URL || "")}/portal/{doc.slug}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => router.push(`/admin/share?code=${doc.code}`)} style={{ ...css.btnS, padding: "7px 16px", fontSize: 12 }}>
                          Share Page
                        </button>
                        <button onClick={() => window.open(`/client/${doc.code}`, "_blank")} style={{ ...css.btnS, padding: "7px 16px", fontSize: 12 }}>
                          Preview as Client
                        </button>
                        {doc.slug && (
                          <button onClick={() => window.open(`/portal/${doc.slug}`, "_blank")} style={{ ...css.btnS, padding: "7px 16px", fontSize: 12 }}>
                            Open Portal
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p style={{ fontSize: 11, color: "#222", textAlign: "center", marginTop: 16, fontFamily: BODY }}>
          Auto-refreshing every 8s
        </p>
      </div>
    </div>
  );
}
