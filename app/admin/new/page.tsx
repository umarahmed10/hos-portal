import { AdminForm } from "@/components/client/AdminForm";

export const metadata = { title: "New client · HOS Admin" };

export const dynamic = "force-dynamic";

export default function AdminNewPage() {
  return <AdminForm mode="new" />;
}
