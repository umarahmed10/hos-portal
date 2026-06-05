// ─────────────────────────────────────────────────────────────────────────────
// Proxy (Next.js 16 convention, replaces middleware.ts).
// Protects /admin/* (JWT admin session) and /portal/*/[subpath] (portal session).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse }     from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify }        from "jose";

const ADMIN_COOKIE  = "hos_admin_session";
const PORTAL_COOKIE = "hos_portal_session";
const LOGIN_REDIRECT = "/?mode=admin";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Admin routes ───────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) return NextResponse.redirect(new URL(LOGIN_REDIRECT, req.url));

    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload.role !== "admin") throw new Error("not admin");
      return NextResponse.next();
    } catch {
      const response = NextResponse.redirect(new URL(LOGIN_REDIRECT, req.url));
      response.cookies.set(ADMIN_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  // ── Portal sub-routes (require an active portal session cookie) ───────────
  // Pattern: /portal/[slug]/status|documents|invoices|reports|campaigns|support
  // The portal entry page itself (/portal/[slug]) is NOT protected — that's where
  // the client lands from the magic link and verifies their code to get a session.
  if (pathname.match(/^\/portal\/[^/]+\/.+/)) {
    const token = req.cookies.get(PORTAL_COOKIE)?.value;
    if (!token) {
      // Extract slug from pathname and redirect to portal entry
      const slug = pathname.split("/")[2];
      return NextResponse.redirect(new URL(`/portal/${slug}`, req.url));
    }

    try {
      const { payload } = await jwtVerify(token, getSecret());
      if (payload.role !== "portal_client") throw new Error("not portal client");
      return NextResponse.next();
    } catch {
      const slug     = pathname.split("/")[2];
      const response = NextResponse.redirect(new URL(`/portal/${slug}`, req.url));
      response.cookies.set(PORTAL_COOKIE, "", { maxAge: 0, path: "/" });
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:slug/:subpath*",
  ],
};
