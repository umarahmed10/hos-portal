import { NextResponse }            from "next/server";
import { signAdminToken, buildSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const token  = await signAdminToken();
  const cookie = buildSessionCookie(token);

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie } }
  );
}
