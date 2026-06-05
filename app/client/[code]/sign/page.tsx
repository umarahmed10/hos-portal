// Server Component — fetches doc metadata, passes to client SignPage.
import { notFound }        from "next/navigation";
import { getDocForClient } from "@/lib/data-access";
import { SignPage }        from "./SignPage";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function ClientSignPage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocForClient(code.toUpperCase());

  if (!doc)                  notFound();
  if (doc.status !== "pending") {
    // Already signed — redirect to done
    return notFound();
  }

  return <SignPage doc={doc} />;
}
