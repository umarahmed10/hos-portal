// GET /api/comms/roster — admin-only DM-list overview: per client code, the
// last message (preview) and unread-from-client count. Powers the Discord-style
// admin roster (badges + previews + activity sort).
import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/comms-auth";
import { getRoster } from "@/lib/comms-data";

export async function GET() {
  if (!(await authorizeAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const roster = await getRoster();
    return NextResponse.json({ ok: true, data: { roster } });
  } catch (err) {
    console.error("[comms/roster] failed:", err);
    return NextResponse.json({ ok: false, error: "Could not load roster." }, { status: 500 });
  }
}
