// POST /api/comms/push/subscribe — store a browser PushSubscription for a client.
// Body: { code, asRole, subscription: PushSubscriptionJSON }
import { NextResponse } from "next/server";
import { z }            from "zod";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { upsertPushSubscription } from "@/lib/comms-data";

const Body = z.object({
  code:   z.string().length(6),
  asRole: z.enum(["admin", "client"]),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth:   z.string(),
    }),
  }),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { code, asRole, subscription } = parsed.data;

  const caller = await authorizeCommsCaller(code, asRole);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ua = req.headers.get("user-agent");
  await upsertPushSubscription(code.toUpperCase(), asRole, subscription, ua);
  return NextResponse.json({ ok: true });
}
