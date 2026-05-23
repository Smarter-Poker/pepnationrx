# PepNationRX Build Roadmap

Comprehensive build-and-test plan for closing every gap in
`competitive-analysis-gaps.md` and `gap-closure-backlog.md`. Seventeen features
across four build phases. This document is the execution contract: each feature
lists its scope, the layers it touches, and how it is verified.

Prepared: 2026-05-23.

---

## Build Order And Rationale

The order is chosen so that foundational capabilities land before the features
that depend on them, revenue levers land before heavy clinical integrations,
and growth work lands last.

1. **Phase 1 - Patient Experience Core.** Notifications, self-service, messaging,
   insurance. Every competitor has these; PepNationRX has none. Notifications
   are first because messaging and check-ins depend on them.
2. **Phase 2 - Commercial And Access.** Membership, coupons, HSA/FSA. Revenue
   levers, lower effort, no external clinical integration.
3. **Phase 3 - Care Delivery Expansion.** Provider profiles, video visits, labs,
   acute care, pediatrics. The heaviest clinical and integration tier.
4. **Phase 4 - Growth And Reach.** Content/SEO, PWA, oral GLP-1, family
   accounts, retail pickup.

---

## Standing Conventions

Every feature follows the existing architecture: Node/Express (CommonJS)
backend, vanilla-JS Web Components frontend, PostgreSQL on Supabase, deployed to
the Hetzner server behind nginx. No React. No emojis. Title Case for all
user-facing text. Each schema change is a new sequential migration
(`00NN_*.sql`) applied to the live project `cupnhfdwveouenutnveg`.

### Per-feature verification (the test plan for every item)

1. **Schema:** migration applied to live Supabase; row counts and constraints
   verified with a follow-up query.
2. **Unit tests:** new `tests/unit/*.test.js` files using `node:test`, run with
   the existing harness; the full suite must stay green.
3. **Backend:** `node --check` on every changed file; server boots clean.
4. **Frontend:** `node --check` on every changed component; catalog/data files
   parsed and asserted.
5. **Deploy:** files shipped to `/opt/pepnationrx`; service restarted; live
   `curl` checks confirm the endpoint or page responds.
6. **Compliance scan:** emoji scan and Title Case scan on all changed files.
7. **Push:** migration plus code pushed to GitHub `main`; blob SHAs verified
   byte-exact.

### Phase-level verification

After each phase: full unit suite, a cross-feature integration walkthrough
(register, intake, checkout, the phase's new flows), and a live smoke test.

---

## Phase 1 - Patient Experience Core

### 1. Patient Notifications (P1-1)

Wire a transactional email service and a notification log so patients are told
about every event that affects them.

- **Schema:** `notifications` table (id, user_id, channel, template, subject,
  payload, status, sent_at, error). A `notification_preferences` table for
  per-channel opt-in.
- **Service:** `services/notification` - a provider adapter (transactional
  email first; SMS adapter stubbed for a later pass), template rendering, a
  `send()` that writes a `notifications` row and dispatches.
- **Wiring:** prescription signed, pharmacy tracking update, billing renewal,
  check-in due, subscription change. The refill-reminders job sends the
  check-in notice.
- **Frontend:** a notification-preferences panel on the patient dashboard.
- **Tests:** template render, send success and failure paths, preference
  gating, idempotency (no duplicate send per event).

### 2. Self-Service Subscription Management (P1-2)

Make the patient dashboard writable.

- **Schema:** `subscription_events` table (pause, resume, cancel, plan change)
  for an auditable history; subscription status enum extended with `paused`.
- **Routes:** `PATCH /api/patient/subscriptions/:id` (pause, resume, cancel,
  change plan), `PUT /api/patient/shipping-address`,
  `PUT /api/patient/payment-method`.
- **Logic:** subscription model methods plus the matching Stripe subscription
  updates; cancellation respects the active prescription window.
- **Frontend:** action controls on the patient dashboard subscription cards.
- **Tests:** each state transition, illegal transitions rejected, Stripe sync,
  address and payment validation.

### 3. Patient-To-Provider Messaging (P1-3)

An ongoing secure care-team thread.

- **Schema:** `message_threads` (one per patient care relationship) and
  `messages` (thread_id, sender_role, body encrypted, read_at).
- **Routes:** list threads, read a thread, post a message; provider-side
  endpoints behind the provider role.
- **Frontend:** a `pnrx-message-thread` Web Component on the dashboard.
- **Wiring:** a new message triggers a notification (depends on feature 1).
- **Tests:** post and read, role authorization, PHI encryption at rest,
  unread-count accuracy, notification trigger.

### 4. Insurance Eligibility And Concierge (P1-4)

The biggest weight-loss conversion lever.

- **Schema:** `insurance_policies` (carrier, member id, group, plan) and
  `insurance_eligibility_checks` (status, coverage result, concierge_state).
- **Service:** `services/insurance` - an eligibility adapter (real benefits API
  behind an interface; a deterministic stub for test and pre-integration use),
  plus a manual concierge workflow queue for the assisted path.
- **Routes:** submit a policy, run a self-service check, request concierge.
- **Frontend:** a `pnrx-insurance-checker` component in the weight-loss funnel.
- **Tests:** eligibility adapter contract, concierge state machine, funnel
  routing (self-service then concierge), no PHI leakage.

---

## Phase 2 - Commercial And Access

### 5. Membership Tier - PepNationRX Plus (P2-3)

A recurring membership that bundles perks.

- **Schema:** `memberships` (user_id, tier, status, started_at, renews_at) and
  `membership_perks` reference data.
- **Logic:** discounted visit and plan pricing, priority review flag, free or
  discounted labs once feature 10 lands.
- **Routes:** enroll, cancel, read membership; checkout applies member pricing.
- **Frontend:** a membership card and an upsell on checkout.
- **Tests:** enroll and cancel, member-price resolution at checkout, renewal.

### 6. Discount And Coupon Mechanism (P2-7)

- **Schema:** `coupons` (code, type percent or fixed, value, max_redemptions,
  expires_at, active) and `coupon_redemptions` (coupon_id, user_id,
  transaction_id).
- **Logic:** redeem at checkout with server-side validation; the management
  fee and split recompute against the discounted gross.
- **Routes:** validate a code, admin CRUD for coupons.
- **Frontend:** a coupon field on checkout; an admin coupon panel.
- **Tests:** valid and invalid codes, expiry, redemption caps, split math on a
  discounted gross, one-redemption-per-user enforcement.

### 7. HSA / FSA Support And Superbills (P2-6)

- **Schema:** `superbills` (transaction_id, pdf_path, generated_at).
- **Logic:** Stripe configured to accept HSA/FSA cards with the correct
  merchant category; a superbill PDF generated per paid transaction.
- **Routes:** request and download a superbill.
- **Frontend:** a superbill download on the billing section of the dashboard.
- **Tests:** superbill generation, line-item accuracy, access control (a
  patient sees only their own).

---

## Phase 3 - Care Delivery Expansion

### 8. Provider Profiles And Continuity (P3-1)

- **Schema:** extend `provider` (display name, credentials, bio, photo,
  states licensed); `patient_provider` continuity link.
- **Routes:** read the assigned provider; admin provider management.
- **Frontend:** a provider card on the dashboard and the intake confirmation.
- **Tests:** assignment continuity, licensed-state match, profile read.

### 9. Live Video Visit Path (P2-4)

- **Schema:** `video_visits` (subscription_id, provider_id, scheduled_at,
  room_url, status).
- **Service:** a video provider adapter (interface plus stub) issuing room
  URLs; used at least for states that require a synchronous visit.
- **Routes:** schedule, join, complete a visit.
- **Frontend:** a `pnrx-video-visit` scheduling and join component.
- **Tests:** scheduling, sync-required-state routing, status transitions.

### 10. Lab Ordering And Results (P2-2)

- **Schema:** `lab_orders` (patient, panel, status, requisition) and
  `lab_results` (order_id, result payload encrypted, released_at).
- **Service:** a Quest/Labcorp adapter (interface plus stub) for order
  placement, requisition, and results retrieval.
- **Routes:** order a panel, read results.
- **Frontend:** lab ordering and a results view on the dashboard.
- **Tests:** order placement, requisition generation, results delivery and
  encryption, release gating.

### 11. Acute / Urgent Care Line (P3-3)

- **Schema:** new triage protocols for UTI, flu, and minor infections;
  catalog category and treatments.
- **Logic:** new branching protocols with disqualifying answers and escalation.
- **Frontend:** the new protocols flow through the existing triage component.
- **Tests:** protocol branching, disqualification, escalation routing.

### 12. Pediatric Care (P3-6)

- **Schema:** a guardian relationship; triage age gate updated to allow minors
  on pediatric protocols only.
- **Logic:** guardian consent capture; pediatric protocol scoping.
- **Tests:** age gating, guardian consent required, scope enforcement.

---

## Phase 4 - Growth And Reach

### 13. Content And SEO Layer (P2-5)

- **Schema:** `content_articles` (slug, title, body, category, published_at,
  meta) - a lightweight CMS.
- **Routes:** list and read articles; admin authoring.
- **Frontend:** per-condition landing pages and an article reader; sitemap and
  meta tags.
- **Tests:** publish and read, slug routing, sitemap generation.

### 14. PWA / Installable Mobile (P2-1)

- **Frontend:** a web app manifest, a service worker for offline shell and
  caching, install prompts, icons.
- **Tests:** manifest validity, service-worker registration, offline shell
  loads, Lighthouse PWA pass.

### 15. Oral GLP-1 SKU (P3-2)

- **Schema:** add oral semaglutide catalog entries and plans (a small catalog
  migration in the established pattern).
- **Tests:** catalog parse, checkout price resolution.

### 16. Family / Shared Accounts (P3-4)

- **Schema:** `account_groups` and `account_members` linking up to several
  adults under one membership.
- **Routes:** invite, accept, manage members.
- **Frontend:** a household management panel.
- **Tests:** invite and accept, per-member isolation of PHI, shared membership
  pricing.

### 17. Retail In-Store Pickup Fulfillment (P3-5)

- **Schema:** a `fulfillment_method` on the order (mail-order or retail
  pickup); a partner-pharmacy locator table.
- **Logic:** route the pharmacy order by chosen fulfillment method.
- **Frontend:** a fulfillment choice at checkout.
- **Tests:** method selection, pharmacy routing per method.

---

## Final Integration And Release Gate

After Phase 4: the full unit suite green; an end-to-end walkthrough covering
registration, intake, insurance check, checkout with a coupon and membership,
messaging, a video visit, a lab order, and self-service subscription changes;
a live smoke test of every new route; a final emoji and Title Case scan; and a
consolidated release note. Each phase is pushed to GitHub and deployed as it
completes, so `main` and the live server never diverge by more than one phase.
