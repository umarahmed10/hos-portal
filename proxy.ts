import { NextResponse }     from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify }        from "jose";

const ADMIN_COOKIE   = "hos_admin_session";
const PORTAL_COOKIE  = "hos_portal_session";
const LOGIN_REDIRECT = "/?mode=admin";

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

    return NextResponse.next();
  }

  // ── Portal sub-routes (require active portal session cookie) ─────────────
  // /portal/[slug]/status|documents|invoices|reports|campaigns|support|...
  // The entry page (/portal/[slug]) is NOT protected — that's the login gate.
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

    return NextResponse.next();
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
    "/api/generate-agreement",
    "/api/daily-metrics",
    "/api/support-chat",
  ],
};
