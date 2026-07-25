// Server Component — fetches doc, passes to AdminForm in edit mode.
import { notFound }    from "next/navigation";
import { getDocByCode } from "@/lib/data-access";
import { AdminForm }    from "@/components/client/AdminForm";

export const metadata = { title: "Edit client · HOS Admin" };

interface Props {
  params: Promise<{ code: string }>;
}

export default async function AdminEditPage({ params }: Props) {
  const { code } = await params;
  const doc      = await getDocByCode(code);
  if (!doc) notFound();

  return <AdminForm mode="edit" initialDoc={doc} />;
}
