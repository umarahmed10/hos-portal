// Data-access helpers for the /comms-test module.
// Kept separate from lib/data-access.ts (docs domain) so the comms trial
// can be lifted or dropped as one unit.
import { createClient } from "@supabase/supabase-js";

function db() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !svcKey) throw new Error("[comms-data] Supabase env not set");
  return createClient(url, svcKey, { auth: { persistSession: false } });
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
  body:       string
): Promise<CommsMessage> {
  // `kind` is omitted so this insert also succeeds before the call-history
  // migration (the DB default fills it in afterwards).
  const client = db();
  const row = { doc_code: docCode.toUpperCase(), sender_role: senderRole, body };

  let { data, error } = await client.from("comms_messages").insert(row).select(MESSAGE_COLUMNS).single();

  if (error && /column .*(kind|meta)/i.test(error.message)) {
    ({ data, error } = await client
      .from("comms_messages")
      .insert(row)
      .select("id, doc_code, sender_role, body, created_at, read_at")
      .single());
    if (!error && data) {
      return { ...(data as unknown as Omit<CommsMessage, "kind" | "meta">), kind: "text", meta: null };
    }
  }

  if (error) throw new Error(`[comms-data] insertMessage: ${error.message}`);
  return data as unknown as CommsMessage;
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
