# HOS Comms → Discord Parity + Platform UX Upgrade

> Goal: make HOS Comms *feel* exactly like Discord's 1:1 DM calling (interaction
> quality, not a visual clone), and lift the whole portal + admin UX to match.
> Stack: Next.js 16 + React 19, LiveKit (WebRTC SFU), Supabase, Web Push/VAPID.

---

## 0. What we take from the Discord reports vs. what we skip

The reports describe Discord's **backend infrastructure** and its **UX layer**. We
already get the infrastructure for free from LiveKit, so we only build the UX.

**Already handled by LiveKit — do NOT rebuild:**
- SFU media routing, RTP forwarding, RTCP bandwidth adaptation
- ICE/DTLS/SRTP, UDP transport, NAT traversal, TURN relay
- Opus codec, packet-loss concealment, jitter buffering
- Reconnect / SFU failover (LiveKit `Reconnecting`/`Reconnected` events)
- Simulcast layers, adaptive resolution/FPS/bitrate

**Skip entirely (not relevant to a 2-person B2B tool):**
- DAVE / E2EE, Cloudflare edge, push-to-talk, Krisp, game/system audio capture,
  pop-out OS windows, multi-guild presence, virtual cameras, mobile-native engine

**Adopt from Discord (the UX layer = our actual work):**
- Call **stage** layout (media dominant, chat as side rail) + **call bar**
- Video/screenshare **tile system**: spotlight + thumbnail strip, speaking rings,
  name tags, mute/stream badges, "Streaming" label
- **Fullscreen** with auto-hiding floating controls (have this; refine)
- **Device pipeline**: mic/camera/speaker selectors, camera preview pre-join,
  NS/EC/AGC toggles (getUserMedia constraints), `setSinkId` output routing
- **Connection state machine** surfaced in UI: Idle → Calling → RTC Connecting →
  Connected → Reconnecting → Disconnected/Missed, with the right labels/spinners
- **Ringing UX**: caller "Calling…" pulsing avatar; callee incoming sheet
- **Speaking detection** green ring (LiveKit `ActiveSpeakersChanged` + audio level)
- **Typing indicators**, unread separators, hover controls + tooltips
- Per-participant **volume** (have) + **device** control surfaces

---

## PART A — Comms → Discord parity

### Phase A1 — The Call Stage (highest impact) ⭐
The #1 complaint: "video call and screenshare is nothing like Discord."
Rebuild the call from stacked panels into a **stage**.

- New `CallStage` layout that takes over the comms main area when in a call:
  - **Spotlight**: active screenshare (or focused camera) fills the stage,
    letterboxed on black (`object-fit: contain`).
  - **Thumbnail strip**: the other party's camera + your self-view as small
    16:9 tiles, bottom-center (Discord) — speaking ring, name tag, mute badge.
  - **Chat becomes a right rail** (collapsible, ~360px) instead of stacked below.
- **Call bar** (Discord DM header): slim bar above chat when *not* on the stage —
  avatars + call duration + mute/cam/screen/leave. Clicking expands to stage.
- Admin + client share the same `CallStage`; admin keeps the client sidebar.
- Files: new `CallStage.tsx`, `CallControlBar.tsx`, `ParticipantTile` refactor;
  rework `AdminCommsUI`, `ClientCommsUI`, `CommsCallOverlay` to host the stage.

### Phase A2 — Device & media pipeline
- `DeviceSettings` panel (gear): mic / camera / speaker (`setSinkId`) selectors
  via `enumerateDevices`; live level meter; NS/EC/AGC toggles as getUserMedia
  constraints; persist choices to localStorage.
- **Camera preview + mic check before joining** (Discord "Test Video"): a
  pre-join card so clients aren't dumped straight into a live call.
- Camera/mic **switching mid-call** (re-`getUserMedia` + `replaceTrack`).

### Phase A3 — State machine + status surfacing
- Explicit call states with Discord labels: "Calling…", "RTC Connecting",
  "Voice Connected", "Reconnecting", "No route / connection failed", plus
  spinners in empty tiles ("Waiting for video…").
- Permission-blocked state: inline "Camera blocked in browser settings" guidance
  instead of a silent failure (map `getUserMedia` rejection reasons).
- Tab-hidden handling: pause self-view render when hidden, resume on focus.

### Phase A4 — Presence & real-time chat polish
- **Typing indicators** ("HOS is typing…") over the LiveKit data channel (+ a
  Supabase fallback ping when not in a call).
- Speaking ring driven by `ActiveSpeakersChanged` **and** audio-level amplitude.
- Unread **divider** ("New messages") + jump-to-latest, like Discord.
- Sound cue pass: distinct, subtle cues for join/leave/mute/deafen/incoming that
  match Discord's timing (mostly done — audit + de-dupe).

### Phase A5 — Ringing / missed-call completeness
- Caller "Calling {name}…" state with pulsing avatar + cancel (have partial).
- Missed-call + "call ended, lasted X" rows already done — verify all paths.
- Decline path from `IncomingCallModal` writes a missed-call row.

### Phase A6 — Reliability & edge cases
- Refresh-during-call recovery (sessionStorage flag → offer rejoin).
- Dedup: if `IncomingCallListener` opened the overlay, don't double-mount on the
  comms page.
- Solo auto-timeout (have, 3 min) + "you're the only one here" empty state.

---

## PART B — Platform-wide UX upgrade (portal + admin)

### Phase B1 — Design-system consolidation
- Audit `lib/styles.ts` tokens against the HOS brand skill (matte black #111,
  bone white #F3F1EC, bronze #8B6B3E ≤5%, Cormorant/Space Grotesk/DM Sans/DM Mono).
- Kill remaining emojis (📄 🧾 etc. in client doc page) → brand SVG icons.
- One shared primitives set: `Button`, `Card`, `Field`, `Badge`, `Toast`,
  `EmptyState`, `Skeleton`, `Spinner`, `Divider` — replace ad-hoc inline styles.

### Phase B2 — Loading / empty / error states everywhere
- Skeleton loaders for portal tabs (dashboard, performance, reports, invoices).
- Branded empty states (no data yet) instead of blank panes.
- Consistent error boundaries with retry.

### Phase B3 — Motion & micro-interactions
- Page/tab transitions, staggered card entrances, button press states, hover
  affordances + tooltips — Discord-grade "invisible" smoothness, on brand.

### Phase B4 — Portal flow polish
- "You're in." shows once per device ✅ (done).
- Onboarding progress: signature → payment → live, with clearer state art.
- Mobile pass: nav, tables, video tiles, chat input (keyboard-safe).

### Phase B5 — Admin surface polish
- Dashboard: bronze comms icon ✅ (done); consistent KPI cards (Space Grotesk
  600, -0.035em), status chips, row hover, quick actions.
- Comms admin: adopt the A1 stage; client list = Discord DM list (avatar,
  presence dot, unread badge, last-message preview).

---

## Prioritized execution order

1. **A1 Call Stage** ⭐ (the specific complaint) — start here
2. A3 State machine + status labels (cheap, high polish)
3. A2 Device pipeline + pre-join preview
4. A4 Typing + presence + unread divider
5. B1 Design system + emoji purge
6. B2 Loading/empty/error states
7. A5 / A6 ringing + reliability edges
8. B3 / B4 / B5 motion + portal + admin polish

Each phase = one reviewable commit, deployed and verified before the next.

---

## Known constraints (honest)
- I can't type the admin password into the login form (safety rule), so admin-only
  call UI needs the user's eyes for final verification; client side I verify directly.
- 2-party live call behavior (speaking rings, quality, stage with real streams)
  can't be simulated solo — user runs one live call per phase to confirm.
- No new Supabase migrations unless required; prefer localStorage/data-channel.
