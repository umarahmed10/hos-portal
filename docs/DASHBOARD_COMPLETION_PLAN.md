# Dashboard Completion Plan — 100% End-to-End

> Full scan of every admin + client surface (2026-07-24). Verdict per surface,
> what's missing, and the execution order. `[x]` shipped · `[~]` partial · `[ ]` queued.
> Companion docs: `UX_PSYCHOLOGY_REPORT.md` (emotion), `OPTIMIZATION_PROTOCOL.md`
> (tech), `COMMS_AND_UX_PLAN.md` (comms build).

---

## The Discord lesson (user's reference screenshot)

Discord's DM screen is **three earning zones**: nav rail (roster), conversation,
and a **right profile panel** (identity, mutuals, member-since). Nothing is dead
space; every zone answers a question you might have about *this relationship*.
Our client comms was ONE zone (chat) stretched across the screen = bland.
Rule adopted: **wide screens get a context rail** — identity + campaign state +
quick actions — so the screen always has something worth looking at.

---

## CLIENT SIDE — scan verdicts

| Surface | Verdict | Gap |
|---|---|---|
| Portal entry / "You're in." | ✅ Strong | — (once-per-device ceremony shipped) |
| Status tab | ✅ Strong | — |
| **Dashboard** | ✅ Strong | daily-read, ownership, ROI hero, count-ups shipped |
| **Performance (Calls)** | ~ Good | has daily list; **no visual trend** → add 14-day bars |
| **Reports** | ❌ Placeholder | "Coming Soon" + fake "—" grid → build **weekly rollups from daily_metrics** |
| Invoices / Billing | ✅ OK | PayButton router shipped |
| Documents | ✅ OK | — |
| Support | ✅ OK | — |
| **Comms page** | ❌ Bland | single column → **Discord-style right side panel**: HOS profile card, campaign snapshot, quick actions, shared files |

## ADMIN SIDE — scan verdicts

| Surface | Verdict | Gap |
|---|---|---|
| Dashboard | ✅ Strong | KPIs, journey tracker, settings gear, CSV import all shipped |
| Stats page | ✅ Strong | CSV import + daily entry |
| New/Edit/Share | ✅ OK | — |
| **Comms roster** | ~ Basic | name+code only → **unread badges, last-message preview, sort by activity** (Discord DM list) |
| Comms workspace | ✅ Strong | stage, settings popup, call panel shipped |

---

## Execution (this pass)

1. **[x] Client comms side panel** — `CommsSidePanel`: HOS Team profile card
   (avatar, online, tagline), campaign snapshot (status + calls/qualified/jobs
   from the real doc), quick links (Dashboard/Billing/Support), recent shared
   files (parsed from attachment messages). Hidden <1000px and during calls.
2. **[x] Admin roster upgrade** — `/api/comms/roster` (admin-only; single pass:
   last message per client + unread-from-client counts) + AdminCommsUI list
   with unread badges, previews, activity sort, 30s refresh.
3. **[x] Reports tab** — real weekly summaries (ISO-week rollups of
   daily_metrics: calls, qualified, spend, cost/qual) when data exists; honest
   dated empty state otherwise. Fake "—" grid deleted.
4. **[x] Performance trend** — 14-day CSS bar chart (total vs qualified) above
   the daily breakdown.

## Remaining to "100%" (needs input or infra — deliberately not built blind)

- [ ] **Automated ingestion** (Google Ads API + CallRail webhook) — blocked on
  credentials/vendor activation; CSV import is the bridge.
- [ ] **Real week-over-week trend claims** in daily-read — unlocked once daily
  data flows consistently (CSV import makes this possible NOW via habit).
- [ ] **Milestone ceremonies** (first booked job, first ROI-positive month) —
  needs the daily/history data above.
- [ ] **Tests + CI** — last self-contained hardening item.
- [ ] **Admin presence** (client "online" dot from portal activity) — needs a
  lightweight last-seen ping; queued.
