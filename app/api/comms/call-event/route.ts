// POST /api/comms/call-event — append a call-lifecycle event to the
// conversation feed so it renders inline with chat (Discord-style history).
// Body: { code, asRole, event: "started" | "ended" | "missed", durationSec?: number }
// Identity (actor_name) is resolved server-side from the authenticated caller —
// never trusted from the client.
import { NextResponse } from "next/server";
import { z }            from "zod";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { getDocByCode }         from "@/lib/data-access";
import { insertCallEvent }      from "@/lib/comms-data";

const Body = z.object({
  code:        z.string().length(6),
  asRole:      z.enum(["admin", "client"]),
  event:       z.enum(["started", "ended", "missed"]),
  durationSec: z.number().int().nonnegative().max(86_400).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const code = parsed.data.code.toUpperCase();

  const caller = await authorizeCommsCaller(code, parsed.data.asRole);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const doc       = await getDocByCode(code);
    const actorName = caller.role === "admin" ? "HOS Team" : (doc?.name ?? `Client ${code}`);

    await insertCallEvent(code, caller.role, {
      event:        parsed.data.event,
      actor_name:   actorName,
      duration_sec: parsed.data.durationSec,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comms/call-event] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not record call event." }, { status: 500 });
  }
}
