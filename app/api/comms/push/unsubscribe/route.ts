// POST /api/comms/push/unsubscribe — remove a stored PushSubscription.
// Body: { endpoint: string }
import { NextResponse } from "next/server";
import { z }            from "zod";
import { deletePushSubscription } from "@/lib/comms-data";

const Body = z.object({ endpoint: z.string().url() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  // No auth check — the endpoint is the caller's own subscription ID.
  // Worst case an attacker with the endpoint can only unsubscribe a device.
  await deletePushSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
