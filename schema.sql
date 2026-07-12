-- ─────────────────────────────────────────────────────────────────────────────
-- HOS Client Portal — Database Schema v3
-- Run in: Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- Idempotent: safe to re-run; all statements use IF NOT EXISTS / OR REPLACE
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUM TYPES
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE doc_status AS ENUM ('draft', 'pending', 'signed', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM ('both', 'agreement', 'invoice');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'partially_paid', 'paid');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: docs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS docs (
  -- ── Identity ────────────────────────────────────────────────────────────────
  id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT           UNIQUE NOT NULL,

  -- ── Status & Type ───────────────────────────────────────────────────────────
  status        doc_status     NOT NULL DEFAULT 'pending',
  type          doc_type       NOT NULL DEFAULT 'both',

  -- ── Client Details ──────────────────────────────────────────────────────────
  name          TEXT           NOT NULL,
  company       TEXT,
  email         TEXT,
  service       TEXT,
  service_type  TEXT,
  service_area  TEXT,
  date          TEXT,
  fee           TEXT,

  -- ── Agreement ───────────────────────────────────────────────────────────────
  agreement_text TEXT,

  -- ── Invoice ─────────────────────────────────────────────────────────────────
  items         JSONB          NOT NULL DEFAULT '[]'::jsonb,
  invoice_total NUMERIC(10,2)  NOT NULL DEFAULT 0,
  due_date      TEXT,
  pay_notes     TEXT,

  -- ── Payment ─────────────────────────────────────────────────────────────────
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  amount_paid   NUMERIC(10,2)  NOT NULL DEFAULT 0,

  -- ── Magic Link / Portal ─────────────────────────────────────────────────────
  slug                TEXT       UNIQUE,
  magic_token_hash    TEXT,

  -- ── Access Tracking ─────────────────────────────────────────────────────────
  first_view_ip       TEXT,
  first_view_ua       TEXT,
  signed_ip           TEXT,
  signed_ua           TEXT,

  -- ── E-Sign Compliance ───────────────────────────────────────────────────────
  accepted_esign_terms BOOLEAN   NOT NULL DEFAULT false,

  -- ── Signature ───────────────────────────────────────────────────────────────
  signature     TEXT,
  signed_at     TIMESTAMPTZ,

  -- ── Audit ───────────────────────────────────────────────────────────────────
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- NEW COLUMNS (idempotent — safe to run on existing table)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE docs ADD COLUMN IF NOT EXISTS payment_status   payment_status NOT NULL DEFAULT 'unpaid';
ALTER TABLE docs ADD COLUMN IF NOT EXISTS amount_paid      NUMERIC(10,2)  NOT NULL DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS slug             TEXT UNIQUE;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS magic_token_hash TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS first_view_ip    TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS first_view_ua    TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS signed_ip        TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS signed_ua        TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS accepted_esign_terms BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS payment_link TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS magic_token_expires_at TIMESTAMPTZ;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS email TEXT;

-- ── Stripe Integration ────────────────────────────────────────────────────────
ALTER TABLE docs ADD COLUMN IF NOT EXISTS stripe_payment_link_id  TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS stripe_payment_link_url TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS stripe_session_id        TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS stripe_customer_email    TEXT;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS paid_at                  TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_docs_stripe_link    ON docs(stripe_payment_link_id) WHERE stripe_payment_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_stripe_session ON docs(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT docs_code_format
    CHECK (code ~ '^[A-Z0-9]{6}$');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT docs_invoice_total_nonneg
    CHECK (invoice_total >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT docs_signed_requires_signature
    CHECK (
      status != 'signed'
      OR (signature IS NOT NULL AND signed_at IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT docs_amount_paid_nonneg
    CHECK (amount_paid >= 0);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE docs ADD CONSTRAINT docs_amount_paid_lte_total
    CHECK (amount_paid <= invoice_total);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_docs_code         ON docs(code);
CREATE INDEX IF NOT EXISTS idx_docs_status       ON docs(status);
CREATE INDEX IF NOT EXISTS idx_docs_created_at   ON docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_docs_name         ON docs(name);
CREATE INDEX IF NOT EXISTS idx_docs_slug         ON docs(slug);
CREATE INDEX IF NOT EXISTS idx_docs_payment      ON docs(payment_status);
CREATE INDEX IF NOT EXISTS idx_docs_magic_token   ON docs(magic_token_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER: auto-update updated_at on any row modification
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON docs;
CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON docs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — docs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_read_by_code" ON docs;
DROP POLICY IF EXISTS "client_sign"         ON docs;

CREATE POLICY "client_read_by_code" ON docs
  FOR SELECT
  TO anon
  USING (true);

-- Client sign via RLS (anon): kept for direct Supabase browser access fallback.
-- Primary signing path is /api/sign (server-side, captures IP/UA).
CREATE POLICY "client_sign" ON docs
  FOR UPDATE
  TO anon
  USING  (status = 'pending')
  WITH CHECK (
    status    = 'signed'
    AND signature IS NOT NULL
    AND signed_at IS NOT NULL
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: doc_events
-- Immutable audit log — rows are only ever inserted, never updated or deleted.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_events (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id      UUID        NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_events_doc_id     ON doc_events(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_events_type       ON doc_events(event_type);
CREATE INDEX IF NOT EXISTS idx_doc_events_created_at ON doc_events(created_at DESC);

-- Phase 3 — operational timeline columns (idempotent)
ALTER TABLE doc_events ADD COLUMN IF NOT EXISTS detail            TEXT;
ALTER TABLE doc_events ADD COLUMN IF NOT EXISTS posted_by         TEXT;
ALTER TABLE doc_events ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN NOT NULL DEFAULT true;

-- RLS for doc_events: service_role handles all reads/writes via API routes
ALTER TABLE doc_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_events" ON doc_events;
-- No anon policies — events are read/written exclusively via service_role key in API routes.
-- service_role bypasses RLS entirely.

-- ─────────────────────────────────────────────────────────────────────────────
-- COLUMN COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────
COMMENT ON TABLE  docs                       IS 'HOS Client Portal — agreements and invoices sent to clients';
COMMENT ON COLUMN docs.code                  IS '6-char alphanumeric code (A-Z0-9) shared with client for access';
COMMENT ON COLUMN docs.status                IS 'Lifecycle: draft→pending→signed | pending→archived';
COMMENT ON COLUMN docs.type                  IS 'Which sections render: both=agreement+invoice, agreement, invoice';
COMMENT ON COLUMN docs.slug                  IS 'URL-friendly identifier e.g. brad-pitt-plumbing, used in portal URL';
COMMENT ON COLUMN docs.magic_token_hash      IS 'SHA-256 hash of the raw magic link token emailed to client';
COMMENT ON COLUMN docs.payment_status        IS 'Invoice payment state: unpaid | partially_paid | paid';
COMMENT ON COLUMN docs.amount_paid           IS 'Amount collected so far — must be <= invoice_total';
COMMENT ON COLUMN docs.accepted_esign_terms  IS 'Client checked e-sign consent checkbox before signing';
COMMENT ON COLUMN docs.signed_ip             IS 'IP address captured at signing time (via /api/sign server route)';
COMMENT ON COLUMN docs.signed_ua             IS 'User-agent captured at signing time';
COMMENT ON COLUMN docs.first_view_ip         IS 'IP address of first document view';
COMMENT ON COLUMN docs.first_view_ua         IS 'User-agent of first document view';
COMMENT ON COLUMN docs.items                 IS 'Invoice line items array: [{id, desc, qty, price}]';
COMMENT ON COLUMN docs.invoice_total         IS 'Cached sum of items — avoids re-summing JSONB on every read';
COMMENT ON COLUMN docs.signature             IS 'Client signature as base64 PNG data URL (580×140 canvas)';
COMMENT ON COLUMN docs.fee                   IS 'Per-call rate as text (e.g. $150) — stored as text for display flexibility';

COMMENT ON TABLE  doc_events                 IS 'Immutable audit log for all significant lifecycle events on a doc';
COMMENT ON COLUMN doc_events.event_type      IS 'created | email_sent | viewed | signed | invoice_viewed | payment_updated';
COMMENT ON COLUMN doc_events.metadata        IS 'Contextual data: { via: "magic_link" | "code", to: "email@..." }';

-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 10 — Performance fields on docs (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE docs ADD COLUMN IF NOT EXISTS calls_total       INTEGER       DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS calls_qualified   INTEGER       DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS jobs_booked       INTEGER       DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS ad_spend          NUMERIC(10,2) DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS avg_job_value     NUMERIC(10,2) DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS monthly_budget    NUMERIC(10,2) DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS monthly_call_cap  INTEGER       DEFAULT 0;
ALTER TABLE docs ADD COLUMN IF NOT EXISTS rate_per_call     NUMERIC(10,2) DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: daily_metrics — per-doc daily performance log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id           UUID        NOT NULL REFERENCES docs(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  spend            NUMERIC(8,2) DEFAULT 0,
  calls_total      INTEGER      DEFAULT 0,
  calls_qualified  INTEGER      DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE(doc_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_doc_date ON daily_metrics(doc_id, date DESC);

-- RLS: only service_role writes (admin API routes)
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- COMMS MODULE (voice + text between admin and client)
-- Added by the /comms-test standalone module. Reserved for later portal wiring.
-- ─────────────────────────────────────────────────────────────────────────────

-- Web-push subscriptions — one row per device that opted in for ring notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_code    TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'client')),
  endpoint    TEXT        NOT NULL UNIQUE,
  p256dh      TEXT        NOT NULL,
  auth        TEXT        NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_code ON push_subscriptions(doc_code, role);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- No anon policies — service_role only (all reads/writes via API routes).

-- Text chat log — persists across sessions, drives ChatPanel + unread counts
CREATE TABLE IF NOT EXISTS comms_messages (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_code     TEXT        NOT NULL,
  sender_role  TEXT        NOT NULL CHECK (sender_role IN ('admin', 'client')),
  body         TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_comms_messages_code_created
  ON comms_messages(doc_code, created_at DESC);

ALTER TABLE comms_messages ENABLE ROW LEVEL SECURITY;
-- Access exclusively via /api/comms/messages (service_role).
