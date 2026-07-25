// ─────────────────────────────────────────────────────────────────────────────
// Shared authorization for per-document endpoints (PDF, avatar, …).
//
// A 6-character access code is an identifier, NOT an authorization. Any route
// that serves or mutates document-scoped data must also require a session that
// is actually entitled to that document:
//   • an admin session (entitled to everything), or
//   • a portal session whose doc_id matches the requested code.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies }            from "next/headers";
import { verifyAdminToken }   from "@/lib/auth";
import { verifyPortalToken }  from "@/lib/portal-auth";
import { getDocByCode }       from "@/lib/data-access";

export type DocCaller =
  | { role: "admin" }
  | { role: "client"; code: string; docId: string };

/**
 * Returns the caller if they may access `code`, otherwise null.
 * Admin is checked first so an admin previewing a client link always works.
 */
export async function authorizeDocAccess(code: string): Promise<DocCaller | null> {
  const jar = await cookies();

  const adminToken = jar.get("hos_admin_session")?.value;
  if (adminToken && (await verifyAdminToken(adminToken))) {
    return { role: "admin" };
  }

  const portalToken = jar.get("hos_portal_session")?.value;
  if (!portalToken) return null;

  const portal = await verifyPortalToken(portalToken);
  if (!portal) return null;

  const doc = await getDocByCode(code);
  if (!doc || doc.id !== portal.doc_id) return null;

  return { role: "client", code: doc.code, docId: doc.id };
}
