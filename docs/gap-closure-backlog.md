# PepNationRX Gap-Closure Backlog

Companion to `competitive-analysis-gaps.md`. Every gap from that report, ranked
by impact against effort. Effort scale: S = days, M = 1-2 weeks, L = multi-week,
XL = multi-month or heavily dependent on an external partner.

Priority tiers: P0 = do now (regulatory or revenue-critical), P1 = high impact
and foundational, P2 = medium, P3 = strategic / later.

---

## P0 - Do Now

### P0-1. Migrate compounded GLP-1 to branded
Gap report 4.2. The catalog sells semaglutide and tirzepatide as `compounded`.
After the 2026 Novo Nordisk and Eli Lilly settlements the industry moved to
branded GLP-1s; continuing to sell compounded carries live regulatory and
legal exposure.
- Code effort: S. The catalog change (compound type, naming, pricing, the
  0003 seed, and the live DB rows) is small.
- Real blocker: commercial - securing a branded-supply or authorized-
  distribution path, or a 503A relationship that is still compliant. This is
  a business decision, not a code task; the code follows the decision.
- Action: decide the supply path first, then I update the catalog data,
  migration, and live DB to match.

---

## P1 - High Impact, Foundational

### P1-1. Patient notification channel (email, then SMS)
Gap report 4.3. No email or SMS service is wired. Patients are never told of a
prescription decision, a shipment, an upcoming renewal, or a due check-in. This
blocks almost every other patient-facing improvement.
- Effort: M. Add a notification service (transactional email provider), wire
  it into the existing events: prescription signed, pharmacy tracking update,
  billing renewal, and the refill-reminders job's new check-ins.

### P1-2. Patient self-service subscription management
Gap report 4.3. `patient.routes` is `GET /dashboard` only. Add endpoints to
pause, cancel, and change a subscription, and to update the shipping address
and payment method. Every competitor offers this; today it forces a support
contact.
- Effort: M. New routes, controller, and subscription model methods, plus the
  Stripe subscription updates.

### P1-3. Patient-to-provider messaging / care team thread
Gap report 4.3. Hims, Ro, and PlushCare build the experience around an
ongoing secure message thread. PepNationRX has none.
- Effort: L. New messages table, endpoints, a frontend thread component, and
  notification hooks (depends on P1-1).

### P1-4. Insurance eligibility and concierge for GLP-1
Gap report 4.4. No insurance handling at all. For weight loss this is the
single biggest conversion lever - Ro's free Insurance Checker and concierge
are central to its funnel.
- Effort: L to XL, integration-heavy (an eligibility or benefits API, plus a
  manual concierge workflow for the assisted path).
- Sequence: ship the self-service eligibility checker first, the concierge
  workflow second.

---

## P2 - Medium

### P2-1. Mobile presence
Gap report 4.3. No native app. A full native build is XL. Recommended bridge:
ship an installable PWA over the existing Web Components first (effort M),
then evaluate native once retention justifies it.

### P2-2. Lab ordering and results
Gap report 4.5. The "primary-care" catalog category lists lab panels as
products but there is no integration. Add a Quest or Labcorp integration:
order placement, requisition, and results delivery to the patient dashboard.
- Effort: L.

### P2-3. Membership tier ("PepNationRX Plus")
Gap report 4.4. Competitors all sell a recurring membership that bundles perks
and smooths pricing. Add a membership product (discounted visits, free or
discounted labs once P2-2 lands, priority review).
- Effort: M.

### P2-4. Live video visit path
Gap report 4.1. Async-only today. Sync-required states currently depend
entirely on the medical network. Add a native video option (an embedded
visit), at least for the states that require it.
- Effort: L.

### P2-5. Content and SEO layer
Gap report 4.3. No condition library or blog, so little organic acquisition.
Add a lightweight CMS-backed content section and per-condition landing pages.
- Effort: M to L, and ongoing.

### P2-6. HSA / FSA support and superbills
Gap report 4.4. Accept HSA and FSA cards (largely a Stripe configuration plus
correct merchant category handling) and generate a superbill PDF a patient can
submit for reimbursement.
- Effort: M.

### P2-7. Discount and coupon mechanism
Gap report 4.4. No promo capability. Add coupon codes redeemable at checkout
and an optional Rx discount-card style perk for the membership tier.
- Effort: M.

---

## P3 - Strategic / Later

### P3-1. Provider profiles and continuity
Gap report 4.1. Surface a named, consistent provider per patient rather than
an opaque "independent licensed clinician." Effort: M.

### P3-2. Oral GLP-1 SKU
Gap report 4.2. Add an oral GLP-1 once P0-1 settles the supply path. Code
effort S; gated on supply.

### P3-3. Acute / urgent care line
Gap report 4.1. New triage protocols and clinical scope for UTIs, flu, and
infections - the highest-frequency, lowest-cost entry visit. Effort: L, and a
clinical-scope decision.

### P3-4. Family / shared accounts
Gap report 4.4. One membership across multiple adults, as PlushCare does.
Effort: M.

### P3-5. Retail in-store pickup fulfillment
Gap report 4.4. A second fulfillment path beyond mail-order cold-chain.
Effort: L.

### P3-6. Pediatric care
Gap report 4.1. Triage currently disqualifies under-18. Adding pediatrics is a
clinical and compliance expansion. Effort: L.

---

## Recommended Sequencing

1. Resolve P0-1 (branded GLP-1) - it is regulatory, not optional.
2. Build P1-1 (notifications) next - it unblocks the rest of the patient
   experience.
3. Then P1-2 (self-service) and P1-3 (messaging) in parallel.
4. Begin P1-4 (insurance) early because it is the slowest and the highest
   weight-loss conversion lever.
5. Pick up the P2 items as capacity allows; P2-1 (PWA) and P2-3 (membership)
   are the best impact-to-effort ratio in that tier.

## Quick Wins (small code, real value)

- P0-1 catalog relabel once the supply path is decided (S).
- P1-2 cancel and pause endpoints (a useful slice of P1-2, shippable on their
  own).
- A documented review-time SLA surfaced to patients (addresses part of gap
  report 4.1 with copy, not code).
