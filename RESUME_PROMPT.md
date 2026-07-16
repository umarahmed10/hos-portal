# HOS Client Portal — Premium UX Overhaul — Complete Resumption Prompt

> Paste this entire file as your first message in a new session.  
> Working directory: `c:\Users\umara\Desktop\hos\Tools\hos-portal-main\hos-portal-main`  
> Live URL: `https://hos-portal-main.vercel.app`  
> Deploy command (run after every batch of changes): `vercel --prod --yes`

---

## WHO YOU ARE

You are a senior product engineer, UX architect, and product designer specialising in premium B2B SaaS. You write zero-compromise code: production-quality TypeScript, pixel-perfect UI, smooth animations. The client is **HOS Automations** — a qualified lead generation agency. Their brand is dark, minimal, condensed-type, confidence. Think Apple checkout meets luxury financial product. Every surface must feel **earned and trustworthy**.

---

## STACK — READ THIS BEFORE TOUCHING ANYTHING

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router (server components default) |
| Language | TypeScript, target ES2018 |
| Database | Supabase PostgreSQL with RLS |
| Auth | JWT via `jose` — `hos_admin_session` cookie (admin) + `hos_portal_session` cookie (per-doc portal), 24 h httpOnly |
| Email | Resend (`lib/resend.ts`) |
| AI | OpenRouter (`/api/support-chat`, `/api/generate-agreement`) |
| PDF | Puppeteer (`/api/pdf`) |
| Fonts | Barlow Condensed (headers), Barlow (body), JetBrains Mono (mono) — loaded in `app/layout.tsx` |
| Design tokens | `lib/styles.ts` (JS constants) + `app/globals.css` (CSS variables) — **never hardcode hex values** |
| Middleware | `proxy.ts` (not `middleware.ts`) — protects `/admin/*` and `/portal/:slug/:subpath+` |
| Deployment | Vercel CLI: `vercel --prod --yes` from local. No GitHub integration. |

### Key env vars (already set in Vercel):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`, `ADMIN_PASSWORD`
- `NEXT_PUBLIC_APP_URL` = `https://hos-portal-main.vercel.app`
- `RESEND_API_KEY`, `RESEND_FROM` = `onboarding@hosautomations.com`
- `OPENROUTER_API_KEY`

### Design token quick reference (`lib/styles.ts`):
```
BG="#090909"  SURF="#111111"  BORDER="#1d1d1d"  TEXT="#f5f0eb"
MUTED="#555555"  GREEN="#22c55e"  AMBER="#eab308"  RED="#ef4444"
FONT=Barlow Condensed (headers)  BODY=Barlow  MONO=JetBrains Mono
css.btnP = primary (cream bg)  css.btnS = secondary  css.card = surface card
css.inp = form input  css.lbl = form label
```

### DB schema highlights (already applied via schema.sql v3):
```sql
docs: id, code, slug, name, company, email, status (pending|signed|archived|draft),
      agreement_text, invoice_json, signed_at, signed_ip, signed_ua,
      accepted_esign_terms (bool), magic_token_hash,
      first_view_ip, first_view_ua,
      payment_status (unpaid|partially_paid|paid), amount_paid, invoice_total

doc_events: id, doc_id, event (viewed|signed|opened_email|link_clicked|...), 
            metadata jsonb, ip, ua, created_at
```

---

## WHAT EXISTS TODAY (don't rewrite unless instructed)

All these files already exist and are functional:

```
app/
  page.tsx                         ← Landing page (Client/Admin tab toggle)
  layout.tsx                       ← Root layout, fonts, Sonner
  globals.css                      ← All CSS variables + mobile media queries

  admin/
    page.tsx                       ← AdminDashboard (server) + AdminList (client, SWR 8s poll)
    new/page.tsx                   ← Create doc
    edit/[code]/page.tsx           ← Edit doc
    share/page.tsx                 ← AdminShare wrapper (fetches events server-side)

  client/
    page.tsx                       ← Code entry form
    [code]/
      page.tsx                     ← Doc viewer + sign CTA + TrustBox
      sign/
        page.tsx                   ← SignPage server wrapper
        SignPage.tsx               ← 4-step premium signing flow (CLIENT COMPONENT)
      done/
        page.tsx                   ← Confirmation page (confetti, social proof, status tracker)
        DoneCountdown.tsx          ← Countdown → portal redirect

  portal/
    [slug]/
      page.tsx                     ← Entry page (magic link auto-auth OR code form)
      layout.tsx                   ← Portal shell (header + PortalNav)
      status/page.tsx              ← Status tab (StatusTracker)
      documents/page.tsx           ← Documents tab (sign CTA or signed state)
      invoices/page.tsx            ← Invoice tab
      reports/page.tsx             ← Call reports stub
      campaigns/page.tsx           ← Campaign updates stub
      support/page.tsx             ← AI chatbot (SupportChat)

  api/
    auth/route.ts                  ← Admin login
    logout/route.ts
    docs/route.ts                  ← CRUD list
    docs/[code]/route.ts           ← CRUD single
    docs/[code]/archive/route.ts
    docs/[code]/events/route.ts    ← Event log for admin
    email-client/route.ts          ← Send magic link email via Resend
    generate-agreement/route.ts    ← OpenRouter AI agreement generation
    notify/route.ts                ← Admin email notification
    pdf/route.ts                   ← Puppeteer PDF generation
    portal-session/route.ts        ← Portal auth (magic token OR code)
    sign/route.ts                  ← Server-side signing (IP/UA capture, logEvent)
    support-chat/route.ts          ← OpenRouter chatbot

components/
  client/
    AdminShare.tsx                 ← Share page (email send, portal URL, code, events)
    AdminList.tsx                  ← Dashboard table (SWR polling)
    AdminForm.tsx                  ← Doc create/edit form
    ConfettiExplosion.tsx          ← Canvas confetti
    CopyButton.tsx                 ← Copy-to-clipboard with feedback
    DoneCountdown.tsx              ← Countdown timer
    EventTimeline.tsx              ← Admin event timeline
    InvoiceTable.tsx               ← Invoice line items
    PortalNav.tsx                  ← Portal tab navigation
    StatusTracker.tsx              ← Amazon-style progress tracker
    SupportChat.tsx                ← AI chat UI
    TrustBox.tsx                   ← Trust signals before signing
  server/
    DocumentPreview.tsx            ← Agreement + invoice preview
    StatusBadge.tsx                ← Status pill badge
  shared/
    Icons.tsx                      ← Loader2, etc.

lib/
  data-access.ts                   ← All DB helpers (logEvent, getDocEvents, signDocViaAPI, etc.)
  styles.ts                        ← Design tokens
  utils.ts                         ← money(), fmtDateTime(), etc.
  portal-auth.ts                   ← getPortalSession()
  api-client.ts                    ← loginAdmin(), client-side fetch helpers
  supabase.ts                      ← Supabase client instances
  resend.ts                        ← Resend email helper

types/index.ts                     ← Doc, DocEvent, InvoiceItem types
proxy.ts                           ← Next.js middleware
schema.sql                         ← DB schema (v3, already applied)
```

---

## FULL REQUIREMENTS — IMPLEMENT ALL OF THESE

### 1. LOGO + BRAND IDENTITY
- Add an SVG logo mark to `public/hos-logo.svg` — a simple geometric mark: two overlapping circles or an "H" in a square, cream on dark. Use it in:
  - Landing page top (replaces the dot + "HOS AUTOMATIONS" badge — keep text, add mark left of it)
  - Portal top-bar header (left of "CLIENT PORTAL" text)
  - Admin top bar
  - Email templates (embed as hosted URL)
- Do **not** add a full wordmark PNG — the logotype is already rendered in type

### 2. PREMIUM DESIGN OVERHAUL — EVERY SURFACE

The current UI is described as "tacky and fucked". The target is: **Apple product page × Stripe dashboard × luxury finance app**.

Global rules:
- Generous whitespace — padding should feel airy, not cramped
- Micro-animations on every meaningful state transition (CSS `@keyframes` or `transition`)
- Every heading must be in `FONT` (Barlow Condensed) — no Barlow body font for h1/h2/h3
- Buttons: primary = cream bg + dark text + `letter-spacing: 1px` + `text-transform: uppercase`. No rounded pill — use `border-radius: 6px`
- Cards: `background: #111` + `border: 1px solid #1d1d1d` + subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.4)`
- Form inputs: `background: #0c0c0c` + `border: 1px solid #242424` — on focus animate border to `#3a3a3a`
- Success states: green (`#22c55e`) — never amber
- Spacing scale: 4/8/12/16/20/24/32/40/48/64/80px — pick from this, no odd values

### 3. SIGNING FLOW — APPLE PRODUCT PAGE QUALITY

File: `app/client/[code]/sign/SignPage.tsx`

Current: 4-step stepper exists but feels cheap.

Required upgrades:
- **Stepper**: large numbered dots (40px) with connecting line; each step label visible at all breakpoints > 380px; completed steps show `✓` in GREEN; active step glows subtly; smooth transition when advancing
- **Step 1 — Agreement Review**:
  - Sticky bottom bar with gradient fade-up (`background: linear-gradient(transparent, #090909 60%)`)
  - Agreement text: `font-family: Georgia, serif` + `line-height: 2` + `color: #b0b0b0`
  - Max-height `420px` scrollable, custom thin scrollbar
  - CTA: "I'VE READ THE AGREEMENT →" — only advances, does not submit
- **Step 2 — Invoice**:
  - Large callout card: total amount in `font-size: 48px` Barlow Condensed + "Total Due" label
  - Payment status badge (UNPAID / PARTIALLY PAID / PAID)
  - Invoice line-item table below
  - "LOOKS GOOD →" advances
- **Step 3 — Identity + Signature**:
  - "Signing As" row: client name + date, separated by thin border
  - **TrustBox** immediately above signature pad:
    ```
    ✓ No setup fees
    ✓ Cancel anytime with 7 days notice
    ✓ You only pay for qualified calls
    ✓ Signed copies automatically emailed
    ```
    Style: `border: 1px solid rgba(34,197,94,0.2)` + `background: rgba(34,197,94,0.04)` + green `✓` marks
  - **Agency Credibility section** below TrustBox, above sig pad:
    ```
    WHY COMPANIES CHOOSE HOS
    ──────────────────────────
    10+  Minimum Guaranteed Calls
    48h  Average Time to First Result  
    2,000+  Phone Call Leads Delivered
    ★★★★★  "Best ROI we've seen in paid lead gen." — Brad P., Plumbing Co.
    ```
    Style: dark card, stats in Barlow Condensed 36px, label in 11px Barlow MUTED
  - **E-sign checkbox**: "I understand and agree that my e-signature is legally binding." — green accent when checked. **Required to check before SIGN button activates**. Tracked in `docs.accepted_esign_terms`
  - Signature pad: full-width, `height: 180px` on desktop, `height: 200px` on mobile. Label: "DRAW YOUR SIGNATURE BELOW" in 10px MUTED uppercase
  - SIGN button: only enabled when checkbox checked AND signature drawn. On click → loading spinner + "SECURING…" → success
- **Step 4 — Confirmation**:
  - 80px green circle ✓ (animated scale-in)
  - "AGREEMENT EXECUTED" in 11px uppercase green letter-spaced label
  - Large heading: "WELCOME TO HOS." in Barlow Condensed 64px
  - Animated checklist (staggered fadeIn, 150ms apart):
    ```
    ✓ Agreement Executed
    ✓ Client Activated  
    ✓ Campaign Queue Started
    ```
  - Social proof grid (3 columns):
    ```
    10+  Minimum Guaranteed Calls
    48h  Average Time to First Call
    2,000+  Phone Call Leads Delivered
    ```
  - Primary CTA: "OPEN MY PORTAL →" (if `doc.slug` set) → `/portal/${slug}/status`
  - Secondary: "Download signed copy (PDF)" as plain text link

### 4. CONFETTI — PREMIUM VERSION

File: `components/client/ConfettiExplosion.tsx`

Current: basic canvas confetti.

Required: upgrade to feel luxurious:
- Particles: mix of small rectangles, circles, and tiny stars
- Colors: cream (`#f5f0eb`), green (`#22c55e`), white — no garish rainbow
- Physics: high initial velocity upward, natural gravity arc, slight rotation, fade-out on edges
- Duration: 4 seconds total, peaks at 0.5s, trails off
- Fire from center-top of viewport

### 5. CONFIRMATION PAGE (done/page.tsx)

Already partially upgraded. Remaining:
- The animated checklist from step 4 above (same component, reuse)
- StatusTracker must show all 6 steps with real timestamps from `doc_events`:
  ```
  ✓ Agreement Signed         [timestamp]
  ✓ Account Activated        [timestamp or "Completing..."]
  ⏳ Invoice Payment          [pending — "View Invoice →"]
  ⏳ Campaign Setup           [pending]
  ⏳ Ad Account Review        [pending]
  ⏳ Launching                [pending]
  ```
- Weekly reporting note: "You'll receive a weekly report every Monday."

### 6. CLIENT PROGRESS INDICATOR

Currently: clients have no idea where they are in the process.

Required: add a persistent `ProgressBanner` component shown at the top of:
- `app/client/[code]/page.tsx` (doc view page)
- `app/portal/[slug]/status/page.tsx`

The banner shows: `Step 2 of 4 — Sign your agreement to activate your account`

Steps:
1. Document Received
2. Agreement Signed
3. Invoice Paid
4. Campaign Active

Derive current step from `doc.status` + `doc.payment_status`. Style: thin bar across the top of the content area, `background: rgba(234,179,8,0.05)`, `border-bottom: 1px solid rgba(234,179,8,0.15)`, step dots connected by a line.

### 7. PAYMENT STATUS

DB column `payment_status` (enum: `unpaid | partially_paid | paid`) already exists in schema.

Required:
- In `AdminList.tsx` (dashboard table): add "Payment" column with colored badge
  - UNPAID = amber badge
  - PARTIALLY PAID = blue-ish badge (`#6366f1`)
  - PAID = green badge
- In `AdminShare.tsx`: show current payment status + allow admin to update it via dropdown → calls `PATCH /api/docs/[code]` with `{ payment_status }`
- In `app/portal/[slug]/invoices/page.tsx`: show client-facing payment status badge prominently
- In `SignPage.tsx` Step 2 (invoice): show payment status badge
- `PATCH /api/docs/[code]/route.ts`: accept `payment_status` field in body and update Supabase

### 8. MAGIC LINK AS PRIMARY ACCESS (already partly done)

Current state: magic link auto-auth exists on `/portal/[slug]/page.tsx`.

Remaining:
- In `AdminShare.tsx` email section: the **primary** shared item is the magic link (portal URL with `?mt=TOKEN`), not the code. Reorder the UI:
  1. "Send Magic Link Email" section at top
  2. Portal URL (copy button)
  3. "Access Code (Fallback)" section — smaller, labeled as backup
- The suggested WhatsApp/SMS message must lead with the magic link, code as fallback:
  ```
  Hi [Name]! Your HOS client portal is ready. Access it here: [MAGIC_LINK]
  If that doesn't work, use code [CODE] at hosautomations.com
  ```
- Magic link format: `https://hos-portal-main.vercel.app/portal/{slug}?mt={rawToken}`
- Token security: raw token is 32-byte random hex; SHA-256 hash stored in DB. Token expires after 7 days (add `magic_token_expires_at` column check in portal-session route).

### 9. CLIENT SEARCH (Admin Dashboard)

File: `components/client/AdminList.tsx`

Add a search input at the top of the client list:
- Controlled input, filters client list client-side (no API call needed, data is already loaded)
- Searches: name, company, code, email (case-insensitive)
- Placeholder: "Search clients…"
- Clear button (×) when text is present
- Show "No results for '[query]'" empty state

### 10. EVENT TIMELINE — "OPENED BUT NOT SIGNED" ALERT

Files: `lib/data-access.ts` (logEvent already works), `components/client/EventTimeline.tsx`

The event timeline already exists. Required upgrades:
- In `AdminList.tsx` dashboard table: add a new column or row indicator for docs where:
  - `doc.status === "pending"` AND there is a `viewed` event in `doc_events` → show amber dot + "Viewed" label
  - Tooltip or subtitle: "Opened [X hours ago] — follow up?"
- In `AdminShare.tsx`: EventTimeline at the bottom already exists, but add a highlighted banner at top if doc was viewed but not signed:
  ```
  ⚠ CLIENT VIEWED BUT HASN'T SIGNED
  Last viewed [relative time]. Consider a follow-up.
  ```
  Style: amber background card `rgba(234,179,8,0.06)` + amber border

### 11. ADMIN DASHBOARD METRICS

File: `components/client/AdminList.tsx` (or create `components/client/AdminMetrics.tsx`)

Current: basic metrics bar.

Required metrics (4 tiles, 2×2 on mobile, 4×1 on desktop):
```
Active Clients       | Pending Signatures  | Monthly Revenue     | This Month Collection
(status=signed,      | (status=pending)    | (sum invoice_total  | (sum amount_paid
 not archived)       |                     |  this calendar mo.) |  this calendar mo.)
```
Style: each tile = card with large number in Barlow Condensed 40px + label in 11px MUTED uppercase. Green up-arrow indicator if > 0.

### 12. ADMIN LOGIN — MOBILE

File: `app/page.tsx` (landing page admin panel section)

Current: described as "cooked" on mobile.

Required:
- Max-width 320px, centered with `margin: 0 auto`
- Password input: `font-size: 18px`, `letter-spacing: 8px`, `text-align: center`, `padding: 16px`
- Submit button: full width
- On mobile: no horizontal overflow, no weird layout shift
- The tab toggle (Client | Admin) must be centered and responsive

### 13. REMOVE CALL DURATION TIMER

File: `components/client/AdminForm.tsx`

Find and remove any call-timer or duration field from the admin form. Search for: `call_duration`, `timer`, `duration` — delete the field, its label, and any associated state.

### 14. SIGNATURE PAD MOBILE SIZE

File: `app/client/[code]/sign/SignPage.tsx` + `app/globals.css`

On screens ≤ 600px:
- Signature canvas height must be at least `200px` (currently using `aspect-ratio: 580/160` which is ~160px on mobile)
- Apply `height: 200px !important; aspect-ratio: unset !important;` in the `.sig-canvas-wrapper canvas` mobile rule
- Full-width (edge-to-edge): already done via `margin: 0 -24px`

### 15. PORTAL — ALWAYS-ON AFTER SIGNING

The portal nav tabs (Status, Documents, Invoices, Reports, Campaigns, Support) must always be accessible after the client has a portal session, whether signed or not.

Currently: documents page shows different content based on status — this is correct. But the nav itself should always be visible and all tabs always navigable.

Verify: `app/portal/[slug]/layout.tsx` does NOT redirect signed users away. It should not — confirm the `proxy.ts` middleware only redirects unauthenticated requests, not based on signing status.

### 16. COUNTDOWN TIMER ON DONE PAGE

File: `app/client/[code]/done/DoneCountdown.tsx`

Current: exists, shows countdown, redirects to portal.

Required upgrades:
- Only show countdown if `slug` is set (client has a portal). Otherwise show "You can close this page."
- Copy: "Redirecting to your portal in [N]s…"
- Style: `font-size: 12px`, `color: MUTED`, centered — do not make it prominent

### 17. INVOICE PAGE — PAYMENT LINK

File: `app/portal/[slug]/invoices/page.tsx`

Add a "MAKE PAYMENT" section below the invoice:
- Payment instructions card: "To make a payment, transfer to [bank details] or use the link below."
- Add a `payment_link` field to the `docs` table (run ALTER TABLE in Supabase): `ALTER TABLE docs ADD COLUMN IF NOT EXISTS payment_link TEXT;`
- In `AdminForm.tsx`: add "Payment Link (optional)" field that saves `payment_link`
- In the portal invoices page: if `payment_link` set → show "PAY NOW →" primary button linking to it (new tab)
- Payment status badge: large, prominent — UNPAID in amber, PARTIALLY PAID in indigo, PAID in green

### 18. EMAIL — OFFICIAL FROM ADDRESS

File: `app/api/email-client/route.ts` + `lib/resend.ts`

Verify `RESEND_FROM` env var is `onboarding@hosautomations.com`. The email template must:
- Show the HOS logo (img tag with hosted URL or base64 inline)
- From name: "HOS Automations" (not raw email)
- Subject: "Your HOS Client Portal is Ready"
- Primary CTA: large button "ACCESS MY PORTAL →" → magic link
- Fallback section: "If the button doesn't work, use code **[CODE]** at [URL]"
- Footer: "HOS Automations · Qualified Lead Generation · hosautomations.com"

---

## MOBILE OPTIMIZATION — FULL AUDIT

Run through every page on a 390px-wide viewport (iPhone 15 Pro). Fix:

1. **Landing page**: h1 should be 52px on mobile (not 72px). Tab toggle full-width. Admin panel centered.
2. **Client code entry** (`/client`): code input should be large (48px font), full-width, centered.
3. **Doc view** (`/client/[code]`): header should not overflow. Invoice table must scroll horizontally if needed (`overflow-x: auto`).
4. **Sign flow** (`/client/[code]/sign`): stepper dots must not overflow (reduce to 28px on mobile). Agreement text readable (14px min). Signature pad 200px tall, edge-to-edge. Trust box stacks vertically. Credibility section condenses to 2-column grid. SIGN button full-width.
5. **Done page**: social proof grid → `grid-template-columns: 1fr` on mobile.
6. **Portal layout**: nav scrolls horizontally (already done). Header: client name truncates with ellipsis on mobile. Status badge wraps below name.
7. **Portal status**: tracker steps must not overflow on 320px screens.
8. **Admin dashboard**: metrics 2×2 grid on mobile (already partially done). Table: hide "Code" and "Amount" columns on mobile. Keep: Name, Status, Payment, Actions.
9. **Admin form**: no horizontal scroll. All inputs full-width. Date picker usable.
10. **Admin share**: code display (52px mono) may overflow — wrap or reduce size on mobile.

CSS class naming convention for responsive overrides:
```
.landing-h1          ← h1 on landing
.admin-metrics-grid  ← metrics 4-tile grid  
.admin-table-code    ← code column (hide on mobile)
.admin-table-amount  ← amount column (hide on mobile)
.social-proof-grid   ← 3-column social proof
.sig-canvas-wrapper  ← signature pad wrapper
.sign-stepper-label  ← stepper text labels
.portal-nav-scroll   ← portal tab nav
```

All these classes already have mobile rules in `app/globals.css`. Audit that the classes are actually applied to the corresponding elements.

---

## ANIMATIONS — REQUIRED LIST

Add these animations (CSS keyframes in `globals.css`, apply inline via `animation:` style prop):

| Component | Animation |
|---|---|
| Landing page load | `fadeIn 300ms ease-out` staggered per element |
| Panel switch (Client↔Admin) | `fadeIn 180ms ease-out` |
| Step advance in signing | `slideUp 200ms ease-out` for incoming step content |
| Animated checklist (done page) | Each `✓` item: `fadeIn 200ms ease-out` + `delay: 0, 200, 400ms` |
| Confirmation circle ✓ | `scaleIn` from `scale(0)` to `scale(1)` in 400ms with spring bounce |
| Status tracker steps | Staggered reveal: `delay: i * 80ms` |
| Toast notifications | Already handled by Sonner |
| Confetti | Canvas animation (see §4 above) |
| Portal tab switch | `fadeIn 150ms ease-out` on page content |
| Button loading state | `spin` on Loader2 icon |

New keyframes to add in `globals.css`:
```css
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.6); }
  to   { opacity: 1; transform: scale(1);   }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes checkStrike {
  from { width: 0; }
  to   { width: 100%; }
}
```

---

## FILE-BY-FILE TASK LIST

### Priority 1 — Visible to client, must ship first:

- [ ] `app/client/[code]/sign/SignPage.tsx` — full premium rewrite (§3)
- [ ] `components/client/ConfettiExplosion.tsx` — premium particles (§4)
- [ ] `app/client/[code]/done/page.tsx` — animated checklist, better copy (§5)
- [ ] `components/client/TrustBox.tsx` — verify content matches §3 exactly
- [ ] `app/globals.css` — add scaleIn, slideUp, checkStrike keyframes; audit mobile classes (§Animations, §Mobile)
- [ ] `app/client/[code]/page.tsx` — add ProgressBanner (§6)
- [ ] `app/portal/[slug]/status/page.tsx` — add ProgressBanner (§6)

### Priority 2 — Admin UX:

- [ ] `components/client/AdminList.tsx` — search (§9), metrics (§11), "viewed not signed" indicator (§10), payment column (§7)
- [ ] `components/client/AdminShare.tsx` — payment status update (§7), magic link as primary (§8), "viewed not signed" banner (§10)
- [ ] `components/client/AdminForm.tsx` — remove call timer (§13), add payment_link field (§17)
- [ ] `app/page.tsx` — admin login mobile fix (§12)

### Priority 3 — Portal + features:

- [ ] `app/portal/[slug]/invoices/page.tsx` — payment status badge + payment link (§17)
- [ ] `app/api/docs/[code]/route.ts` — accept `payment_status` + `payment_link` in PATCH
- [ ] `app/api/email-client/route.ts` — official from address, magic link primary (§18)
- [ ] `public/hos-logo.svg` — create SVG logo mark (§1)
- [ ] Update header components to include logo: landing, admin top bar, portal top bar (§1)

### Priority 4 — Security + DB:

- [ ] `app/api/portal-session/route.ts` — add `magic_token_expires_at` expiry check
- [ ] Supabase: `ALTER TABLE docs ADD COLUMN IF NOT EXISTS payment_link TEXT;`
- [ ] Supabase: `ALTER TABLE docs ADD COLUMN IF NOT EXISTS magic_token_expires_at TIMESTAMPTZ;`
- [ ] `app/api/email-client/route.ts` — set `magic_token_expires_at = NOW() + INTERVAL '7 days'` when generating token

---

## COPY GUIDELINES — EVERY STRING MUST FEEL PREMIUM

Bad copy examples (currently in codebase): "Takes 2 minutes", "Review & Sign", "Access My Documents"

Good copy (replace with):

| Context | Current (bad) | Premium (use this) |
|---|---|---|
| Sign CTA | "REVIEW & SIGN →" | "REVIEW YOUR AGREEMENT →" |
| Done headline | "WELCOME TO HOS." | "YOU'RE IN." or "WELCOME TO HOS." (keep) |
| Portal entry | "ACCESS MY PORTAL →" | "ENTER MY PORTAL →" |
| Code fallback label | "Access Code (Fallback)" | "Backup Access Code" |
| Loading | "Loading…" | "OPENING YOUR PORTAL…" |
| Email send button | "Send →" | "SEND PORTAL ACCESS →" |
| Client list empty | "No documents" | "No clients yet — create your first above." |
| Pending status | "pending" | "AWAITING SIGNATURE" |
| Signed status | "signed" | "ACTIVE" |

---

## HOW TO RESUME

1. Open a new Claude Code session
2. Navigate to: `c:\Users\umara\Desktop\hos\Tools\hos-portal-main\hos-portal-main`
3. Paste this entire file as the first message
4. Say: "Implement Priority 1 items first, then 2, 3, 4. Deploy after each priority batch."
5. The agent will read current file state first before editing (all files are enumerated above).
6. Deploy command: `vercel --prod --yes` (run from the working directory)

---

## QUICK DIAGNOSTIC COMMANDS

```bash
# Check TypeScript
npx tsc --noEmit

# Build locally
npm run build

# Deploy
vercel --prod --yes

# Check Vercel env vars
vercel env ls

# View recent deployment logs
vercel logs https://hos-portal-main.vercel.app
```

---

*Last updated: 2026-06-06. Live URL: https://hos-portal-main.vercel.app*
