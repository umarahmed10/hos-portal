// Smart payment router — routes to Skydo (>= cutoff) or Wise (< cutoff) based on
// the invoice amount, with a branded "pay securely via {provider}" experience.
// Skydo/Wise have no embeddable gateway, so the final step opens their secure
// page; this keeps the client in a branded HOS flow up to that point.
import { money } from "@/lib/utils";
import { TEXT, MUTED } from "@/lib/styles";

interface Props {
  paymentLink: string;
  amount: number;
  cutoff: number;
}

export function PayButton({ paymentLink, amount, cutoff }: Props) {
  const useSkydo = amount >= cutoff;
  const provider = useSkydo ? "Skydo" : "Wise";
  const note     = useSkydo ? "Secure international transfer" : "Fast, low-fee transfer";
  const accent   = useSkydo ? "#2E6BE6" : "#9FE870"; // Skydo blue / Wise green

  return (
    <div>
      <a
        href={paymentLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", gap: 12, textDecoration: "none",
          padding: "15px 20px", borderRadius: 12,
          background: TEXT, color: "#111111",
          fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 15,
          boxShadow: `0 6px 20px rgba(0,0,0,0.25)`,
        }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <span style={{ flex: 1 }}>Pay {money(amount)}</span>
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>via {provider} →</span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontFamily: "var(--font-body)", fontSize: 11.5, color: MUTED }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        {note} · you&apos;ll finish on {provider}&apos;s secure page.
      </div>
    </div>
  );
}
