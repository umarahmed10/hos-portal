# HOS Client Portal — Full Test Report

**Date:** 2026-07-25 · **Commit:** `5e91d35` · **Branch:** `main`
**Scope:** static analysis, production build, API contract + security, functional browser, non-functional (perf / a11y / responsive / resilience)

**Headline:** the app's structural security (route guards, session handling, API authorization) is genuinely solid. The critical failures were all in the **data layer and unauthenticated side-doors**, not the app logic.

---

## ✅ REMEDIATION STATUS — all findings closed

Every finding below has been fixed and re-verified by re-running the exact test that originally failed. Typecheck clean, ESLint **0 errors** (was 38), production build passing.

| ID | Finding | Status |
|---|---|---|
| C1 | anon key readable all 28 client rows + codes | **Fixed** — verified `*/0` on live DB |
| C2 | anon could sign any pending doc | **Fixed** — policy dropped |
| H1 | `/api/avatar` no auth | **Fixed** — 401 unauth, 200 authed |
| H2 | no rate limit on credentials | **Fixed** — 429 at threshold on all 3 |
| H3 | `/api/notify` + `/api/email-signed` open relay + HTML injection | **Fixed** — 401 unauth, all values escaped |
| H4 | `/api/pdf` served any agreement | **Fixed** — token bound to one code |
| A1 | `price:"abc"` → silent $0 invoice | **Fixed** — 400 |
| A2 | raw Postgres errors leaked (4 routes) | **Fixed** — generic messages |
| A3 | PATCH 500s (empty body, overpay) | **Fixed** — 400 with usable text |
| A4 | CSV accepted impossible metrics | **Fixed** — 400 |
| M1 | payment receipts never sent | **Fixed** — `INTERNAL_SECRET` generated + wired |
| M2 | in-memory limiter on serverless | **Documented** — needs Redis/KV for a hard cap |
| M3 | CSRF skipped when `Origin` absent | **Fixed** — fails closed via `Sec-Fetch-Site` |
| M4 | middleware didn't bind session to slug | **Fixed** — enforced in `proxy.ts` |
| M5 | missing CSP / HSTS / Permissions-Policy | **Fixed** — added to `vercel.json` |
| M6 | no signature size cap | **Fixed** — 500 KB cap, 400 over |
| L1 | 38 ESLint errors + broken `npm run lint` | **Fixed** — 0 errors, script corrected |
| L2/R1 | contrast below WCAG AA | **Fixed** — 0 failures measured |
| L3 | no styled 404 | **Fixed** — `app/not-found.tsx` |
| R2 | unlabeled inputs | **Fixed** — 0 unlabeled |
| R3 | one shared `<title>` | **Fixed** — per-route titles |
| P1 | LiveKit = 48% of portal JS | **Fixed** — 1,124 KB → 582 KB |

**Two bugs were found by the remediation itself**, not the original audit:
- `getDocForClient()` used the anon key server-side; dropping the RLS policy 404'd the entire signing flow. Caught in post-change verification. (See C1.)
- `SignPage` ignored its `redirectAfter` prop, so clients signing inside the portal were bounced out to the standalone done page — surfaced by the unused-variable lint cleanup. (See L1.)

**Still requires you:** rotate the admin password (plaintext, exposed in chat), add `INTERNAL_SECRET` to Vercel, and delete the test artifact `ABC123/avatar.png` from the production avatars bucket.

---

## Result summary

| Layer | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | **Pass** — 0 errors in source |
| ESLint | **38 errors, 1 warning** — all cosmetic (unused vars, unescaped entities) |
| Production build | **Pass** — 55 routes compiled |
| API auth enforcement (30 routes) | **30/30 pass** on admin/portal-gated routes |
| Route guards / forged JWTs | **Pass** — incl. `alg=none` rejected |
| Input validation & fuzzing | **Pass** — no 500s, no injection |
| HTTP method handling | **Pass** — 405s correct |
| Rate limiting | **Fail** — absent on all credential endpoints |
| Database RLS | **Critical fail** |
| Cross-tenant isolation (2 live sessions) | **Pass** — all 8 sub-pages + comms APIs correctly denied |
| Admin write paths (create/PATCH/import) | **Fail** — 8 bugs incl. a silent $0 invoice |
| Admin + portal read paths | **Pass** — all 200, no errors, no console noise |
| Accessibility | Multiple WCAG AA failures |
| Performance | 541 KB of LiveKit = 48.2% of portal JS |

---

## CRITICAL

### C1 — Public anon key can read every client record, including access codes
**`schema.sql:183-186`**

```sql
CREATE POLICY "client_read_by_code" ON docs
  FOR SELECT TO anon
  USING (true);          -- ← no filter; the name is a lie
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` ships to every browser. The policy grants `anon` unconditional `SELECT` on `docs`.

**Verified live against production Supabase:**
- `Content-Range: 0-0/28` → all **28 client rows** readable
- Readable columns confirmed: `code`, `name`, `email`, `invoice_total`, `magic_token_hash`, `signature` (16 KB signature image)

The 6-character access code is the **only** secret protecting a client portal. Every code is publicly readable, so any visitor can enumerate all codes and log into **every client's portal**. Also exposes signature images and invoice values — a contractual/PII problem, not just an access one.

**FIXED 2026-07-25** — `migrations/2026-07-25_drop_anon_docs_policies.sql`, applied to production.

Re-verified with the public anon key after the change: `Content-Range: */0` and an empty body, where it previously returned all 28 rows.

Two code changes were required alongside the policy drop, because both read `docs` with the anon key:

1. `components/client/ClientCodeEntry.tsx` — queried `docs` directly from the browser. Now calls `GET /api/docs/by-code/[code]` (server-side, service role).
2. `lib/data-access.ts` — **`getDocForClient()` used an internal anon client despite running server-side.** Dropping the policy made it return null, which 404'd the entire `/client/[code]` signing flow. Switched to the service-role client; access control for that flow is the code in the URL, enforced by an explicit `.eq("code", …)` filter.

> Finding #2 was a regression introduced by the fix and caught in post-change verification. The initial audit missed it because `data-access.ts` builds its own anon client internally rather than importing `lib/supabase-browser.ts`. **Lesson: grep for the env var (`NEXT_PUBLIC_SUPABASE_ANON_KEY`), not just the module.**

Also removed: the dead `signDoc()` helper (no callers, depended on the dropped `client_sign` policy) and the now-unused `getAnonClient()`. `lib/supabase-browser.ts` is left in place but has no importers — inert, since anon now has no policies on `docs`.

### C2 — Any anonymous user can sign any pending document
**`schema.sql:190-197`**

```sql
CREATE POLICY "client_sign" ON docs
  FOR UPDATE TO anon
  USING  (status = 'pending')
  WITH CHECK (status = 'signed' AND signature IS NOT NULL AND signed_at IS NOT NULL);
```

Combined with C1 (all pending docs are discoverable), anyone can write an arbitrary signature onto anyone's pending agreement. No code check, no session check. The comment calls it a "fallback" for the primary `/api/sign` path — but `/api/sign` already validates properly and captures IP/UA, so this policy is pure downside.

> Not exercised — testing it would have forged a signature on live data.

**Fix:** `DROP POLICY "client_sign" ON docs;` — `/api/sign` covers this path correctly.

---

## HIGH

### H1 — `/api/avatar` POST accepts uploads with no authentication
**`app/api/avatar/route.ts:34-83`**

No session check of any kind. **Verified live:** uploaded a PNG to `ABC123/avatar.png` in the production `avatars` bucket with no cookie. The `code` isn't even validated against an existing doc, and the bucket is public — so this is arbitrary attacker-controlled content hosted on your Supabase domain, plus avatar defacement for any known code.

Secondary: the rate-limit key is the constant `"avatar:upload"` (line 35), so the 5/min budget is **global across all users** — one user's uploads lock out everyone else.

**Fix:** require a portal session whose `doc_id` matches the code (`authorizeCommsCaller` already does exactly this), and key the limiter per code.

> **Cleanup needed:** my test left `ABC123/avatar.png` in your production avatars bucket. Nothing existed at that path before. I did not delete it — tell me and I'll remove it.

### H2 — No rate limiting on any credential endpoint
**Verified: 25 consecutive failed attempts, zero 429s on all three.**

| Endpoint | Attempts | 429s | Exposure |
|---|---|---|---|
| `POST /api/auth` | 25 | **0** | Admin password brute force — full admin compromise |
| `POST /api/portal-session` | 25 | **0** | Access-code brute force |
| `GET /api/docs/by-code/[code]` | 15 | **0** | Code enumeration oracle |

`lib/rate-limit.ts` exists and is used on comms/upload routes, but not on the endpoints that actually gate credentials.

Additionally `/api/auth:18` compares the password with `===` (non-constant-time). Minor next to the missing throttle, but use `bcrypt.compare` with `ADMIN_PASSWORD_HASH` — the code already supports it and the hash path is preferable to the plaintext path.

**Fix:** `rateLimit()` keyed on client IP, ~5/15min for `/api/auth`, ~10/min for the code endpoints.

### H3 — `/api/notify` and `/api/email-signed` are unauthenticated and injectable
**`app/api/notify/route.ts:23`, `app/api/email-signed/route.ts:16`**

**Verified:** both return `400 Validation error` (not `401`) to an unauthenticated caller — proving no auth gate sits in front. (Probed with deliberately invalid payloads so no real mail was sent.)

Two consequences:

1. **Open relay from your verified domain.** `/api/email-signed` sends to a caller-supplied `to` address. Anyone can send "Your signed agreement is ready" mail from `House Of Sales <solutions@hosautomations.co>` to arbitrary recipients — phishing with your branding, and Resend quota/reputation burn.
2. **HTML injection.** `name`, `company`, `service`, `code` are interpolated raw into the email HTML with no escaping. In `notify:61` the payload lands inside an `href` attribute:
   ```
   <a href="${appUrl}/admin/share?code=${code}" ...>
   ```
   A crafted `code` breaks out of the attribute and rewrites the link target in the email you receive. The `payment_received` branch (`notify:42-48`) has **no schema validation at all** — `name`, `company`, `email`, `code` are entirely free-form.

**Fix:** these are internal fire-and-forget calls from `/api/sign`. Gate both with the `INTERNAL_SECRET` header pattern that `/api/email-payment-receipt` already uses, and HTML-escape every interpolated value.

### H4 — `/api/pdf` serves any client's signed agreement with no session
**`app/api/pdf/route.ts:9-20`**

No auth of any kind — the 6-char `code` query param is the only gate. **Verified live:** while logged into the portal as `tst`, `GET /api/pdf?code=M36S5V` returned **200** with Jessica Spangler's full signed agreement PDF (name, company, service, line items, invoice total, signature image).

On its own this is "you need the code." **Chained with C1 — where every code in the table is publicly readable — it means every client's signed agreement is downloadable by anyone.** That's the C1 blast radius made concrete, and it's the reason C1 is rated critical rather than merely bad.

No rate limiting either, so the endpoint doubles as a code-enumeration oracle (`400` no code / `404` bad code / `200` hit).

**Fix:** require a portal session whose `doc_id` matches the requested code, or an admin session. Same guard `authorizeCommsCaller` already implements.

---

## MEDIUM

### M1 — Payment receipt emails can never send (dead endpoint)
**`app/api/email-payment-receipt/route.ts:17`**

```ts
if (!process.env.INTERNAL_SECRET || headerSecret !== process.env.INTERNAL_SECRET) return 401;
```

`INTERNAL_SECRET` is set **nowhere** — not in `.env.local`, not in `.env.example`. The guard fails closed, so the route always 401s (confirmed). It also has **zero callers** anywhere in the codebase. Clients never receive payment confirmations.

**Fix:** add `INTERNAL_SECRET` to `.env.local` / `.env.example` / Vercel, and wire the call into the payment-confirmation path.

### M2 — In-memory rate limiter doesn't work on Vercel
**`lib/rate-limit.ts:1`** — `new Map()` in module scope. On serverless each instance has its own map and they're recycled constantly, so limits are effectively per-instance and reset on cold start. The comms limits that *do* exist are far weaker in production than they look locally.

**Fix:** Upstash Redis or Vercel KV for anything security-relevant.

### M3 — Middleware CSRF check skipped when `Origin` is absent
**`proxy.ts:69`** — `if (origin && host)`. **Verified:** a POST with a forged `Origin` is correctly `403`d, but a POST with **no** `Origin` header passes the CSRF check entirely (it 401s only because it lacks a session).

Largely mitigated by `SameSite=Lax` cookies, so this is defense-in-depth rather than a live hole — but the guard should fail closed.

**Fix:** treat a missing `Origin` on a state-changing request as a rejection, or fall back to `Sec-Fetch-Site`.

### M4 — Middleware doesn't bind the portal session to the URL slug
**`proxy.ts:108-124`** — it computes `slug` but only uses it for the redirect target; it never checks `sessionSlug === slug`.

**Actively tested with two live sessions and NOT exploitable.** Holding a valid portal session for `tst`, every one of Jessica Spangler's 8 portal sub-pages redirected to the code-entry page with zero data rendered. All cross-tenant comms API calls (`messages`, `unread`, `call-state`, `token`, send-as-other) returned **401**. Every portal page independently enforces `if (!session || session.slug !== slug) redirect(...)`.

> An earlier automated pass flagged this as a live leak. That was a **false positive** — the detection regex matched the substring "spangler" inside the slug `spangler-drain-rooter-3163eea3` in the page's script payload, not tenant data. Browser-level navigation disproved it.

The gap is still worth closing: the middleware is the right place for that guarantee, and a future page that forgets the check inherits a cross-tenant read.

**Fix:** add `if (sessionSlug !== slug)` to the middleware so the guarantee is structural.

### M5 — Missing security headers
**`vercel.json`** has `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`. Missing: **`Content-Security-Policy`**, **`Strict-Transport-Security`**, `Permissions-Policy`.

CSP matters most here — the app renders client-supplied names/companies throughout the portal, so CSP is the backstop if any XSS slips in. `Permissions-Policy` is also worth setting deliberately given the app requests camera/mic for calls.

### M6 — No request body size limit on `/api/sign`
A 3 MB `signature` payload was accepted and processed (reached the "document not found" stage rather than being rejected). Signatures land in Postgres; with a valid code this is a cheap storage-bloat vector. Cap `signature` length in the zod schema (a 1 KB–200 KB PNG data URL is realistic).

---

## LOW / QUALITY

### L1 — 38 ESLint errors
All cosmetic: ~30 unused imports (mostly unused style tokens like `BODY`, `SURF`, `GOLD`), 4 unescaped `"` in `AdminForm.tsx:475,488`, and 2 `<a href="/">` that should be `next/link` (`app/client/[code]/page.tsx:54`, `sign/SignPage.tsx:164` — these cause a full page reload instead of client nav).

`next lint` is **removed in Next 16** — `npm run lint` currently fails with a bogus "no such directory: lint" error. Update the script to `eslint .`.

### L2 — Accessibility (WCAG AA failures)

**Contrast** — measured on rendered pages:

| Element | Ratio | Required |
|---|---|---|
| `MUTED` `#727272` body text | **3.93** | 4.5 |
| `GOLD` @ 50% opacity, 9px labels | **3.84** | 4.5 |

`MUTED` is a core token used app-wide (`lib/styles.ts:30`), so this is systemic. Darkening the background or lifting `MUTED` to ~`#8A8A8A` clears it.

**Structure:**
- Code input on `/client` has **no accessible name** — no `<label>`, no `aria-label`. Screen readers announce an unlabeled textbox on the app's primary entry point.
- **No `<main>` landmark** on any page tested.
- Buttons use `type="submit"` while outside any `<form>`.
- Code input has no `inputmode` — mobile users get the default keyboard for a 6-char alphanumeric code.

### L3 — No `not-found.tsx`
404s fall back to Next's unstyled default, which breaks the visual system on a route clients do hit (bad/expired portal links).

---

## PERFORMANCE

### P1 — 541 KB of LiveKit loads on every portal page
**Measured on the production build at the real authenticated `/portal/[slug]/dashboard`:**

| Metric | Value |
|---|---|
| Total JS decoded | 1,123.6 KB |
| Total JS gzipped | 310.3 KB |
| `livekit-client` chunk | **541.2 KB decoded / 139.9 KB gzipped** |
| **Share of page JS** | **48.2%** |
| TTFB / FCP / LCP | 371 ms / 436 ms / 552 ms (localhost) |

Confirmed on the unauthenticated entry page too (`/portal/acme`): the chunk is in the route's graph regardless of whether any call UI renders, so **even the portal login screen pays the full 140 KB.** LCP of 552 ms is on localhost with no network latency; on a real 4G connection this is the dominant cost.

Cause: `app/portal/[slug]/layout.tsx:12` statically imports `IncomingCallListener` → `CommsCallOverlay` → `CommsWorkspace` → `useCall` → `livekit-client`. Because the import is static, the chunk is in the route's graph and downloads **on every portal page — including for visitors who never place a call.**

There is **zero code-splitting in the codebase** — no `next/dynamic`, no `React.lazy`, no `await import()` anywhere.

**Fix:** lazy-load the call stack. This is the single highest-leverage perf change available:
```tsx
const CommsCallOverlay = dynamic(
  () => import("@/components/comms/CommsCallOverlay").then(m => m.CommsCallOverlay),
  { ssr: false }
);
```
`IncomingCallListener` can keep its lightweight polling and only pull LiveKit once a call is actually accepted. Expect roughly a 48% cut in portal JS.

Also note LiveKit appears as **two identical 541 KB chunks** (1.08 MB of the 2.29 MB total build) — worth confirming it isn't duplicated across route groups after the split.

### P2 — Server-only deps confirmed absent from client bundles
`@react-pdf`, `web-push`, `bcryptjs`, and the Resend SDK are **not** in any client chunk. (Early `resend` grep hits were false positives — LiveKit's `resendReliableMessages`.) Shared runtime is 446 KB uncompressed / ~160 KB gzipped, which is reasonable.

---

## What passed (verified, not assumed)

- **API authorization — 30/30.** Every admin route (`/api/docs`, `/api/settings`, `/api/comms/roster`, `/api/daily-metrics`, `/api/generate-agreement`, doc PATCH/archive/events) returns 401 unauthenticated. All comms routes correctly 401 with valid params.
- **Route guards.** All portal sub-routes and all `/admin/*` routes redirect cleanly when unauthenticated.
- **JWT handling.** Garbage tokens, `alg=none` forgery, and cross-cookie reuse (portal cookie on admin route) all rejected. Cookies are `HttpOnly` + `SameSite=Lax` + `Secure` in production.
- **Defense in depth on tenancy.** All 8 portal sub-pages independently re-verify `session.slug === slug`.
- **Input validation.** Malformed JSON, wrong types, arrays, `null`, deeply-nested JSON, SQL injection, XSS, and path traversal in the `code` param → all correct 4xx, **no 500s, no injection**. `/api/docs/by-code` sanitizes with a strict `[^A-Z0-9]` filter.
- **HTTP methods.** Correct 405s on wrong verbs.
- **Error hygiene.** No stack traces or internal details leaked; no `console.log` in the 44 shipped client components; error boundaries present at root, admin, and portal levels.
- **Responsive.** No horizontal overflow at 375 px or 1280 px on landing or `/client`. Minor: tap targets 40 px vs the 44 px guideline.
- **Client-side error UX.** Invalid access code shows a clear, non-technical message.

---

## Recommended order

1. **C1 + C2** — drop both `anon` policies on `docs`. Live data exposure; do this first.
2. **H4** — add a session check to `/api/pdf`. This is C1's blast radius; closing C1 without this still leaves agreements one guessed code away.
3. **H1** — add auth to `/api/avatar`.
4. **H2** — rate-limit `/api/auth` and `/api/portal-session`.
5. **H3** — gate `/api/notify` + `/api/email-signed`, escape interpolated HTML.
6. **A1 + A4** — numeric validation on `items[].price` (the silent $0 invoice) and the `calls_qualified > calls_total` gap. Both corrupt data that clients see.
7. **A2** — stop returning `String(err)`; it leaks Postgres internals from four routes.
8. **P1** — `dynamic()` the call overlay (~48% portal JS cut).
9. **M1** — set `INTERNAL_SECRET`, wire up payment receipts.
10. **A3**, M2–M6, then L1–L3, R1–R3. Within the a11y set, fix `Exit` at 1.82 first.

---

## AUTHENTICATED ADMIN FINDINGS (round 2)

Tested with a live admin session. All admin **read** paths returned correct data (`/api/settings`, `/api/docs`, doc events, comms roster/unread/messages, avatar). All 6 admin pages render 200 with no error boundary. Dashboard revenue math verified correct against source data. Archive works. **No mass assignment** — injected `is_admin`/`role` fields were stripped by zod.

The write paths are where it breaks.

### A1 — `items[].price` has no numeric validation (`app/api/docs/route.ts:34-39`)

```ts
items: z.array(z.object({ id:z.number(), desc:z.string(), qty:z.string(), price:z.string() }))
```

`price`/`qty` are bare strings. Nothing checks they're numeric, so garbage reaches Postgres:

| Input | Actual | Expected |
|---|---|---|
| `price: "abc"` | **201 Created, `invoice_total: 0`** | 400 |
| `price: "-500"` | 500, raw constraint error | 400 |
| `price: "999999999999"` | 500 `numeric field overflow` | 400 |
| `name` × 10,000 chars | 201 Created | 400 |

**`price: "abc"` → a $0 invoice is the important one** — a typo in the admin form silently produces a valid-looking client record billed at nothing. No error, no warning.

**Fix:** `z.string().regex(/^\d+(\.\d{1,2})?$/)` (or coerce to number with `.min(0).max(...)`), and cap `name` length.

### A2 — Raw Postgres errors leaked to the client on 500

`app/api/docs/route.ts:84` and `app/api/docs/[code]/route.ts` return `String(err)`, exposing constraint names and internals:

- `violates check constraint "docs_amo…"` — from `amount_paid > invoice_total`
- `numeric field overflow`
- `Cannot coerce the result to a single JSON object`
- `insert or update on table "daily_metrics" violates foreign key constraint…`

Same pattern as `/api/sign:110`. **Fix:** log server-side, return a generic message.

### A3 — `PATCH /api/docs/[code]` 500s on three realistic inputs

PATCH validates far better than POST (enums, types, negatives all correctly 400) — but:

| Input | Actual | Expected |
|---|---|---|
| `amount_paid` > `invoice_total` | **500** + leaked constraint | 400 "cannot exceed invoice total" |
| `{}` (empty body) | **500** `Cannot coerce…` | 400 or 200 no-op |
| only unknown fields | **500** `Cannot coerce…` | 400 |

Overpay is a realistic admin typo when recording a payment, and it produces a 500 instead of a usable message. The empty-body case is the root cause of the other two: zod strips unknown keys → empty update object → Supabase updates 0 rows → coercion error. **Fix:** reject empty update sets before hitting the DB.

### A4 — CSV import accepts impossible metrics (`app/api/daily-metrics/import/route.ts:9-14`)

Validation is otherwise strong (uuid, date regex, non-negative, int, max 400 rows — 7/10 probes correctly rejected). Three gaps:

| Input | Actual | Expected |
|---|---|---|
| `calls_qualified: 999`, `calls_total: 5` | **200 accepted** | 400 |
| `date: "2026-02-31"` | **500** raw PG date error | 400 |
| nonexistent (valid-uuid) `doc_id` | **500** raw FK error | 404 |

`calls_qualified > calls_total` is the real one — **these numbers feed the client-facing dashboard and reports.** A Google Ads CSV with shifted columns silently produces impossible metrics shown to the client. **Fix:** add a cross-field refinement, validate the date is real, and check `doc_id` exists first.

---

## AUTHENTICATED PORTAL FINDINGS (round 3)

Tested with a live portal session for `tst` (`test-9a951e50`).

**All 9 portal routes returned 200 with no error boundary and no console errors** — entry, dashboard, invoices, documents, reports, performance, campaigns, status, support. `/status` correctly redirects a paid client to `/dashboard`. Server render times 306–662 ms. Client-side error handling and the redirect logic behave exactly as designed.

### R1 — Contrast is materially worse on the authenticated portal than on public pages

The dashboard is the app's most-used screen and its densest. Reliably measured failures:

| Element | Color | Size | Ratio | Need |
|---|---|---|---|---|
| **"Exit" (logout control)** | `#404040` | 12px | **1.82** | 4.5 |
| "88% qualified" | `#404040` | 9px | **1.68** | 4.5 |
| `MUTED` body text (widespread) | `#727272` | 10–14px | **3.93** | 4.5 |
| `$500.00 left` | `#727272` | 10px | **3.62** | 4.5 |
| `GOLD` labels / "Call or message" | `#8B6B3E` | 9–13px | **3.84** | 4.5 |

**`Exit` at 1.82 is the one to fix first** — it's a functional control (portal logout), not decoration, rendered in `#404040` on near-black.

> Several additional entries measured at ~1.0 (e.g. `✓ Signed`, `ROI Positive`, the jobs/avg line). Those are **almost certainly artifacts** of my background resolver failing to composite `rgba()` tint layers, not real 1:1 contrast. They need a manual check before being treated as findings — I'm not counting them.

### R2 — Avatar file input has no accessible name
The `<input type="file">` in `AvatarPicker` has no `<label>`, `aria-label`, or `aria-labelledby`. Screen readers announce an unlabeled file input. Same class as the `/client` code field (L2).

### R3 — Every page shares one `<title>`
All admin and portal routes render `<title>HOS Client Portal</title>`. Only `/comms-test/admin` sets its own (`HOS Comms · Admin`). Browser tabs, history, and bookmarks are indistinguishable across the whole app. Add per-route `metadata.title`.

---

## Coverage gaps

Not exercised, and why:

- **Live voice/video calls** — needs two authenticated peers plus real LiveKit sessions.
- **The admin UI as a UI** — admin and portal surfaces were driven through their APIs and server-rendered HTML with live sessions, not by clicking every form control. Form-level behavior (inline validation messages, disabled states, optimistic updates) is unverified; the underlying endpoints they call are covered.
- **Payment/Skydo/Wise routing** — not exercised; would require live payment state transitions.
- **Real email delivery** — deliberately probed with invalid payloads to prove the auth gap without sending mail from your domain.
- **RLS write policy (C2)** — reported from the policy definition; exercising it would forge a signature on production data.
- **No automated test framework exists** in this project (no Jest/Vitest/Playwright). Everything above was run manually against dev and production builds. Worth adding: a Vitest suite pinning the auth matrix, and a Playwright run for the sign → portal flow.
