// Portal Call Reports tab — placeholder for future call reporting metrics.
import { redirect }         from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { BODY, BORDER, FONT, MUTED, SUBTLE, SURF, TEXT, css } from "@/lib/styles";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalReportsPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          CALL REPORTS
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px", color: TEXT, marginBottom: 8 }}>
          Call Performance
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
          Detailed call reports and analytics will appear here once your campaign is live.
        </p>
      </div>

      <div style={{ ...css.card, padding: "48px 32px", textAlign: "center" }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: "50%",
          border: "1px solid rgba(139,107,62,0.2)",
          background: "rgba(139,107,62,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B6B3E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: SUBTLE, marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Coming Soon
        </div>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
          Your call volume, call durations, qualified call counts, and weekly summaries will show here once your campaign is active.
        </p>
      </div>

      {/* Placeholder metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
        {[
          { label: "Total Calls",      value: "—" },
          { label: "Qualified Calls",  value: "—" },
          { label: "Avg. Duration",    value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 700, color: SUBTLE }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
