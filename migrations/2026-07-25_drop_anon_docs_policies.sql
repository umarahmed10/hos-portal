-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-07-25 — Revoke anonymous access to the `docs` table.
--
-- WHY
-- ---
-- `client_read_by_code` granted `anon` SELECT with `USING (true)` — despite the
-- name, it applied no filter at all. Because NEXT_PUBLIC_SUPABASE_ANON_KEY ships
-- to every browser, any visitor could read every row in `docs`, including the
-- 6-character access `code` that is the ONLY secret protecting a client portal,
-- plus name, email, invoice_total, magic_token_hash and the signature image.
-- Verified 2026-07-25: all 28 rows were readable with the public anon key.
--
-- `client_sign` granted `anon` UPDATE on any row with status='pending', letting
-- anyone write an arbitrary signature onto anyone's pending agreement. It was
-- kept as a "fallback" for direct browser signing, but the primary path
-- (/api/sign) already validates the code, enforces status, and captures IP/UA.
--
-- SAFETY
-- ------
-- The only browser-side reader of `docs` was components/client/ClientCodeEntry.tsx,
-- migrated in the same change to use GET /api/docs/by-code/[code] (server-side,
-- service-role). SignaturePad has no direct Supabase usage. All other access is
-- server-side via the service role key, which bypasses RLS and is unaffected.
--
-- After this runs, RLS remains ENABLED on `docs` with no anon policies, so the
-- anon key can read and write nothing. Service-role access is unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "client_read_by_code" ON docs;
DROP POLICY IF EXISTS "client_sign"         ON docs;

-- Belt and braces: ensure RLS is on, so the absence of policies means deny-all
-- for anon rather than unrestricted access.
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

-- Verify (expect zero rows):
--   SELECT policyname FROM pg_policies WHERE tablename = 'docs' AND 'anon' = ANY(roles);
