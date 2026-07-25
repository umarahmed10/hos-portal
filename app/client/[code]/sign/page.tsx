// Server Component — fetches doc metadata, passes to client SignPage.
import { notFound, redirect } from "next/navigation";
import { getDocForClient }    from "@/lib/data-access";
import { signPdfToken }       from "@/lib/pdf-token";
import { SignPage }           from "./SignPage";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ClientSignPage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc) notFound();
  if (doc.status !== "pending") {
    redirect(`/client/${code}/done`);
  }

  // Minted server-side: this flow has no session, so the PDF link needs a
  // short-lived token bound to this code.
  const pdfToken = await signPdfToken(doc.code);

  return <SignPage doc={doc} pdfToken={pdfToken} />;
}
