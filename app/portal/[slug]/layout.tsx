// Portal shell layout — persistent header + tab nav for all sub-routes.
// Server component: reads session cookie to get doc, renders nav + client name.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug }       from "@/lib/data-access";
import { PortalNav }          from "@/components/client/PortalNav";
import { BODY, BORDER, BG, FONT, MUTED, SURF, TEXT } from "@/lib/styles";
import { StatusBadge }        from "@/components/server/StatusBadge";
import { CommsFAB }           from "@/components/comms/CommsFAB";

interface Props {
  children: React.ReactNode;
  params:   Promise<{ slug: string }>;
}

export default async function PortalLayout({ children, params }: Props) {
  const { slug }  = await params;
  const session   = await getPortalSession();

  // Middleware already guards /portal/[slug]/*; this is a belt-and-suspenders check.
  if (!session || session.slug !== slug) {
    redirect(`/portal/${slug}`);
  }

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  return (
    <div style={{ background: BG, minHeight: "100vh", color: TEXT, fontFamily: "var(--font-body)" }}>

      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, background: BG }}>
        <div style={{
          maxWidth:    900,
          margin:      "0 auto",
          padding:     "14px 24px",
          display:     "flex",
          alignItems:  "center",
          justifyContent: "space-between",
          gap:         16,
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "2.5px", color: MUTED, fontFamily: "var(--font-body)", fontWeight: 700, marginBottom: 2 }}>
              HOS AUTOMATIONS
            </div>
            <div style={{ fontFamily: "var(--font-header)", fontSize: 18, fontWeight: 800, color: TEXT, letterSpacing: "0.3px" }}>
              CLIENT PORTAL
            </div>
          </div>

          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>
              {doc.name}
            </div>
            {doc.company && (
              <div style={{ fontSize: 11, color: MUTED }}>{doc.company}</div>
            )}
            <StatusBadge status={doc.status} />
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <PortalNav slug={slug} />

      {/* Page content */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
        {children}
      </main>

      {/* Floating call button — links to /comms-test/client/[code] */}
      <CommsFAB code={doc.code} />
    </div>
  );
}
