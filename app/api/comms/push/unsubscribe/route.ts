// POST /api/comms/push/unsubscribe — remove a stored PushSubscription.
// Body: { endpoint: string }
import { NextResponse } from "next/server";
import { z }            from "zod";
import { deletePushSubscription } from "@/lib/comms-data";
import { rateLimit }    from "@/lib/rate-limit";

const Body = z.object({ endpoint: z.string().url() });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`unsub:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  await deletePushSubscription(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
