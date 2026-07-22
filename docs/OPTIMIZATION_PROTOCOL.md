# HOS Portal — A→Z Optimization Protocol

> A living audit across every element, feature, and flow. Lens = **make it fast,
> correct, reliable, and invisible.** Complements `UX_PSYCHOLOGY_REPORT.md`
> (emotion) and `COMMS_AND_UX_PLAN.md` (comms feature build).
>
> Method per surface: measure → fix highest-impact → verify → deploy → next.
> `[x]` done · `[~]` in progress · `[ ]` queued.

---

## 1. Performance (render, network, media)

- [x] **Call clock re-rendered the whole call tree every second** → isolated a
  self-ticking `<CallTimer>`; `useCall` holds no per-second state. Video tiles stay
  stable mid-call.
- [x] **Video "blink"** — tile CSS `animation` swapped between entrance-fade and
  speaking-glow on every VAD toggle, re-playing the fade. Entrance now runs once;
  speaking is a smooth border/box-shadow transition.
- [x] **Upload path** — client-side image compression (avatars 512px, chat 1600px)
  so uploads never hit Vercel's ~4.5 MB body limit; defensive response parsing.
- [x] **CountUp** guarded against throttled rAF (never freezes at $0).
- [x] Chat polling already pauses when tab hidden (SWR `refreshWhenHidden:false`);
  presence + unread polls already gate on `visibilityState`.
- [ ] **Memoize media leaf components** (`StreamVideo`, tiles) with `React.memo` so
  a speaking-state change on one participant doesn't re-render the other's `<video>`.
- [ ] **Split `useCall`** selector surface so consumers subscribe only to what they
  use (e.g. controls don't re-render on `remoteSpeaking`).
- [ ] **Adaptive media by device/network**: lower capture + simulcast ceiling on
  weak CPU / poor `ConnectionQuality`; cap camera FPS when a screen share is active.
- [ ] **Route-level**: audit server components for redundant Supabase reads per
  navigation; add `revalidate`/cache where data is not per-request.
- [ ] **Bundle**: check for heavy client components that could be server components;
  lazy-load the call stack (LiveKit) only when a call starts.
- [ ] **Images**: serve avatars/attachments through `next/image` or width hints.

## 2. Correctness / edge cases

- [ ] Refresh-during-call recovery (sessionStorage flag → offer rejoin).
- [ ] Dedup: if `IncomingCallListener` opened the overlay, don't double-mount call UI.
- [ ] Decline path writes a proper missed-call row on both sides.
- [ ] Double-submit guards on every mutating action (sign, pay link, uploads).
- [ ] Timezone/date consistency across dashboard, invoices, reports.

## 3. Reliability

- [x] Ringing via real LiveKit presence (not flaky push).
- [x] Screen-share stop synced via `LocalTrackUnpublished`.
- [ ] Global error boundaries per route with a branded retry (some exist — audit all).
- [ ] Network-drop UX: explicit "reconnecting" everywhere media/data is live.
- [ ] Rate-limit + abuse review on every public `/api/*` (some done; audit rest).

## 4. UX polish / consistency (see psychology report for the "why")

- [x] Discord-grade comms (stage, devices, typing, ringing, HD).
- [x] Dashboard: daily-read insights, ownership framing, status chip, count-ups,
  stagger; "You're in." ceremony; dashboard-shaped skeleton.
- [x] Emoji purge (📄🧾📞 → SVG); pictorial emojis gone.
- [ ] Shared primitive set (`Button`/`Card`/`Field`/`Badge`/`EmptyState`/`Icon`) to
  kill ad-hoc inline styles and the remaining ✓-glyph inconsistency.
- [ ] Motion pass on admin surfaces (row hover, transitions, press states).
- [ ] Admin roster: presence dot + unread + last-message preview.

## 5. Accessibility

- [ ] Focus states + keyboard nav on all controls (call bar, pickers, nav).
- [ ] `aria-label`s on icon-only buttons (mostly present — audit).
- [ ] Reduced-motion honored everywhere (CountUp + stagger done; audit call anims).
- [ ] Color-contrast check on MUTED/SUBTLE text over dark surfaces.

## 6. Security / data

- [ ] CSRF/origin checks on mutating `/api/*`.
- [ ] Confirm service-role key never reaches the client; audit `NEXT_PUBLIC_*`.
- [ ] Signed URLs / bucket policy review for attachments + avatars.

---

## Suggested drive order (highest impact first)
1. **Media memoization + `useCall` selector split** (smoothest calls on weak devices)
2. **Adaptive media by network/device** (quality without jank)
3. **Shared primitive set + ✓ sweep** (consistency at scale)
4. **Correctness edges** (refresh-during-call, dedup, double-submit)
5. **Admin roster + admin motion**
6. **Accessibility + security audits**

Each item ships as its own verified commit.
