// GET /api/comms/unread?code=XXXXXX&asRole=client — count of unread messages
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { countUnread } from "@/lib/comms-data";

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
  const count = await countUnread(code, asRole.data);
  return NextResponse.json({ ok: true, data: { count } });
}
