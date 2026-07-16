-- Comms call history (Phase 3)
-- Adds call-lifecycle events to the existing conversation log so they render
-- inline with chat, Discord-style. Backward compatible: existing rows default
-- to kind='text'. Safe to run more than once.
--
-- Run in the Supabase SQL editor (or psql) against the project database.

ALTER TABLE comms_messages ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text';
ALTER TABLE comms_messages ADD COLUMN IF NOT EXISTS meta JSONB;

-- body is empty for call rows; relax any legacy NOT-NULL-without-default.
ALTER TABLE comms_messages ALTER COLUMN body SET DEFAULT '';

-- Constrain kind to known values (drop-then-add so re-runs don't error).
ALTER TABLE comms_messages DROP CONSTRAINT IF EXISTS comms_messages_kind_check;
ALTER TABLE comms_messages ADD  CONSTRAINT comms_messages_kind_check
  CHECK (kind IN ('text', 'call'));
