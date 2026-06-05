// Server Component — fetches doc by code query param, renders share screen.
import { notFound }    from "next/navigation";
import { getDocByCode } from "@/lib/data-access";
import { AdminShare }   from "@/components/client/AdminShare";

interface Props {
  searchParams: Promise<{ code?: string }>;
}

export default async function AdminSharePage({ searchParams }: Props) {
  const { code } = await searchParams;
  if (!code) notFound();

  const doc = await getDocByCode(code);
  if (!doc) notFound();

  return <AdminShare doc={doc} />;
}
