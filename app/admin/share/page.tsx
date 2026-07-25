// Server Component — fetches doc by code query param, renders share screen.
import { notFound }    from "next/navigation";
import { getDocByCode, getDocEvents } from "@/lib/data-access";
import { AdminShare }   from "@/components/client/AdminShare";

export const metadata = { title: "Share · HOS Admin" };

interface Props {
  searchParams: Promise<{ code?: string; sent?: string }>;
}

export default async function AdminSharePage({ searchParams }: Props) {
  const { code, sent } = await searchParams;
  if (!code) notFound();

  const doc    = await getDocByCode(code);
  if (!doc) notFound();

  const events = await getDocEvents(doc.id).catch(() => []);

  return <AdminShare doc={doc} events={events} sent={sent === "1"} />;
}
