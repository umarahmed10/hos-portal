import { NextResponse }     from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const ADMIN_COOKIE   = "hos_admin_session";
const PORTAL_COOKIE  = "hos_portal_session";
const LOGIN_REDIRECT = "/?mode=admin";
const TWO_HOURS_MS   = 2 * 60 * 60 * 1000;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

async function verifyPortalToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "portal_client") return null;
    return typeof payload.slug === "string" ? payload.slug : null;
  } catch {
    return null;
  }
}

async function slidingRefresh(
  token: string,
  expectedRole: string,
  cookieName: string,
  res: NextResponse,
): Promise<void> {
  try {
    const secret = getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== expectedRole || !payload.exp) return;
    if (payload.exp * 1000 - Date.now() < TWO_HOURS_MS) {
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
  } catch { /* token already validated elsewhere */ }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── CSRF: reject cross-origin mutations to API routes ────────────────────
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

  // ── Admin routes + admin-only APIs ──────────────────────────────────────────
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi   = pathname.startsWith("/api/generate-agreement") ||
                       pathname.startsWith("/api/daily-metrics");

  if (isAdminRoute || isAdminApi) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;

    if (!token) {
      if (isAdminApi) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL(LOGIN_REDIRECT, req.url));
    }

    const valid = await verifyAdminToken(token);
    if (!valid) {
      if (isAdminApi) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
      const response = NextResponse.redirect(new URL(LOGIN_REDIRECT, req.url));
      response.cookies.set(ADMIN_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }

    const res = NextResponse.next();
    await slidingRefresh(token, "admin", ADMIN_COOKIE, res);
    return res;
  }

  // ── Portal sub-routes (require active portal session cookie) ─────────────
  if (pathname.match(/^\/portal\/[^/]+\/.+/)) {
    const token = req.cookies.get(PORTAL_COOKIE)?.value;
    const slug  = pathname.split("/")[2];

    if (!token) return NextResponse.redirect(new URL(`/portal/${slug}`, req.url));

    const sessionSlug = await verifyPortalToken(token);
    if (!sessionSlug) {
      const response = NextResponse.redirect(new URL(`/portal/${slug}`, req.url));
      response.cookies.set(PORTAL_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }

    const res = NextResponse.next();
    await slidingRefresh(token, "portal_client", PORTAL_COOKIE, res);
    return res;
  }

  // ── Portal-session-gated APIs ────────────────────────────────────────────
  if (pathname.startsWith("/api/support-chat")) {
    const token = req.cookies.get(PORTAL_COOKIE)?.value;
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const slug = await verifyPortalToken(token);
    if (!slug)  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:slug/:subpath*",
    "/api/:path*",
  ],
};
