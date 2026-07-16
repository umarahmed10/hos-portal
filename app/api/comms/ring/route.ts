// POST /api/comms/ring — admin only. Sends a web-push "incoming_call"
// notification to every registered device for the given client code.
import { NextResponse } from "next/server";
import { z }            from "zod";
import webpush          from "web-push";
import { authorizeAdmin } from "@/lib/comms-auth";
import { getDocByCode, logDocEvent } from "@/lib/data-access";
import { getSubscriptionsFor, deletePushSubscription, insertCallEvent } from "@/lib/comms-data";
import {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  APP_URL,
} from "@/lib/env";

const Body = z.object({ code: z.string().length(6) });

export async function POST(req: Request) {
  if (!(await authorizeAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const code = parsed.data.code.toUpperCase();

  const doc = await getDocByCode(code);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Client not found" }, { status: 404 });
  }

  webpush.setVapidDetails(VAPID_SUBJECT(), VAPID_PUBLIC_KEY(), VAPID_PRIVATE_KEY());

  const subs = await getSubscriptionsFor(code, "client");

  const expiresAt = Date.now() + 30_000; // ring auto-dismisses after 30s
  const payload = JSON.stringify({
    type:       "incoming_call",
    code,
    room:       code,
    callerName: "HOS Team",
    joinUrl:    `${APP_URL()}/comms-test/client/${code}?join=${code}`,
    expiresAt,
  });

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 30 }
      )
    )
  );

  // Purge dead subscriptions (404/410 from push service)
  let delivered = 0;
  await Promise.all(results.map(async (r, i) => {
    if (r.status === "fulfilled") { delivered++; return; }
    const status = (r.reason as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      await deletePushSubscription(subs[i].endpoint).catch(() => {});
    }
  }));

  // Admin audit trail (hidden from client).
  await logDocEvent(doc.id, {
    event_type: "call",
    detail:     `Admin rang · ${delivered}/${subs.length} device(s) reached`,
    posted_by:  "admin",
    visible_to_client: false,
  }).catch(() => {});

  // Conversation feed — renders inline as "HOS Team started a call".
  await insertCallEvent(code, "admin", {
    event:      "started",
    actor_name: "HOS Team",
  }).catch(() => {});

  return NextResponse.json({ ok: true, data: { delivered, total: subs.length } });
}
