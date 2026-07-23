// GET/POST /api/settings — global app settings (admin only).
import { NextResponse }    from "next/server";
import { z }               from "zod";
import { getAdminSession } from "@/lib/auth";
import { getAppSettings, setAppSettings } from "@/lib/app-settings";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, data: await getAppSettings() });
}

const Body = z.object({ payment_cutoff: z.number().min(0).max(1_000_000) }).partial();

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid settings" }, { status: 400 });
  const updated = await setAppSettings(parsed.data);
  return NextResponse.json({ ok: true, data: updated });
}
