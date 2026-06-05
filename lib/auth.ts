// ─────────────────────────────────────────────────────────────────────────────
// JWT auth helpers — server-side only.
// Uses `jose` (edge-compatible, no Node.js crypto dependency).
// Called by: app/api/auth/route.ts, app/api/logout/route.ts, middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AdminJwtPayload } from "@/types";

const COOKIE_NAME = "hos_admin_session";
const EXPIRY      = "24h";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[auth] JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN
// ─────────────────────────────────────────────────────────────────────────────

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: "admin" } satisfies AdminJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyAdminToken(
  token: string
): Promise<AdminJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "admin") return null;
    return payload as unknown as AdminJwtPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE HELPERS (used in API route handlers)
// ─────────────────────────────────────────────────────────────────────────────

export function buildSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24; // 24 hours in seconds
  const flags  = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    // Secure flag: added in production automatically by Vercel (HTTPS only)
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ];
  return flags.join("; ");
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CHECK (used in Server Components to verify admin access)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminSession(): Promise<AdminJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME; // consumed by middleware.ts
