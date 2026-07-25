import { redirect }        from "next/navigation";
import { getAdminSession }  from "@/lib/auth";
import { getDocByCode }     from "@/lib/data-access";
import { AdminStats }       from "@/components/client/AdminStats";
import { createClient }     from "@supabase/supabase-js";

export const metadata = { title: "Stats · HOS Admin" };

interface Props {
  searchParams: Promise<{ code?: string }>;
}

async function getDailyMetrics(docId: string) {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await db
    .from("daily_metrics")
    .select("id, date, spend, calls_total, calls_qualified")
    .eq("doc_id", docId)
    .order("date", { ascending: false })
    .limit(31);
  return data ?? [];
}

export default async function AdminStatsPage({ searchParams }: Props) {
  const session = await getAdminSession();
  if (!session) redirect("/");

  const sp   = await searchParams;
  const code = sp.code?.toUpperCase();
  if (!code) redirect("/admin");

  const doc = await getDocByCode(code);
  if (!doc) redirect("/admin");

  const metrics = await getDailyMetrics(doc.id);

  return <AdminStats doc={doc} initialMetrics={metrics} />;
}
