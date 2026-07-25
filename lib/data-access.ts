// ─────────────────────────────────────────────────────────────────────────────
// Data access layer — ALL Supabase queries live here.
// Never import supabase clients directly in components or pages.
// Server-side functions use the service role key (bypasses RLS).
// Client-side functions use the anon key (subject to RLS).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@supabase/supabase-js";
import type {
  Doc,
  DocEvent,
  CreateDocInput,
  UpdateDocInput,
  PaymentStatus,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: SupabaseClient<any, "public", any> | null = null;
function getAdminClient() {
  if (_adminClient) return _adminClient;
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !svcKey) {
    throw new Error("[data-access] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  _adminClient = createClient(url, svcKey, { auth: { persistSession: false } });
  return _adminClient;
}

// No anon-key client here by design. `docs` has no anon RLS policies as of
// 2026-07-25, and this module is server-only — every query below uses the
// service role key. Client-facing access control is enforced by the calling
// route (session checks) or by an explicit code filter, never by RLS.

// Explicit column list — no select('*') anywhere. Keep in sync with types/index.ts Doc.
const DOC_COLUMNS = [
  "id", "code", "status", "type",
  "name", "company", "email", "service", "service_type", "service_area",
  "date", "fee", "agreement_text",
  "items", "invoice_total", "due_date", "pay_notes",
  "payment_status", "amount_paid",
  "slug", "magic_token_hash", "magic_token_expires_at", "payment_link",
  "first_view_ip", "first_view_ua", "signed_ip", "signed_ua",
  "accepted_esign_terms",
  "signature", "signed_at",
  "calls_total", "calls_qualified", "jobs_booked", "ad_spend", "avg_job_value", "monthly_budget", "monthly_call_cap", "rate_per_call",
  "created_at", "updated_at",
].join(", ");

const EVENT_COLUMNS = [
  "id", "doc_id", "event_type", "metadata",
  "detail", "posted_by", "visible_to_client",
  "ip_address", "user_agent", "created_at",
].join(", ");

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN READS (Server Components, API routes — service role)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all non-archived docs ordered by creation date descending.
 * Used by: app/admin/page.tsx (Server Component)
 */
export async function getAllDocs(): Promise<Doc[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .select(DOC_COLUMNS)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`[data-access] getAllDocs: ${error.message}`);
  return (data ?? []) as unknown as Doc[];
}

/**
 * Fetch a single doc by code.
 * Used by: admin/share, admin/edit/[code], and all /api/* routes.
 */
export async function getDocByCode(code: string): Promise<Doc | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .select(DOC_COLUMNS)
    .eq("code", code.toUpperCase())
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`[data-access] getDocByCode: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Fetch a single doc by slug (URL-friendly identifier).
 * Used by: portal entry validation.
 */
export async function getDocBySlug(slug: string): Promise<Doc | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .select(DOC_COLUMNS)
    .eq("slug", slug.toLowerCase())
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`[data-access] getDocBySlug: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Search docs by name or company (case-insensitive).
 * Used by: AdminDashboard client-side search.
 */
export async function searchDocs(query: string): Promise<Doc[]> {
  const db = getAdminClient();
  const q  = `%${query}%`;
  const { data, error } = await db
    .from("docs")
    .select(DOC_COLUMNS)
    .or(`name.ilike.${q},company.ilike.${q}`)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`[data-access] searchDocs: ${error.message}`);
  return (data ?? []) as unknown as Doc[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN WRITES (API routes — service role)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new document. Returns the created doc.
 * Used by: app/api/docs/route.ts (POST)
 */
export async function createDoc(input: CreateDocInput): Promise<Doc> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .insert(input)
    .select(DOC_COLUMNS)
    .single();

  if (error) throw new Error(`[data-access] createDoc: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Update a document. Used for editing and saving drafts.
 * Used by: app/api/docs/[code]/route.ts (PATCH)
 */
export async function updateDoc(code: string, input: UpdateDocInput): Promise<Doc> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .update(input)
    .eq("code", code.toUpperCase())
    .select(DOC_COLUMNS)
    .single();

  if (error) throw new Error(`[data-access] updateDoc: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Archive a document (soft delete — sets status to 'archived').
 * Used by: AdminDashboard archive action.
 */
export async function archiveDoc(code: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from("docs")
    .update({ status: "archived" })
    .eq("code", code.toUpperCase())
    .neq("status", "archived");

  if (error) throw new Error(`[data-access] archiveDoc: ${error.message}`);
}

/**
 * Set slug and hashed magic token. Called by /api/email-client when generating a link.
 */
export async function updateDocMagicLink(
  code:      string,
  slug:      string,
  tokenHash: string,
  expiresAt?: string,
  email?:    string
): Promise<void> {
  const db      = getAdminClient();
  const payload: Record<string, unknown> = { slug, magic_token_hash: tokenHash };
  if (expiresAt) payload.magic_token_expires_at = expiresAt;
  if (email)     payload.email = email;
  const { error } = await db
    .from("docs")
    .update(payload)
    .eq("code", code.toUpperCase());

  if (error) throw new Error(`[data-access] updateDocMagicLink: ${error.message}`);
}

/**
 * Update payment status and amount paid. Admin-only.
 */
export async function updatePaymentStatus(
  code:           string,
  payment_status: PaymentStatus,
  amount_paid:    number
): Promise<Doc> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .update({ payment_status, amount_paid })
    .eq("code", code.toUpperCase())
    .select(DOC_COLUMNS)
    .single();

  if (error) throw new Error(`[data-access] updatePaymentStatus: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Sign a document server-side with full IP/UA capture and e-sign compliance tracking.
 * Replaces the direct browser Supabase call in SignPage for the primary signing path.
 * Used by: app/api/sign/route.ts
 */
export async function signDocViaAPI(
  code:                string,
  signature:           string,
  signedAt:            string,
  signedIp:            string | null,
  signedUa:            string | null,
  acceptedEsignTerms:  boolean
): Promise<Doc> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .update({
      status:               "signed",
      signature,
      signed_at:            signedAt,
      signed_ip:            signedIp,
      signed_ua:            signedUa,
      accepted_esign_terms: acceptedEsignTerms,
    })
    .eq("code", code.toUpperCase())
    .eq("status", "pending") // guard against double-signing
    .select(DOC_COLUMNS)
    .single();

  if (error) throw new Error(`[data-access] signDocViaAPI: ${error.message}`);
  return data as unknown as Doc;
}

/**
 * Record first view IP/UA — idempotent (only updates if not already set).
 */
export async function recordFirstView(
  code: string,
  ip:   string | null,
  ua:   string | null
): Promise<void> {
  const db = getAdminClient();
  // Only update if first_view_ip is null — preserves the actual first view
  const { error } = await db
    .from("docs")
    .update({ first_view_ip: ip, first_view_ua: ua })
    .eq("code", code.toUpperCase())
    .is("first_view_ip", null);

  // Ignore "no rows matched" — means first_view was already recorded
  if (error && error.code !== "PGRST116") {
    throw new Error(`[data-access] recordFirstView: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT READS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a doc for client display in the code-authenticated /client/[code] flow.
 * Used by: app/client/[code]/page.tsx, sign/page.tsx, done/page.tsx
 *
 * Runs in Server Components only, so it uses the service role key. It formerly
 * used the anon key and relied on the `client_read_by_code` RLS policy — but
 * that policy was `USING (true)`, meaning the public anon key could read every
 * row in `docs` (codes, emails, signatures included). The policy was dropped on
 * 2026-07-25; see migrations/2026-07-25_drop_anon_docs_policies.sql.
 *
 * Access control for this flow is the 6-character code in the URL, enforced by
 * the `.eq("code", …)` filter below — never by RLS.
 */
export async function getDocForClient(code: string): Promise<Doc | null> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("docs")
    .select(DOC_COLUMNS)
    .eq("code", code.toUpperCase())
    .single();

  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(`[data-access] getDocForClient: ${error.message}`);
  return data as unknown as Doc;
}

// NOTE: a `signDoc()` helper used to live here, writing via the anon key under
// the `client_sign` RLS policy. It had no callers — /api/sign uses
// signDocViaAPI() below, which validates the code, enforces pending status and
// captures IP/UA — and the policy it depended on let any anonymous caller sign
// any pending document. Both were removed on 2026-07-25.

// ─────────────────────────────────────────────────────────────────────────────
// EVENT LOG (service role — doc_events has no anon RLS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Append an event to doc_events. Fire-and-forget safe — call without await
 * if you don't need to block on it.
 */
export async function logEvent(
  docId:            string,
  eventType:        string,
  metadata:         Record<string, unknown> = {},
  ip:               string | null = null,
  ua:               string | null = null,
  detail:           string | null = null,
  postedBy:         string | null = null,
  visibleToClient:  boolean = true
): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from("doc_events")
    .insert({
      doc_id:            docId,
      event_type:        eventType,
      metadata,
      ip_address:        ip,
      user_agent:        ua,
      detail,
      posted_by:         postedBy,
      visible_to_client: visibleToClient,
    });

  if (error) throw new Error(`[data-access] logEvent: ${error.message}`);
}

export async function getClientEvents(docId: string): Promise<DocEvent[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("doc_events")
    .select(EVENT_COLUMNS)
    .eq("doc_id", docId)
    .eq("visible_to_client", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`[data-access] getClientEvents: ${error.message}`);
  return (data ?? []) as unknown as DocEvent[];
}

/**
 * Get all events for a document, ordered chronologically.
 * Used by: admin doc detail / timeline view.
 */
export async function getDocEvents(docId: string): Promise<DocEvent[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("doc_events")
    .select(EVENT_COLUMNS)
    .eq("doc_id", docId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`[data-access] getDocEvents: ${error.message}`);
  return (data ?? []) as unknown as DocEvent[];
}

/**
 * Convenience wrapper around logEvent for structured operational events.
 */
export async function logDocEvent(
  docId: string,
  event: {
    event_type:        string;
    detail?:           string;
    posted_by?:        string;
    visible_to_client?: boolean;
  }
): Promise<void> {
  return logEvent(
    docId,
    event.event_type,
    {},
    null,
    null,
    event.detail ?? null,
    event.posted_by ?? null,
    event.visible_to_client ?? true
  );
}
