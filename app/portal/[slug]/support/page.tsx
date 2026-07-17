// Portal Support tab — AI-powered HOS support chatbot.
import { redirect }         from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { SupportChat }      from "@/components/client/SupportChat";
import { BODY, FONT, MUTED, TEXT } from "@/lib/styles";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalSupportPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.14em", fontWeight: 500, color: MUTED, fontFamily: "var(--font-mono)", textTransform: "uppercase", marginBottom: 8 }}>
          Support
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 28, fontWeight: 600, letterSpacing: "-0.3px", color: TEXT, marginBottom: 8 }}>
          How can we help?
        </h2>
        <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.7, maxWidth: 520, margin: 0 }}>
          Ask anything about billing, onboarding, call quality, or your campaign. For account-specific questions, reply to your onboarding email.
        </p>
      </div>

      <SupportChat />
    </div>
  );
}
