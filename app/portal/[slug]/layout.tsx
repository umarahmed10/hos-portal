// Portal shell layout — persistent header + tab nav for all sub-routes.
import { notFound }                from "next/navigation";
import { getPortalSession }        from "@/lib/portal-auth";
import { getDocBySlug }            from "@/lib/data-access";
import { PortalNav }               from "@/components/client/PortalNav";
import { StatusBadge }             from "@/components/server/StatusBadge";
import { PortalLogoutButton }      from "@/components/client/PortalLogoutButton";
import { AutoRefresh }             from "@/components/client/AutoRefresh";
import { HOSLogo }                 from "@/components/shared/HOSLogo";
import { FloatingSupport }         from "@/components/client/FloatingSupport";
import { CommsFAB }                from "@/components/comms/CommsFAB";
import { IncomingCallListener }    from "@/components/comms/IncomingCallListener";
import { AvatarPicker }            from "@/components/client/AvatarPicker";
import { BORDER, BG, MUTED, TEXT } from "@/lib/styles";

interface Props {
  children: React.ReactNode;
  params:   Promise<{ slug: string }>;
}

export default async function PortalLayout({ children, params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();

  // No active session → render children without the portal shell.
  // The entry page handles its own auth to avoid infinite redirect loops.
  if (!session || session.slug !== slug) {
    return <>{children}</>;
  }

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const isActive = doc.payment_status === "paid";

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "var(--font-body)" }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid rgba(243,241,236,0.05)`, background: "#111111" }}>
        <div style={{
          maxWidth:       800,
          margin:         "0 auto",
          padding:        "14px 20px",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            16,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <HOSLogo size={24} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "2px", color: MUTED, textTransform: "uppercase", marginBottom: 1 }}>
                HOS
              </div>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: TEXT, letterSpacing: "0.3px" }}>
                Client Portal
              </div>
            </div>
          </div>

          {/* Right — avatar + client info + status + logout */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
            <AvatarPicker code={doc.code} name={doc.name} size={32} />
            <div style={{ textAlign: "right", minWidth: 0, maxWidth: 160, overflow: "hidden" }}>
              <div style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {doc.name}
              </div>
              {doc.company && (
                <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: MUTED, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {doc.company}
                </div>
              )}
            </div>
            <StatusBadge status={doc.status} />
            <PortalLogoutButton slug={slug} />
          </div>
        </div>
      </div>

      {/* Tab nav — only shown when portal is active (paid) */}
      {isActive ? (
        <PortalNav slug={slug} mode="active" />
      ) : (
        <PortalNav slug={slug} mode="onboarding" />
      )}

      {/* Page content */}
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px 100px" }}>
        {children}
      </main>

      {/* Floating call button (left of support bubble) */}
      <CommsFAB code={doc.code} />

      {/* Global incoming call listener — rings on ANY portal page */}
      <IncomingCallListener code={doc.code} clientName={doc.name} />

      {/* Floating support button */}
      <FloatingSupport slug={slug} name={doc.name} />

      {/* Silently refresh server data every 30s so nav mode and payment status stay current */}
      <AutoRefresh intervalMs={30000} />
    </div>
  );
}
