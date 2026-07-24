import { notFound } from "next/navigation";
import { getDocByCode } from "@/lib/data-access";
import { ClientCommsUI } from "./ClientCommsUI";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return {
    title: `HOS · ${code.toUpperCase()}`,
    manifest: "/manifest.webmanifest",
  };
}

export default async function CommsClientPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const upper = code.toUpperCase();
  const doc = await getDocByCode(upper);
  if (!doc) notFound();

  return (
    <ClientCommsUI
      code={upper}
      clientName={doc.name}
      slug={doc.slug ?? null}
      vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      snapshot={{
        company:        doc.company ?? null,
        status:         doc.status,
        paymentStatus:  doc.payment_status,
        callsTotal:     Number(doc.calls_total     ?? 0),
        callsQualified: Number(doc.calls_qualified ?? 0),
        jobsBooked:     Number(doc.jobs_booked     ?? 0),
      }}
    />
  );
}
