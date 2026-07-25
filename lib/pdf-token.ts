// ─────────────────────────────────────────────────────────────────────────────
// Short-lived signed tokens for PDF download links.
//
// /api/pdf serves a signed agreement (line items, invoice total, signature
// image), so it must not be reachable by guessing a 6-character code. But two
// legitimate flows have no session:
//   • the pre-portal /client/[code] signing flow (code-in-URL by design)
//   • the "download signed copy" button in the confirmation email
//
// Both are served a signed, expiring token bound to that one code. A token is
// therefore useless for harvesting other documents, and expires on its own.
// ─────────────────────────────────────────────────────────────────────────────
import { SignJWT, jwtVerify } from "jose";

const PURPOSE = "pdf";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("[pdf-token] JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Mint a download token for one document code.
 * @param expiresIn jose duration string. Emails need days; in-app links need hours.
 */
export async function signPdfToken(code: string, expiresIn = "12h"): Promise<string> {
  return new SignJWT({ purpose: PURPOSE, code: code.toUpperCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

/** True only if `token` is a valid, unexpired PDF token for exactly `code`. */
export async function verifyPdfToken(token: string, code: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (
      payload.purpose === PURPOSE &&
      typeof payload.code === "string" &&
      payload.code.toUpperCase() === code.toUpperCase()
    );
  } catch {
    return false;
  }
}
