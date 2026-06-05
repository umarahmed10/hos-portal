// Portal Call Reports tab — placeholder for future call reporting metrics.
import { redirect }         from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { BODY, BORDER, FONT, MUTED, SURF, TEXT, css } from "@/lib/styles";

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
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          CALL REPORTS
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 900, letterSpacing: "-0.5px", color: TEXT, marginBottom: 8 }}>
          Call Performance
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
          Detailed call reports and analytics will appear here once your campaign is live.
        </p>
      </div>

      <div style={{ ...css.card, padding: "48px 32px", textAlign: "center" }}>
        <div style={{
          width:      56, height: 56,
          borderRadius: "50%",
          border:     "1px solid #1d1d1d",
          background: "#0d0d0d",
          display:    "flex", alignItems: "center", justifyContent: "center",
          margin:     "0 auto 20px",
          fontSize:   24,
        }}>
          📊
        </div>
        <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: "#2a2a2a", marginBottom: 8 }}>
          COMING SOON
        </div>
        <p style={{ color: "#2a2a2a", fontSize: 13, lineHeight: 1.7, maxWidth: 320, margin: "0 auto" }}>
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
            <div style={{ fontFamily: "var(--font-header)", fontSize: 28, fontWeight: 800, color: "#2a2a2a" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
