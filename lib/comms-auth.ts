// Shared auth guard for /api/comms/* routes.
// Admin is identified by the existing hos_admin_session cookie;
// client is identified by the hos_portal_session cookie whose doc_id
// must match the requested code.
import { cookies } from "next/headers";
import { verifyAdminToken }  from "@/lib/auth";
import { verifyPortalToken } from "@/lib/portal-auth";
import { getDocByCode }      from "@/lib/data-access";

export type CommsCaller =
  | { role: "admin" }
  | { role: "client"; code: string; docId: string };

/**
 * Verify the caller can access the given doc code AS the role they assert.
 * Takes an explicit `asRole` rather than guessing from whichever cookie is
 * present — a browser can legitimately hold both an admin session and a
 * client portal session at once (e.g. admin previewing their own client
 * link), and ambient-cookie priority would silently misattribute actions.
 */
export async function authorizeCommsCaller(
  code:   string,
  asRole: "admin" | "client"
): Promise<CommsCaller | null> {
  const jar = await cookies();

  if (asRole === "admin") {
    const adminToken = jar.get("hos_admin_session")?.value;
    if (!adminToken) return null;
    const admin = await verifyAdminToken(adminToken);
    return admin ? { role: "admin" } : null;
  }

  const portalToken = jar.get("hos_portal_session")?.value;
  if (!portalToken) return null;
  const portal = await verifyPortalToken(portalToken);
  if (!portal) return null;

  const doc = await getDocByCode(code);
  if (!doc || doc.id !== portal.doc_id) return null;

  return { role: "client", code: doc.code, docId: doc.id };
}

export async function authorizeAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get("hos_admin_session")?.value;
  if (!token) return false;
  return (await verifyAdminToken(token)) !== null;
}
