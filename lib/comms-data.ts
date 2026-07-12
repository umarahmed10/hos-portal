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

export interface CommsMessage {
  id:          string;
  doc_code:    string;
  sender_role: CommsRole;
  body:        string;
  created_at:  string;
  read_at:     string | null;
}

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
  const { data, error } = await db()
    .from("comms_messages")
    .select("id, doc_code, sender_role, body, created_at, read_at")
    .eq("doc_code", docCode.toUpperCase())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[comms-data] listMessages: ${error.message}`);
  return ((data ?? []) as unknown as CommsMessage[]).reverse();
}

export async function insertMessage(
  docCode:    string,
  senderRole: CommsRole,
  body:       string
): Promise<CommsMessage> {
  const { data, error } = await db()
    .from("comms_messages")
    .insert({
      doc_code:    docCode.toUpperCase(),
      sender_role: senderRole,
      body,
    })
    .select("id, doc_code, sender_role, body, created_at, read_at")
    .single();
  if (error) throw new Error(`[comms-data] insertMessage: ${error.message}`);
  return data as unknown as CommsMessage;
}
