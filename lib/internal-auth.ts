// ─────────────────────────────────────────────────────────────────────────────
// Shared secret for server-to-server calls between our own routes.
//
// /api/sign fires notification + confirmation emails by POSTing to /api/notify
// and /api/email-signed. Those routes were reachable by anyone: /api/email-signed
// sends to a caller-supplied address, making it an open relay from our verified
// sending domain, and both interpolated caller-controlled strings into email HTML.
//
// These endpoints are never called from the browser, so a shared header secret
// is sufficient and avoids putting anything in client code.
// ─────────────────────────────────────────────────────────────────────────────

export const INTERNAL_HEADER = "x-internal-secret";

/** Header bag for outbound internal calls. Throws if the secret is unset. */
export function internalHeaders(): Record<string, string> {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) throw new Error("[internal-auth] INTERNAL_SECRET is not set");
  return { "Content-Type": "application/json", [INTERNAL_HEADER]: secret };
}

/**
 * True when the request carries the correct internal secret.
 * Fails closed: if INTERNAL_SECRET is unset, nothing is authorized.
 */
export function isInternalRequest(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  return req.headers.get(INTERNAL_HEADER) === secret;
}

/**
 * Escape a value for interpolation into email HTML. Several templates dropped
 * caller-supplied strings straight into markup — including inside an href,
 * where a crafted value could rewrite the link target.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
