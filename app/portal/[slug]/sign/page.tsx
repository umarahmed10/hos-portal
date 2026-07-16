// Portal-aware signing page — keeps the client inside the portal shell.
// After signing, redirects to /portal/[slug]/status (not /client/[code]/done).
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug }       from "@/lib/data-access";
import { SignPage }           from "@/app/client/[code]/sign/SignPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalSignPage({ params }: Props) {
  const { slug } = await params;
  const session  = await getPortalSession();

  if (!session || session.slug !== slug) {
    redirect(`/portal/${slug}`);
  }

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  // If already signed, bounce back to status
  if (doc.status === "signed") {
    redirect(`/portal/${slug}/status`);
  }

  return (
    <SignPage
      doc={doc}
      redirectAfter={`/portal/${slug}/status`}
    />
  );
}
