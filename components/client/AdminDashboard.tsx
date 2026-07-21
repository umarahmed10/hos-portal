"use client";
import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import { useCountUp }          from "@/lib/hooks/useStaggeredReveal";
import useSWR                  from "swr";
import { toast }               from "sonner";
import { fetchAllDocs, archiveDoc, logoutAdmin } from "@/lib/api-client";
import { money, fmtDateTime }  from "@/lib/utils";
import {
  AMBER, AMBER_DIM, AMBER_BORDER, BORDER,
  GREEN, GREEN_DIM, GREEN_BORDER, MUTED, SUBTLE, SURF, SURF_HOVER, TEXT, css,
} from "@/lib/styles";
import { StatusBadge }   from "@/components/server/StatusBadge";
import { HOSLogo }       from "@/components/shared/HOSLogo";
import { CopyButton }    from "./CopyButton";
import { EventTimeline } from "./EventTimeline";
import { Search, Plus, Edit, Archive, Download, LogOut } from "@/components/shared/Icons";
import type { Doc, DocEvent, PaymentStatus } from "@/types";

interface Props {
  initialDocs: Doc[];
}

const NOW         = new Date();
const MONTH_START = new Date(NOW.getFullYear(), NOW.getMonth(), 1).toISOString();

function thisMonth(iso: string | null): boolean {
  return !!iso && iso >= MONTH_START;
}

async function fetchEvents(code: string): Promise<DocEvent[]> {
  const res  = await fetch(`/api/docs/${code}/events`);
  const json = await res.json();
  return json.ok ? json.data : [];
}

// Compact date: "Jun 7 · 12:20 AM"
function fmtShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Bronze = PARTIAL (not purple)
const PAYMENT_BADGE: Record<PaymentStatus, { bg: string; color: string; border: string; label: string }> = {
  unpaid:          { bg: AMBER_DIM,                     color: AMBER,     border: AMBER_BORDER,                    label: "UNPAID"  },
  partially_paid:  { bg: "rgba(139,107,62,0.10)",       color: "#C9A96E", border: "rgba(139,107,62,0.3)",          label: "PARTIAL" },
  paid:            { bg: GREEN_DIM,                     color: GREEN,     border: GREEN_BORDER,                    label: "PAID"    },
};

function InlinePaymentDropdown({ doc, onUpdate }: { doc: Doc; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const badge = PAYMENT_BADGE[doc.payment_status ?? "unpaid"];

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation();
    const newStatus = e.target.value as PaymentStatus;
    setSaving(true);

    const payload: Record<string, unknown> = { payment_status: newStatus };
    if (newStatus === "paid")   payload.amount_paid = doc.invoice_total;
    if (newStatus === "unpaid") payload.amount_paid = 0;

    await fetch(`/api/docs/${doc.code}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    setSaving(false);
    onUpdate();
  }

  return (
    <select
      value={doc.payment_status ?? "unpaid"}
      onChange={handleChange}
      disabled={saving}
      onClick={e => e.stopPropagation()}
      style={{
        background:    badge.bg,
        color:         badge.color,
        border:        `1px solid ${badge.border}`,
        borderRadius:  20,
        fontSize:      10,
        fontFamily:    "var(--font-mono)",
        fontWeight:    700,
        letterSpacing: "0.5px",
        padding:       "3px 8px",
        cursor:        saving ? "not-allowed" : "pointer",
        outline:       "none",
        opacity:       saving ? 0.5 : 1,
        flexShrink:    0,
        appearance:    "none",
        WebkitAppearance: "none",
        paddingRight:  "18px",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23727272'/%3E%3C/svg%3E")`,
        backgroundRepeat:   "no-repeat",
        backgroundPosition: "right 6px center",
      }}
    >
      <option value="unpaid">UNPAID</option>
      <option value="partially_paid">PARTIAL</option>
      <option value="paid">PAID</option>
    </select>
  );
}

function KPICard({ label, value, color, note, big, accent, delay = 0 }: {
  label: string; value: number | string; color: string; note: string; big: boolean; accent: boolean; delay?: number;
}) {
  const isNumeric = typeof value === "number";
  const counted   = useCountUp(isNumeric ? value : 0, 700, delay + 200);

  return (
    <div
      style={{
        background:   "#1A1A1A",
        border:       `1px solid ${BORDER}`,
        borderTop:    accent ? "2px solid #8B6B3E" : `1px solid ${BORDER}`,
        borderRadius: 10,
        padding:      "18px 18px 14px",
        animation:    `fadeUp 320ms var(--ease-out) ${delay}ms both`,
        transition:   "transform 200ms var(--ease-out), box-shadow 200ms",
        cursor:       "default",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-ui)", fontSize: big ? 44 : 28, fontWeight: 600, color, letterSpacing: "-0.035em", lineHeight: 1, marginBottom: 4, animation: "countUp 500ms var(--ease-out) both" }}>
        {isNumeric ? counted : value}
      </div>
      <div style={{ fontSize: 10, color: SUBTLE, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {note}
      </div>
    </div>
  );
}

export function AdminDashboard({ initialDocs }: Props) {
  const router  = useRouter();
  const [query, setQuery]         = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [eventsMap, setEventsMap] = useState<Record<string, DocEvent[]>>({});
  const [loadingEvt, setLoadingEvt] = useState<string | null>(null);

  const { data: docs = initialDocs, mutate: refreshDocs } = useSWR<Doc[]>(
    "/api/docs",
    fetchAllDocs,
    { refreshInterval: 0, revalidateOnFocus: true, fallbackData: initialDocs }
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? docs.filter(d =>
        d.name.toLowerCase().includes(q) ||
        (d.company ?? "").toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        (d.service ?? "").toLowerCase().includes(q)
      )
    : docs;

  // ── Metrics ───────────────────────────────────────────────────────────────
  const activeClients     = docs.filter(d => d.status === "signed").length;
  const pendingSignatures = docs.filter(d => d.status === "pending").length;
  const monthlyRevenue    = docs
    .filter(d => d.status === "signed" && thisMonth(d.signed_at))
    .reduce((s, d) => s + Number(d.invoice_total), 0);
  const thisMonthCollected = docs
    .filter(d => thisMonth(d.updated_at) && Number(d.amount_paid) > 0)
    .reduce((s, d) => s + Number(d.amount_paid), 0);

  const METRICS = [
    { label: "Active Clients",       value: activeClients,             color: TEXT,  note: "Signed",      big: true,  accent: true },
    { label: "Pending Signatures",   value: pendingSignatures,         color: AMBER, note: "Need action", big: true,  accent: false },
    { label: "Monthly Revenue",      value: money(monthlyRevenue),     color: TEXT,  note: "This month",  big: false, accent: false },
    { label: "This Month Collected", value: money(thisMonthCollected), color: TEXT,  note: "Amount paid", big: false, accent: false },
  ];

  async function handleExpand(code: string) {
    const next = expanded === code ? null : code;
    setExpanded(next);
    if (next && !eventsMap[next]) {
      setLoadingEvt(next);
      const events = await fetchEvents(next);
      setEventsMap(prev => ({ ...prev, [next]: events }));
      setLoadingEvt(null);
    }
  }

  async function handleArchive(code: string, name: string) {
    if (!confirm(`Archive document for ${name}? This cannot be undone.`)) return;
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
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setExpanded(null); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div style={{
          maxWidth:       1200,
          margin:         "0 auto",
          padding:        "14px 24px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HOSLogo size={28} theme="dark" showWordmark={false} />
            <div>
              <div className="admin-header-wordmark" style={{ fontSize: 9, letterSpacing: "2.5px", color: MUTED, fontFamily: "var(--font-mono)", fontWeight: 700, marginBottom: 2, textTransform: "uppercase" }}>
                HOS
              </div>
              <div className="admin-header-title" style={{ fontFamily: "var(--font-ui)", fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}>
                Admin Dashboard
              </div>
            </div>
          </div>
          <div className="admin-nav-actions" style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => refreshDocs()}
              title="Refresh"
              style={{ ...css.btnS, padding: "9px 12px", fontSize: 12, display: "flex", alignItems: "center" }}
            >
              ↻
            </button>
            <button
              onClick={() => router.push("/comms-test/admin")}
              title="Voice + text with clients"
              style={{ ...css.btnS, display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B6B3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
              </svg>
              <span className="admin-new-client-label">Comms</span>
            </button>
            <button
              onClick={() => router.push("/admin/new")}
              style={{ ...css.btnP, display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", fontSize: 12 }}
            >
              <Plus size={13} />
              <span className="admin-new-client-label">New Client</span>
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              style={{ ...css.btnS, display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", fontSize: 12 }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px" }}>

        {/* ── Metrics ─────────────────────────────────────────────────────── */}
        <div className="admin-metrics-grid" style={{
          display:             "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap:                 10,
          marginBottom:        24,
        }}>
          {METRICS.map(({ label, value, color, note, big, accent }, idx) => (
            <KPICard key={label} label={label} value={value} color={color} note={note} big={big} accent={accent} delay={idx * 60} />
          ))}
        </div>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search size={14} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: MUTED, pointerEvents: "none" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients by name, company, or code…"
            style={{ ...css.inp, paddingLeft: 38 }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position:   "absolute",
                right:      10,
                top:        "50%",
                transform:  "translateY(-50%)",
                background: "none",
                border:     "none",
                color:      MUTED,
                cursor:     "pointer",
                fontSize:   16,
                lineHeight: 1,
                padding:    "2px 4px",
                minHeight:  "unset",
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* ── Client list ──────────────────────────────────────────────────── */}
        <div style={{ background: "#1A1A1A", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "52px 24px", textAlign: "center", color: MUTED, fontSize: 13, fontFamily: "var(--font-body)" }}>
              {query
                ? `No clients found for "${query}".`
                : "No clients yet — create your first above."}
            </div>
          ) : (
            filtered.map(doc => {
              const viewedNotSigned =
                doc.status === "pending" &&
                !!doc.first_view_ip &&
                !doc.signature &&
                !doc.signed_at;
              const payBadge = doc.payment_status ?? "unpaid";

              return (
                <div key={doc.id}>
                  {/* ── Row ── */}
                  <div
                    className="admin-list-row"
                    onClick={() => handleExpand(doc.code)}
                    style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          10,
                      padding:      "13px 20px",
                      borderBottom: `1px solid ${BORDER}`,
                      cursor:       "pointer",
                      transition:   "background 120ms",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = SURF_HOVER)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Status */}
                    <div style={{ flexShrink: 0 }}>
                      <StatusBadge status={doc.status} />
                    </div>

                    {/* Viewed-not-signed amber dot */}
                    {viewedNotSigned && (
                      <div
                        title="Client viewed but hasn't signed yet"
                        style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, flexShrink: 0 }}
                      />
                    )}

                    {/* Name / company */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="admin-list-name" style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 15, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {doc.name}
                      </div>
                      <div className="admin-list-row-meta" style={{ fontSize: 12, color: MUTED, marginTop: 2, fontFamily: "var(--font-body)" }}>
                        <span className="admin-list-company">{doc.company || "—"}</span>
                        {" · "}
                        <span>{fmtShort(doc.created_at)}</span>
                      </div>
                    </div>

                    {/* Inline payment dropdown */}
                    {doc.status !== "draft" && doc.status !== "archived" && (
                      <div className="admin-table-amount" onClick={e => e.stopPropagation()}>
                        <InlinePaymentDropdown doc={doc} onUpdate={() => refreshDocs()} />
                      </div>
                    )}

                    {/* Code */}
                    <div className="admin-table-code admin-list-code-text" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: SUBTLE, letterSpacing: "2px", flexShrink: 0 }}>
                      {doc.code}
                    </div>

                    {/* Invoice total */}
                    {doc.invoice_total > 0 && (
                      <div className="admin-table-amount" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: MUTED, flexShrink: 0, minWidth: 70, textAlign: "right" }}>
                        {money(doc.invoice_total)}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="admin-list-actions" style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <CopyButton text={doc.code} label="Code" size="sm" />
                      <button
                        onClick={() => router.push(`/admin/share?code=${doc.code}`)}
                        title="Share"
                        style={{ ...css.btnS, padding: "6px 10px", fontSize: 11 }}
                      >
                        <span className="admin-list-action-label">Share</span>
                        <span style={{ display: "none" }} className="admin-list-action-icon">⬆</span>
                      </button>
                      <button
                        onClick={() => router.push(`/admin/stats?code=${doc.code}`)}
                        title="Performance stats"
                        style={{ ...css.btnS, padding: "6px 10px", fontSize: 11 }}
                      >
                        Stats
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

                  {/* ── Expanded detail ── */}
                  {expanded === doc.code && (
                    <div style={{
                      padding:      "20px 24px",
                      borderBottom: `1px solid ${BORDER}`,
                      background:   "#0b0b0b",
                      animation:    "fadeUp 280ms var(--ease-out) both",
                    }}>

                      {viewedNotSigned && (
                        <div style={{
                          background:   AMBER_DIM,
                          border:       `1px solid ${AMBER_BORDER}`,
                          borderRadius: 8,
                          padding:      "12px 16px",
                          marginBottom: 18,
                          display:      "flex",
                          alignItems:   "center",
                          gap:          10,
                        }}>
                          <span style={{ color: AMBER, fontSize: 14 }}>⚠</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: AMBER, fontFamily: "var(--font-body)" }}>
                              Client Has Viewed But Not Signed
                            </div>
                            <div style={{ fontSize: 11, color: MUTED, fontFamily: "var(--font-body)", marginTop: 2 }}>
                              Consider a follow-up message or resending the magic link.
                            </div>
                          </div>
                          <button
                            onClick={() => router.push(`/admin/share?code=${doc.code}`)}
                            style={{ ...css.btnS, marginLeft: "auto", padding: "6px 14px", fontSize: 11, whiteSpace: "nowrap" }}
                          >
                            Resend →
                          </button>
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
                        {doc.agreement_text && (
                          <div>
                            <div style={{ fontSize: 9, color: MUTED, letterSpacing: "1.5px", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase" }}>
                              Agreement Preview
                            </div>
                            <div style={{
                              fontSize:   12,
                              color:      "#555",
                              lineHeight: 1.7,
                              fontFamily: "var(--font-display)",
                              maxHeight:  110,
                              overflow:   "hidden",
                              maskImage:  "linear-gradient(to bottom, black 60%, transparent)",
                            }}>
                              {doc.agreement_text.slice(0, 380)}…
                            </div>
                          </div>
                        )}
                        {doc.signature && (
                          <div>
                            <div style={{ fontSize: 9, color: MUTED, letterSpacing: "1.5px", fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase" }}>
                              Signature
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={doc.signature}
                              alt="Signature"
                              style={{ maxWidth: 240, height: "auto", background: "#1A1A1A", borderRadius: 6, padding: 6, border: `1px solid ${BORDER}` }}
                            />
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 9, color: MUTED, letterSpacing: "1.5px", fontFamily: "var(--font-mono)", marginBottom: 10, textTransform: "uppercase" }}>
                          Event Timeline
                        </div>
                        {loadingEvt === doc.code
                          ? <div style={{ color: MUTED, fontSize: 12, fontFamily: "var(--font-body)" }}>Loading events…</div>
                          : <EventTimeline events={eventsMap[doc.code] ?? []} />
                        }
                      </div>

                      {doc.slug && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 9, color: MUTED, letterSpacing: "1.5px", fontFamily: "var(--font-mono)", marginBottom: 5, textTransform: "uppercase" }}>
                            Portal URL
                          </div>
                          <div style={{ fontSize: 12, color: MUTED, fontFamily: "var(--font-mono)" }}>
                            {process.env.NEXT_PUBLIC_APP_URL || ""}/portal/{doc.slug}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        <button onClick={() => router.push(`/admin/share?code=${doc.code}`)} style={{ ...css.btnP, padding: "8px 18px", fontSize: 12 }}>
                          Share Page
                        </button>
                        <button onClick={() => window.open(`/client/${doc.code}`, "_blank")} style={{ ...css.btnS, padding: "8px 16px", fontSize: 12 }}>
                          Preview as Client
                        </button>
                        <button onClick={() => window.open(`/api/pdf?code=${doc.code}`, "_blank")} style={{ ...css.btnS, padding: "8px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                          <Download size={12} /> PDF
                        </button>
                        {doc.slug && (
                          <button onClick={() => window.open(`/portal/${doc.slug}`, "_blank")} style={{ ...css.btnS, padding: "8px 16px", fontSize: 12 }}>
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
      </div>
    </div>
  );
}
