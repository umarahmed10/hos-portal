import { NextResponse }                       from "next/server";
import { signAdminToken, buildSessionCookie } from "@/lib/auth";
import bcrypt                                  from "bcryptjs";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({}));
  if (!password) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const hash      = process.env.ADMIN_PASSWORD_HASH;
  const plaintext = process.env.ADMIN_PASSWORD;

  let valid = false;
  if (hash) {
    valid = await bcrypt.compare(password, hash);
  } else if (plaintext) {
    valid = password === plaintext;
  }

  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  const token  = await signAdminToken();
  const cookie = buildSessionCookie(token);

  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie } }
  );
}
