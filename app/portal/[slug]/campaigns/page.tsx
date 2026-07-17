// Portal Campaign Updates tab — placeholder for future campaign status and creatives.
import { redirect }         from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { BODY, BORDER, FONT, MUTED, SUBTLE, SURF, TEXT, css } from "@/lib/styles";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalCampaignsPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          CAMPAIGN UPDATES
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, letterSpacing: "-0.5px", color: TEXT, marginBottom: 8 }}>
          Your Campaign
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
          Campaign status updates, creative previews, and targeting details will be shared here.
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: SUBTLE, marginBottom: 8, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Campaign Not Yet Active
        </div>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 360, margin: "0 auto" }}>
          Once your invoice is settled and your account is fully activated, we will begin campaign setup and post updates here.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        {[
          { label: "Campaign Status", value: "Pending Activation" },
          { label: "Target Service Area", value: "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: SURF, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "18px 20px" }}>
            <div style={{ fontSize: 10, color: MUTED, fontFamily: BODY, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: SUBTLE }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
