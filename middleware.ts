import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) return new Uint8Array(0);
  return new TextEncoder().encode(secret);
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function verifyAndMaybeRefresh(
  token: string,
  expectedRole: string,
  cookieName: string,
  req: NextRequest,
  res: NextResponse,
): Promise<boolean> {
  try {
    const secret = getSecret();
    if (secret.length === 0) return false;
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== expectedRole) return false;

    // Sliding window refresh: if within 2h of expiry, re-sign
    if (payload.exp) {
      const expiresAt = payload.exp * 1000;
      if (expiresAt - Date.now() < TWO_HOURS_MS) {
        const refreshed = await new SignJWT({ ...payload })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("24h")
          .sign(secret);
        res.cookies.set(cookieName, refreshed, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24,
        });
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // CSRF: reject cross-origin mutations to API routes
  if (pathname.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return NextResponse.json({ ok: false, error: "CSRF rejected" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
      }
    }
  }

  // Admin route guard
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get("hos_admin_session")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const valid = await verifyAndMaybeRefresh(token, "admin", "hos_admin_session", req, res);
    if (!valid) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Portal route guard
  if (pathname.startsWith("/portal/")) {
    const token = req.cookies.get("hos_portal_session")?.value;
    if (token) {
      await verifyAndMaybeRefresh(token, "portal_client", "hos_portal_session", req, res);
    }
    // Don't redirect — the layout handles showing entry page for unauthenticated users
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/api/:path*"],
};
