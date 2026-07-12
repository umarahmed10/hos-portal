import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { getAllDocs } from "@/lib/data-access";
import { AdminCommsUI } from "./AdminCommsUI";

export const dynamic = "force-dynamic";

export const metadata = { title: "HOS Comms · Admin" };

export default async function CommsAdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin?next=/comms-test/admin");

  const docs = await getAllDocs();
  const clients = docs.map(d => ({
    code:    d.code,
    name:    d.name,
    company: d.company,
  }));

  return <AdminCommsUI clients={clients} />;
}
