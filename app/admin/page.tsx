// Server Component — fetches all docs, passes to interactive dashboard.
import { getAllDocs }       from "@/lib/data-access";
import { AdminDashboard }  from "@/components/client/AdminDashboard";

export const metadata = { title: "Dashboard · HOS Admin" };

export const dynamic = "force-dynamic"; // always fresh; no stale SSR cache

export default async function AdminPage() {
  const docs = await getAllDocs();
  return <AdminDashboard initialDocs={docs} />;
}
