// Data-access helpers for the /comms-test module.
// Kept separate from lib/data-access.ts (docs domain) so the comms trial
// can be lifted or dropped as one unit.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: SupabaseClient<any, "public", any> | null = null;
function db() {
  if (_db) return _db;
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !svcKey) throw new Error("[comms-data] Supabase env not set");
  _db = createClient(url, svcKey, { auth: { persistSession: false } });
  return _db;
}

export type CommsRole = "admin" | "client";

export interface PushSub {
  endpoint: string;
  keys:     { p256dh: string; auth: string };
}

export type CallEvent = "started" | "ended" | "missed";

export interface CallMeta {
  event:        CallEvent;
  actor_name:   string;
  duration_sec?: number;
}

export interface CommsMessage {
  id:          string;
  doc_code:    string;
  sender_role: CommsRole;
  body:        string;
  kind:        "text" | "call";
  meta:        CallMeta | null;
  created_at:  string;
  read_at:     string | null;
}

const MESSAGE_COLUMNS = "id, doc_code, sender_role, body, kind, meta, created_at, read_at";

// ─── push subscriptions ─────────────────────────────────────────────────────

export async function upsertPushSubscription(
  docCode:   string,
  role:      CommsRole,
  sub:       PushSub,
  userAgent: string | null
) {
  const { error } = await db()
    .from("push_subscriptions")
    .upsert(
      {
        doc_code:   docCode.toUpperCase(),
        role,
        endpoint:   sub.endpoint,
        p256dh:     sub.keys.p256dh,
        auth:       sub.keys.auth,
        user_agent: userAgent,
      },
      { onConflict: "endpoint" }
    );
  if (error) throw new Error(`[comms-data] upsertPushSubscription: ${error.message}`);
}

export async function deletePushSubscription(endpoint: string) {
  const { error } = await db()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw new Error(`[comms-data] deletePushSubscription: ${error.message}`);
}

export async function getSubscriptionsFor(docCode: string, role: CommsRole): Promise<PushSub[]> {
  const { data, error } = await db()
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("doc_code", docCode.toUpperCase())
    .eq("role", role);
  if (error) throw new Error(`[comms-data] getSubscriptionsFor: ${error.message}`);
  return (data ?? []).map(r => ({
    endpoint: r.endpoint as string,
    keys:     { p256dh: r.p256dh as string, auth: r.auth as string },
  }));
}

// ─── messages ───────────────────────────────────────────────────────────────

export async function listMessages(docCode: string, limit = 100): Promise<CommsMessage[]> {
  const code = docCode.toUpperCase();
  const client = db();

  const run = (columns: string) =>
    client
      .from("comms_messages")
      .select(columns)
      .eq("doc_code", code)
      .order("created_at", { ascending: false })
      .limit(limit);

  let { data, error } = await run(MESSAGE_COLUMNS);

  // Graceful fallback if the call-history migration (kind/meta columns) hasn't
  // been applied yet — chat keeps working; call events simply don't appear.
  if (error && /column .*(kind|meta)/i.test(error.message)) {
    ({ data, error } = await run("id, doc_code, sender_role, body, created_at, read_at"));
    if (!error) {
      const rows = (data ?? []) as unknown as Omit<CommsMessage, "kind" | "meta">[];
      return rows.map(r => ({ ...r, kind: "text" as const, meta: null })).reverse();
    }
  }

  if (error) throw new Error(`[comms-data] listMessages: ${error.message}`);
  return ((data ?? []) as unknown as CommsMessage[]).reverse();
}

export async function insertMessage(
  docCode:    string,
  senderRole: CommsRole,
  body:       string,
  kind:       "text" | "attachment" = "text",
): Promise<CommsMessage> {
  const client = db();
  const code = docCode.toUpperCase();
  const { data, error } = await client
    .from("comms_messages")
    .insert({ doc_code: code, sender_role: senderRole, body, kind })
    .select(MESSAGE_COLUMNS)
    .single();

  if (!error) return data as unknown as CommsMessage;

  // The `kind`/`meta` column may be missing, OR a CHECK constraint may reject
  // this kind (e.g. older schema only allows text/call). Either way, fall back
  // to a plain row — attachments are still recognized by their JSON body at
  // render time, so nothing is lost.
  const isKindIssue = error.code === "23514" || /kind|meta/i.test(error.message);
  if (isKindIssue) {
    const retry = await client
      .from("comms_messages")
      .insert({ doc_code: code, sender_role: senderRole, body })
      .select("id, doc_code, sender_role, body, created_at, read_at")
      .single();
    if (!retry.error && retry.data) {
      // Stored without kind (DB default). Attachments are recognized by body.
      return { ...(retry.data as unknown as Omit<CommsMessage, "kind" | "meta">), kind: "text", meta: null };
    }
  }

  throw new Error(`[comms-data] insertMessage: ${error.message}`);
}

// Roster overview for the admin DM list: per client code, the last message and
// how many client messages the admin hasn't read yet. One query, grouped here.
export interface RosterEntry {
  last_body: string;
  last_kind: "text" | "call";
  last_role: CommsRole;
  last_at:   string;
  unread:    number;
}

export async function getRoster(): Promise<Record<string, RosterEntry>> {
  const { data, error } = await db()
    .from("comms_messages")
    .select("doc_code, sender_role, body, kind, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error || !data) return {};

  const roster: Record<string, RosterEntry> = {};
  for (const m of data as Array<{ doc_code: string; sender_role: CommsRole; body: string; kind: "text" | "call" | null; created_at: string; read_at: string | null }>) {
    const code = m.doc_code;
    if (!roster[code]) {
      roster[code] = {
        last_body: m.body,
        last_kind: m.kind === "call" ? "call" : "text",
        last_role: m.sender_role,
        last_at:   m.created_at,
        unread:    0,
      };
    }
    if (m.sender_role === "client" && m.read_at === null) roster[code].unread++;
  }
  return roster;
}

export async function countUnread(docCode: string, forRole: CommsRole): Promise<number> {
  const code = docCode.toUpperCase();
  const otherRole = forRole === "admin" ? "client" : "admin";
  const { count, error } = await db()
    .from("comms_messages")
    .select("id", { count: "exact", head: true })
    .eq("doc_code", code)
    .eq("sender_role", otherRole)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

// Mark messages as read
export async function markRead(docCode: string, forRole: CommsRole): Promise<void> {
  const code = docCode.toUpperCase();
  const otherRole = forRole === "admin" ? "client" : "admin";
  await db()
    .from("comms_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("doc_code", code)
    .eq("sender_role", otherRole)
    .is("read_at", null);
}

// Append a call-lifecycle row (started / ended / missed) to the conversation
// so it renders inline with chat. body stays empty; details live in meta.
export async function insertCallEvent(
  docCode:    string,
  senderRole: CommsRole,
  meta:       CallMeta
): Promise<CommsMessage> {
  const { data, error } = await db()
    .from("comms_messages")
    .insert({
      doc_code:    docCode.toUpperCase(),
      sender_role: senderRole,
      body:        "",
      kind:        "call",
      meta,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw new Error(`[comms-data] insertCallEvent: ${error.message}`);
  return data as unknown as CommsMessage;
}
