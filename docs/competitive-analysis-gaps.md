# PepNationRX Competitive Analysis And Gap Report

Prepared: 2026-05-23. Subjects: Sesame, PlushCare, Ro, GoodRx Care, Hims & Hers.
Companion file: `gap-closure-backlog.md` (the prioritized work list).

## Purpose

A deep dive into how five leading telehealth platforms are built, laid out, and
stocked, cross-referenced against what PepNationRX has today, with every gap
enumerated. This is a competitive and product document, not a code audit.

---

## 1. Executive Summary

PepNationRX has a genuinely strong backend spine: a compliant MSO architecture,
a tri-party Stripe Connect split, a branching clinical triage engine, a 64-item
catalog, a wired pharmacy-fulfillment and affiliate-attribution pipeline, and a
background-jobs layer. On that axis it is competitive.

Where it falls short is the parts of a telehealth business the patient actually
touches and the parts that decide whether a patient can afford to convert:

- No native mobile app. Every competitor ships iOS and Android.
- No insurance handling of any kind. Ro, GoodRx, and PlushCare all do; for
  weight loss this is now the single biggest conversion lever.
- No live video visit path. PlushCare is video-first; Sesame and Ro offer it.
- No patient-to-provider messaging or care team. Hims, Ro, and PlushCare all
  center the experience on it.
- No lab ordering or results delivery. Sesame, Hims, and PlushCare have it.
- No patient notifications at all (no email or SMS service is wired).
- The patient dashboard is read-only: no self-service to pause, cancel, or
  change a subscription.
- The weight-loss catalog still lists semaglutide and tirzepatide as
  `compounded`. After the 2026 Novo Nordisk and Eli Lilly settlements, the
  whole industry moved to branded GLP-1s. This is both a competitive miss and
  a live regulatory exposure.

PepNationRX is ahead in two places: a deep research-peptide and longevity
catalog that none of the five match, and a built-in affiliate revenue-share
program aimed at gyms and clinics.

---

## 2. Platform Profiles

### 2.1 Sesame

- Model: a cash-pay marketplace. Independent licensed providers publish
  profiles, services, and their own prices; patients search by location,
  specialty, service, and price, then book and pay upfront. Both telehealth
  and in-person.
- Layout / IA: search-and-browse over provider listings; provider profiles
  with prices; condition and service landing pages; a digital pharmacy.
- Medications: infections, UTIs, anxiety, depression, allergies, blood
  pressure, ED, and more; generics from about $5 with free delivery; 14
  weight-loss options including branded Wegovy and Zepbound. No controlled
  substances.
- Pricing: telehealth visits from $25-40. Sesame Plus membership $10.99/mo
  (discounted visits, free annual Quest labs, an Rx discount card). Mental
  health subscription $79/mo. Weight-loss platform fee $59/mo, medication
  billed separately.
- Notable: provider choice and price comparison, in-person care, free lab
  work in the membership, an Rx discount card.

### 2.2 PlushCare

- Model: traditional primary-care telehealth. Every engagement is a scheduled
  live video visit with a licensed physician; patients keep the same doctor.
- Layout / IA: appointment scheduling, physician profiles, condition pages,
  an in-app message center, lab and referral support.
- Conditions: allergies, asthma, cold and flu, infections, anxiety,
  depression, pink eye, digestion, blood pressure, cholesterol, diabetes,
  migraines, sleep, plus men's, women's, sexual, and pediatric health.
- Medications: antibiotics, antidepressants and anti-anxiety (SSRIs, SNRIs,
  TCAs, MAOIs), birth control, hypertension drugs. No controlled substances.
- Pricing: visits from about $19; optional $19.99/mo membership (Rx discount
  card, unlimited provider messaging, lab discounts); first month free;
  membership shareable with up to 5 adult family members.
- Notable: video-first, same-doctor continuity, family accounts, pediatric
  care, accepts insurance.

### 2.3 Ro

- Model: vertically integrated, membership-based, condition-focused telehealth
  with its own fulfillment pharmacies. Video or messaging consults, ongoing
  monthly check-ins, provider can adjust dosing.
- Layout / IA: condition-led funnels (Ro Body for weight, Ro ED, hair, skin,
  fertility); intake questionnaire then provider review; a member portal with
  ongoing provider access.
- Medications: GLP-1s in tablet and injection form (Ozempic, Wegovy,
  Zepbound); as of January 2026 the nationwide launch of the oral Wegovy pill
  with Novo Nordisk; ED, hair, skin, fertility prescriptions.
- Pricing: Ro Body membership about $145/mo; oral GLP-1 $149-299/mo;
  injectable GLP-1 $299-449/mo.
- Notable: a free GLP-1 Insurance Checker, an insurance concierge that reviews
  the policy and submits documentation, oral GLP-1, ongoing dose management.

### 2.4 GoodRx Care

- Model: prescription-first asynchronous telehealth attached to the GoodRx
  discount-pricing ecosystem.
- Layout / IA: sign up, complete a health intake, pick a treatment and
  subscription plan; a clinician reviews asynchronously in a visit that stays
  open 10 days; the Rx is sent to a pharmacy partner.
- Conditions / medications: acne through high cholesterol; weight loss with
  brand-name only (no compounded) GLP-1s; flexible fulfillment including
  retail in-store pickup and home delivery via LillyDirect.
- Pricing: medical visits from $19; weight-loss subscription cut to $39/mo;
  $199/mo introductory brand Ozempic and Wegovy, then $349/mo.
- Notable: the GoodRx discount-card backbone, retail pickup, aggressive cash
  pricing, brand-name-only positioning. No coaching, dietitian, or labs.

### 2.5 Hims & Hers

- Model: subscription, asynchronous, condition-focused, vertically integrated
  (owns compounding and a 503B outsourcing facility). Consults are async via
  secure messaging; provider review in 24-72 hours.
- Layout / IA: two storefronts (hims.com, forhers.com); category funnels;
  questionnaire intake; a member account with an ongoing care-team message
  thread; large content and condition library.
- Categories: sexual health, mental health, hair, skin, weight loss,
  testosterone, perimenopause and menopause, comprehensive labs, primary
  care, plus vitamins and supplements.
- Medications: ED (sildenafil, tadalafil), hair (finasteride, minoxidil) from
  about $22/mo, mental health $25-85/mo, dermatology, and, after the March
  2026 Novo Nordisk settlement, branded Wegovy and Ozempic as an authorized
  distribution partner (moved off compounded semaglutide).
- Notable: unlimited care-team messaging, comprehensive labs, native apps,
  the broadest consumer brand, a deep SEO content library.

---

## 3. What PepNationRX Has Today

- Architecture: Node and Express backend, vanilla-JS Web Component frontend,
  PostgreSQL on Supabase, deployed behind nginx. An MSO model: independent
  providers and 503A pharmacies; PepNationRX is the billing agent.
- Auth: register, login, refresh-token rotation, logout; roles for patient,
  provider, pharmacist, affiliate, admin, support.
- Catalog: 12 categories, 64 treatments, 132 plan cadences. Weight management,
  sexual health, testosterone, women's hormone, birth control, hair, skin,
  mental health, sleep, peptide therapy, longevity, primary care and labs.
- Clinical triage: 7 branching protocols with risk scoring and disqualifying
  answers; an intake endpoint that stores answers PHI-encrypted and forwards
  to a medical network (Wheel / SteadyMD style).
- The Triad: medical-network service, 503A pharmacy service with order
  routing, Stripe Connect with a tri-party split (medical practice as Merchant
  of Record, provider consult fee, platform management fee).
- Webhooks: signed prescriptions from the medical network, pharmacy tracking,
  Stripe events; all signature-verified and idempotent.
- Checkout: a pending subscription plus a pending tri-party transaction, with
  consent capture and affiliate attribution.
- Dashboards: a patient dashboard (subscriptions, prescriptions, shipments,
  billing) and an affiliate dashboard (referral funnel, attributed MRR,
  payout ledger).
- Affiliate program: referral landing tracking, conversion attribution, and
  revenue-share payouts to partner gyms and clinics.
- Background jobs: refill reminders, billing sweep, payout run.
- Monthly clinical check-ins to keep recurring protocols authorized.

---

## 4. Gap Analysis

### 4.1 Care Delivery Model

- No live video visit path. PepNationRX is asynchronous only (intake then
  clinician review). PlushCare is video-first; Sesame and Ro offer video.
  Some states require a synchronous visit; the intake mapper flags those
  states but there is no native video, so those patients depend entirely on
  whatever the medical network provides.
- No provider profiles or provider choice. Sesame is built on browsing and
  comparing providers; PlushCare gives each patient a named, consistent
  doctor. PepNationRX exposes only an opaque "independent licensed clinician."
- No acute or urgent care. PlushCare, Sesame, and GoodRx treat UTIs, flu,
  infections, and pink eye, and prescribe antibiotics. PepNationRX is purely
  elective and lifestyle. This is a defensible positioning choice but it is a
  breadth gap and it forfeits the highest-frequency, lowest-cost entry visit.
- No pediatric care. PlushCare serves pediatrics; PepNationRX triage
  disqualifies anyone under 18.
- No 24/7 or same-day promise. Sesame markets 24/7 visits from $37; PlushCare
  markets same-day. PepNationRX turnaround depends on the medical network's
  unstated review SLA.

### 4.2 Product And Catalog

- Compounded GLP-1 exposure. The catalog lists semaglutide and tirzepatide as
  `compounded`. After the 2026 Novo Nordisk and Eli Lilly settlements, Hims,
  Ro, and GoodRx all moved to branded GLP-1s. Continuing to sell compounded
  semaglutide and tirzepatide is a competitive miss and a live regulatory and
  legal exposure. This is the single most urgent item.
- No oral GLP-1. Ro launched the oral Wegovy pill nationwide in January 2026.
  Every PepNationRX GLP-1 is an injection.
- No branded-distribution relationship. Hims and Ro are authorized
  distributors for Novo Nordisk; GoodRx routes through LillyDirect.
  PepNationRX has no pharma partnership.

### 4.3 Patient Experience

- No native mobile app. Hims, Ro, PlushCare, and GoodRx all ship iOS and
  Android apps. PepNationRX is web only.
- No patient-to-provider messaging. Hims, Ro, and PlushCare center the product
  on an ongoing secure care-team message thread. PepNationRX has no messaging;
  the monthly check-in is a one-way form.
- No patient notifications. No email or SMS service is wired in the backend.
  The refill-reminders job creates a check-in row but nothing tells the
  patient. Patients are never proactively notified of a shipment, a renewal, a
  prescription decision, or a due check-in.
- Read-only patient dashboard. `patient.routes` exposes only
  `GET /dashboard`. A patient cannot pause, cancel, or change a subscription,
  or update an address or payment method, without contacting support.
  Competitors all offer in-app self-service.
- No content or education layer, and therefore little organic search reach.
  Hims and competitors run large condition libraries and blogs that drive
  acquisition. PepNationRX has only legal pages and catalog summaries.
- No reviews, ratings, or social proof anywhere in the experience.

### 4.4 Commercial And Access

- No insurance handling. Ro has a free GLP-1 Insurance Checker and an
  insurance concierge; GoodRx is built on insurance and discount pricing;
  PlushCare accepts insurance. PepNationRX is cash-pay through Stripe with no
  eligibility check, no concierge, no claims path. For weight loss this is the
  biggest conversion gap of all.
- No HSA or FSA support and no superbill for reimbursement.
- No discount or coupon mechanism. Sesame Plus includes an Rx discount card;
  GoodRx is a discount-card company. PepNationRX has no promo, coupon, or
  discount-card capability.
- No membership tier. Sesame Plus ($10.99), PlushCare ($19.99), GoodRx ($39),
  Ro Body ($145) all sell a recurring membership that bundles perks and
  smooths pricing. PepNationRX charges per plan only, with no "Plus" tier.
- No fulfillment flexibility. GoodRx offers retail in-store pickup.
  PepNationRX is mail-order cold-chain only.
- No family or shared accounts. PlushCare shares one membership across up to
  5 adults. PepNationRX accounts are single-user.

### 4.5 Diagnostics

- No lab ordering or results delivery. Sesame bundles free Quest labs, Hims
  sells comprehensive labs, PlushCare offers lab testing and specialist
  referrals. PepNationRX lists lab panels as catalog products in the
  "primary-care" category but has no Quest or Labcorp integration, no
  order-placement flow, and no results delivery to the patient.

---

## 5. Where PepNationRX Is Ahead

- Research-peptide and longevity depth. The catalog carries 15 peptides plus a
  longevity line (NAD+, glutathione, others). None of the five competitors
  offer a peptide catalog of this depth; it is a genuine differentiator.
- A built-in affiliate revenue-share program. PepNationRX tracks referral
  landings and conversions and pays revenue share to partner gyms and clinics.
  None of the five has a comparable native partner-channel program.
- A compliance-forward MSO architecture. The tri-party Stripe Connect split,
  the Merchant-of-Record model, encrypted PHI at rest, signed and idempotent
  webhooks, and an append-only audit log are already built and are a credible
  foundation.

---

## 6. Cross-Reference Summary

Legend: Yes = present, No = absent, Partial = partially built.

| Capability                            | Sesame  | PlushCare | Ro  | GoodRx  | Hims | PepNationRX |
| -------------------------------------- | ------- | --------- | --- | ------- | ---- | ----------- |
| Native mobile app                      | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Live video visits                      | Yes     | Yes       | Yes | No      | No   | No          |
| Provider choice / profiles             | Yes     | Yes       | No  | No      | No   | No          |
| Patient-provider messaging             | Partial | Yes       | Yes | Partial | Yes  | No          |
| Insurance handling                     | Partial | Yes       | Yes | Yes     | No   | No          |
| HSA / FSA / superbill                   | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Membership tier                        | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Discount / coupon mechanism             | Yes     | Yes       | No  | Yes     | No   | No          |
| Lab ordering and results                | Yes     | Yes       | No  | No      | Yes  | No          |
| Patient notifications (email / SMS)     | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Self-service subscription management    | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Acute / urgent care                     | Yes     | Yes       | No  | Yes     | No   | No          |
| Branded GLP-1                           | Yes     | Yes       | Yes | Yes     | Yes  | No          |
| Oral GLP-1                              | No      | No        | Yes | No      | No   | No          |
| Content / SEO library                   | Yes     | Yes       | Yes | Yes     | Yes  | Partial     |
| Research-peptide catalog                | No      | No        | No  | No      | No   | Yes         |
| Native affiliate revenue share          | No      | No        | No  | No      | No   | Yes         |

The prioritized plan for closing these gaps is in `gap-closure-backlog.md`.
