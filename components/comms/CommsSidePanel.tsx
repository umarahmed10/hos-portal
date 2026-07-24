"use client";
// Discord-style right context panel for the client comms page. Fills the screen
// with things worth looking at (Discord's profile column): who you're talking
// to, the live state of YOUR campaign, quick portal actions, and recent files
// shared in this conversation. All data is real — no invented numbers.
import { useEffect, useState } from "react";
import Link from "next/link";
import { HOSTeamAvatar } from "@/components/comms/HOSTeamAvatar";
import { BG, SURF, SURF_2, BORDER, TEXT, MUTED, GOLD, GREEN } from "@/lib/styles";

export interface CampaignSnapshot {
  company:        string | null;
  status:         string;
  paymentStatus:  string;
  callsTotal:     number;
  callsQualified: number;
  jobsBooked:     number;
}

interface SharedFile { url: string; filename: string; type: string; at: string }

interface Props {
  code: string;
  slug: string | null;
  snapshot: CampaignSnapshot;
}

const LABEL: React.CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em",
  textTransform: "uppercase", color: GOLD, marginBottom: 10,
};

export function CommsSidePanel({ code, slug, snapshot }: Props) {
  const [files, setFiles] = useState<SharedFile[]>([]);

  // Pull recent shared attachments out of the conversation (one light fetch).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/comms/messages?code=${code}&asRole=client`);
        const j = await r.json();
        if (cancelled || !j.ok) return;
        const found: SharedFile[] = [];
        for (const m of (j.data.messages as { body: string; created_at: string }[])) {
          try {
            const p = JSON.parse(m.body);
            if (p && typeof p === "object" && typeof p.url === "string" && typeof p.filename === "string") {
              found.push({ url: p.url, filename: p.filename, type: String(p.type ?? ""), at: m.created_at });
            }
          } catch { /* not an attachment */ }
        }
        setFiles(found.slice(-4).reverse());
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const live = snapshot.status === "signed" && snapshot.paymentStatus === "paid";

  return (
    <aside className="comms-side-panel" style={{
      width: 300, flexShrink: 0, borderLeft: `1px solid ${BORDER}`,
      background: SURF, overflowY: "auto", display: "flex", flexDirection: "column",
    }}>
      {/* Profile card — bronze banner + avatar, Discord profile style */}
      <div style={{ position: "relative" }}>
        <div style={{ height: 72, background: "linear-gradient(120deg, rgba(139,107,62,0.35), rgba(139,107,62,0.08))" }} />
        <div style={{
          position: "absolute", top: 36, left: 18,
          width: 68, height: 68, borderRadius: "50%", background: SURF,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `4px solid ${SURF}`,
        }}>
          <HOSTeamAvatar size={60} />
          <span style={{
            position: "absolute", bottom: 2, right: 2, width: 15, height: 15,
            borderRadius: "50%", background: GREEN, border: `3px solid ${SURF}`,
          }} />
        </div>
      </div>
      <div style={{ padding: "40px 18px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)" }}>HOS Team</div>
        <div style={{ fontSize: 11, color: GREEN, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginTop: 2 }}>ONLINE</div>
        <p style={{ fontSize: 12, color: MUTED, fontFamily: "var(--font-body)", lineHeight: 1.55, margin: "10px 0 0" }}>
          Your growth team. Call or message any time — a real person answers.
        </p>
      </div>

      {/* Campaign snapshot — real numbers only */}
      <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={LABEL}>Your campaign</div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12,
          padding: "3px 10px", borderRadius: 20,
          background: live ? "rgba(78,173,135,0.1)" : "rgba(139,107,62,0.1)",
          border: `1px solid ${live ? "rgba(78,173,135,0.3)" : "rgba(139,107,62,0.3)"}`,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: live ? GREEN : GOLD }} />
          <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase", color: live ? GREEN : GOLD, fontWeight: 600 }}>
            {live ? "Live" : "Getting set up"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { n: snapshot.callsTotal,     l: "Calls" },
            { n: snapshot.callsQualified, l: "Qualified" },
            { n: snapshot.jobsBooked,     l: "Jobs" },
          ].map(({ n, l }) => (
            <div key={l} style={{ background: SURF_2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: TEXT, fontFamily: "var(--font-ui)", letterSpacing: "-0.02em", lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 8, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 5 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      {slug && (
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={LABEL}>Quick actions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { href: `/portal/${slug}/dashboard`, label: "Growth dashboard", icon: <BarsIcon /> },
              { href: `/portal/${slug}/performance`, label: "Call performance", icon: <PhoneMiniIcon /> },
              { href: `/portal/${slug}/invoices`, label: "Billing & invoices", icon: <CardIcon /> },
            ].map(({ href, label, icon }) => (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                borderRadius: 8, textDecoration: "none", color: TEXT,
                fontSize: 12.5, fontFamily: "var(--font-body)", fontWeight: 500,
                background: "transparent", transition: "background 120ms",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(243,241,236,0.05)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color: GOLD, display: "flex" }}>{icon}</span>
                {label}
                <span style={{ marginLeft: "auto", color: MUTED, fontSize: 11 }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent shared files */}
      <div style={{ padding: "16px 18px" }}>
        <div style={LABEL}>Shared files</div>
        {files.length === 0 ? (
          <p style={{ fontSize: 11.5, color: MUTED, fontFamily: "var(--font-body)", lineHeight: 1.55, margin: 0 }}>
            Files you share in the chat show up here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{
                display: "flex", alignItems: "center", gap: 9, padding: "8px 10px",
                borderRadius: 8, background: SURF_2, border: `1px solid ${BORDER}`,
                textDecoration: "none", minWidth: 0,
              }}>
                {f.type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: BG }} />
                ) : (
                  <span style={{ width: 30, height: 30, borderRadius: 6, background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileIcon />
                  </span>
                )}
                <span style={{ fontSize: 11.5, color: TEXT, fontFamily: "var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.filename}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1000px) { .comms-side-panel { display: none !important; } }
      `}</style>
    </aside>
  );
}

function BarsIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>;
}
function PhoneMiniIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>;
}
function CardIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="14" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
}
function FileIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8B6B3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
