// GET  /api/comms/messages?code=XXXXXX&asRole=admin|client  — list messages
// POST /api/comms/messages  { code, body, asRole } — send a message
import { NextResponse } from "next/server";
import { z }            from "zod";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { listMessages, insertMessage, markRead } from "@/lib/comms-data";
import { rateLimit }    from "@/lib/rate-limit";

const Role = z.enum(["admin", "client"]);

export async function GET(req: Request) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get("code");
  const asRole = Role.safeParse(url.searchParams.get("asRole"));
  if (!code || code.length !== 6 || !asRole.success) {
    return NextResponse.json({ ok: false, error: "code and asRole required" }, { status: 400 });
  }
  const caller = await authorizeCommsCaller(code, asRole.data);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const messages = await listMessages(code);
  // Side-effect: mark the other side's messages as read since this user is viewing
  void markRead(code, asRole.data).catch(() => {});
  return NextResponse.json({ ok: true, data: { messages } });
}

const PostBody = z.object({
  code:   z.string().length(6),
  body:   z.string().min(1).max(4000),
  asRole: Role,
  kind:   z.enum(["text", "attachment"]).optional(),
});

export async function POST(req: Request) {
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const { code, body, asRole, kind } = parsed.data;

  const rl = rateLimit(`msg:${code}:${asRole}`, { windowMs: 60_000, max: 30 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many messages" }, { status: 429 });
  }

  const caller = await authorizeCommsCaller(code, asRole);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const message = await insertMessage(code.toUpperCase(), asRole, body, kind === "attachment" ? "attachment" : "text");
  return NextResponse.json({ ok: true, data: { message } });
}
