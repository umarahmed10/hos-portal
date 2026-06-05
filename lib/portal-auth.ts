// ─────────────────────────────────────────────────────────────────────────────
// Portal session auth — client-facing JWT cookie (per-doc session).
// Mirrors lib/auth.ts pattern but for portal clients, not admin.
// ─────────────────────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from "jose";
import { cookies }            from "next/headers";
import type { PortalJwtPayload } from "@/types";

const COOKIE_NAME = "hos_portal_session";
const EXPIRY      = "24h";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[portal-auth] JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN
// ─────────────────────────────────────────────────────────────────────────────

export async function signPortalToken(docId: string, slug: string): Promise<string> {
  return new SignJWT({ role: "portal_client", doc_id: docId, slug } satisfies PortalJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifyPortalToken(token: string): Promise<PortalJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.role !== "portal_client") return null;
    return payload as unknown as PortalJwtPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function buildPortalCookie(token: string): string {
  const maxAge = 60 * 60 * 24; // 24 hours
  const flags  = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ];
  return flags.join("; ");
}

export function buildClearPortalCookie(): string {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CHECK (Server Components)
// ─────────────────────────────────────────────────────────────────────────────

export async function getPortalSession(): Promise<PortalJwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPortalToken(token);
}

export const PORTAL_COOKIE_NAME = COOKIE_NAME;
