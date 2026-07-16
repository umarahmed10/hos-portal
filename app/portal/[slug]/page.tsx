// Portal entry — server component with session check.
// Authenticated users are immediately redirected; paid clients go to /dashboard.
// Unauthenticated users see the magic-link / code-entry UI.
import { redirect }         from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { getDocBySlug }     from "@/lib/data-access";
import { PortalEntryUI }    from "./PortalEntryUI";

interface Props {
  params:       Promise<{ slug: string }>;
  searchParams: Promise<{ mt?: string }>;
}

export default async function PortalEntryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);

  // Already authenticated — skip entry UI and redirect to the right tab
  const session = await getPortalSession();
  if (session?.slug === slug) {
    const doc = await getDocBySlug(slug);
    if (doc?.payment_status === "paid") {
      redirect(`/portal/${slug}/dashboard`);
    }
    redirect(`/portal/${slug}/status`);
  }

  return <PortalEntryUI slug={slug} magicToken={sp.mt ?? null} />;
}
