import { NextResponse }                       from "next/server";
import { signAdminToken, buildSessionCookie } from "@/lib/auth";
import { rateLimit }                          from "@/lib/rate-limit";
import bcrypt                                  from "bcryptjs";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: Request) {
  // A single shared password guards the entire admin surface, so an unthrottled
  // endpoint is a straightforward offline-speed brute force.
  const rl = rateLimit(`auth:${clientIp(req)}`, { windowMs: 15 * 60_000, max: 5 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

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
