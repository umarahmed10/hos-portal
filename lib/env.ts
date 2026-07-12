// ─────────────────────────────────────────────────────────────────────────────
// Runtime environment validation.
// Imported by lib/data-access.ts, lib/auth.ts, and API routes.
// Throws a descriptive error at startup if any required variable is missing —
// surfaces misconfiguration immediately rather than failing at first request.
// ─────────────────────────────────────────────────────────────────────────────

function require(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[env] Missing required environment variable: ${name}\n` +
      `See .env.local.example for all required variables.`
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

// Supabase — public vars safe in browser bundles
export const SUPABASE_URL      = require("NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_ANON_KEY = require("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// Supabase — service role key: server-side only, never in browser
export const SUPABASE_SERVICE_ROLE_KEY = () => require("SUPABASE_SERVICE_ROLE_KEY");

// Admin auth
export const ADMIN_PASSWORD = () => require("ADMIN_PASSWORD");
export const JWT_SECRET      = () => require("JWT_SECRET");

// OpenRouter
export const OPENROUTER_API_KEY = () => require("OPENROUTER_API_KEY");
export const OPENROUTER_MODEL   = () => optional("OPENROUTER_MODEL", "meta-llama/llama-4-maverick");

// Resend
export const RESEND_API_KEY    = () => require("RESEND_API_KEY");
export const RESEND_FROM_EMAIL = () => optional("RESEND_FROM_EMAIL", "solutions@hosautomations.co");
export const NOTIFY_EMAIL      = () => process.env.NOTIFY_EMAIL ?? require("ADMIN_EMAIL");

// App URL
export const APP_URL = () => optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

// Stripe
export const STRIPE_SECRET_KEY        = process.env.STRIPE_SECRET_KEY        ?? "";
export const STRIPE_WEBHOOK_SECRET    = process.env.STRIPE_WEBHOOK_SECRET    ?? "";
export const NEXT_PUBLIC_STRIPE_PK    = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

// LiveKit (voice/text realtime)
export const LIVEKIT_URL              = () => require("NEXT_PUBLIC_LIVEKIT_URL");
export const LIVEKIT_API_KEY          = () => require("LIVEKIT_API_KEY");
export const LIVEKIT_API_SECRET       = () => require("LIVEKIT_API_SECRET");

// Web Push (VAPID)
export const VAPID_PUBLIC_KEY         = () => require("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
export const VAPID_PRIVATE_KEY        = () => require("VAPID_PRIVATE_KEY");
export const VAPID_SUBJECT            = () => optional("VAPID_SUBJECT", "mailto:team@hosautomations.co");
