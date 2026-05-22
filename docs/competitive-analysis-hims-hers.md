# Competitive Analysis: Hims and Hers

Prepared for PepNationRX product and platform planning. This document
summarizes how Hims & Hers Health structures its telehealth offering and
identifies what PepNationRX should adopt, extend, or deliberately differ on.

## 1. Company Overview

Hims & Hers Health operates two consumer-facing brands on one platform:
Hims (men) and Hers (women). Both are cash-pay telehealth services - they do
not bill insurance. The platform connects patients with independent licensed
providers, routes prescriptions to partner pharmacies (retail for branded
FDA-approved drugs, 503A compounding pharmacies for compounded formulations),
and bills the patient on a recurring subscription.

The model is the same one PepNationRX is built on: a technology and management
services layer between the patient, an independent medical group, and a
fulfillment pharmacy. The structural parallel is exact, which makes Hims & Hers
the most direct reference point for PepNationRX.

## 2. Product Lines

### Hims (men)

- Sexual Health - erectile dysfunction, premature ejaculation. Core drugs:
  sildenafil, tadalafil, and compounded combinations.
- Hair Loss - finasteride (prescription), topical minoxidil, and
  non-prescription support such as biotin gummies.
- Weight Loss - GLP-1 program. Following the March 2026 Novo Nordisk
  settlement, new patients are transitioned to branded products; compounded
  GLP-1s are limited to defined clinical scenarios.
- Mental Health - anxiety, depression, stress, sleep. SSRIs and related
  medications with provider management.
- Skin Care - anti-aging (retinol, hyaluronic acid) and acne regimens.
- Testosterone - oral enclomiphene (off-label, preserves fertility), branded
  oral testosterone (Kyzatrex via Marius Pharmaceuticals), with injectable
  testosterone planned. Enclomiphene can be paired with tadalafil.
- Labs and Primary Care - comprehensive lab panels and low-cost primary care
  visits.

### Hers (women)

- Birth Control - pills, patch, ring, shot, and emergency contraception.
  Entry pricing around twelve dollars per month.
- Weight Loss - GLP-1 program, same post-settlement branded transition.
- Hair - thinning-hair regimens, prescription minoxidil, shampoo and
  conditioner.
- Skin Care - acne, fine lines and wrinkles, regimen upgrades.
- Mental Health - anxiety, stress, depression with online provider management.
- Sexual Health - libido and related concerns.
- Menopause and Perimenopause - a dedicated specialty with providers trained
  in life-stage hormone care.
- Labs - comprehensive testing.

### Read-across for PepNationRX

PepNationRX already covers the hormone and metabolic ground (TRT, weight
management, peptide therapy, sexual health, longevity, plus a men's and a
women's program). The gaps relative to Hims & Hers are: hair, skin and
dermatology, mental health, sleep, birth control, and a dedicated menopause
line. PepNationRX additionally offers a deep peptide catalog that Hims & Hers
does not - that is the platform's differentiator and should be merchandised as
such rather than buried inside a generic wellness category.

## 3. Pricing Model

- No insurance. Every plan is cash-pay and presented as a flat monthly price.
- The intake and the initial assessment are free; the patient is only charged
  once a provider approves treatment.
- Recurring subscription billing. Roughly 82 percent of customers stay beyond
  three months, so retention is the core economic engine.
- Multi-month plans lower the per-month price for a longer commitment. A
  representative menopause structure: three-month plan near 199 dollars per
  month, five-month near 139, ten-month near 99.
- Category-specific entry pricing: primary care visits near 39 dollars, the
  first mental health visit near 59, weight loss often a low first-month price
  (about 39 dollars) that auto-renews to a higher rate (about 149 dollars).
- Reported consultation fees historically range from 30 to 85 dollars.

### Read-across for PepNationRX

The PepNationRX schema already supports this: `subscriptions.mrr_cents`,
`current_period_start` / `current_period_end`, and `next_billing_date`. The
catalog should model price as a set of plan cadences per treatment (for
example one, three, and twelve month), with the per-month price decreasing as
the commitment lengthens. The free-intake-then-charge pattern aligns with the
existing `intake_submissions` to `subscriptions` flow and the
`pending_clinical_review` subscription status.

## 4. Consultation and Fulfillment Flow

1. The patient completes an online intake questionnaire (asynchronous, no
   appointment required in most states).
2. An independent licensed provider reviews the intake and decides whether
   treatment is appropriate.
3. If approved, the provider writes a prescription. Branded FDA-approved
   products route to a retail pharmacy; compounded formulations route to a
   503A compounding pharmacy.
4. The pharmacy fulfills and ships; the platform manages refills, check-ins,
   and recurring billing.

Some states require a synchronous (phone or video) visit; the platform
branches on the patient's state.

### Read-across for PepNationRX

This is exactly the Triad already described in the PepNationRX architecture:
the medical network (Wheel / SteadyMD), the 503A pharmacy, and Stripe Connect
billing. The `pnrx-triage-form` built in Phase 3 is the intake step. Phase 4
builds the three service integrations that carry an approved intake through to
a shipped order. The state-based branching point should be captured as a
triage flag so the medical-network service can request a synchronous visit
where required.

## 5. Site Structure and Information Architecture

- Minimal global navigation: Shop, Learn, Cart, Login. The buying path is kept
  short and unambiguous.
- A three-level content hierarchy: category hub page, then condition page,
  then product or plan page. Direct calls to action move the visitor straight
  into intake.
- A separate Learn surface (educational content) supports SEO and trust
  without cluttering the purchase path.
- A clean, minimalist help center with prominent search and a simple grid of
  categories.

### Read-across for PepNationRX

PepNationRX should adopt the same shallow hierarchy: a catalog hub listing
categories, a category view listing treatments, and a treatment view that
leads into the triage form. The futuristic-metal design system already
delivers the clean, high-contrast aesthetic; the information architecture
should match Hims & Hers in shallowness so the path from landing to intake is
short. The `pnrx-catalog` component delivered in this phase implements the hub
and category browse; the treatment view hands off to `pnrx-triage-form`.

## 6. Where PepNationRX Should Differ

- Peptide depth as the differentiator. Hims & Hers do not offer a broad
  peptide catalog. PepNationRX does, and should give peptides first-class
  category treatment (recovery, growth-hormone secretagogues, cognitive,
  cosmetic, metabolic, longevity) rather than a single bucket.
- Compounding posture. The Novo Nordisk settlement forced Hims & Hers to wind
  down compounded GLP-1s. PepNationRX must track each treatment's regulatory
  status explicitly (branded vs compounded, available vs coming soon) in the
  catalog so the platform can adjust offerings without code changes.
- Affiliate channel. PepNationRX has an affiliate and revenue-share system
  (gyms, clinics) that Hims & Hers does not emphasize; the catalog and
  checkout should preserve affiliate attribution.

## 7. Recommended Catalog Taxonomy For PepNationRX

A flat set of categories, each holding individual treatments:

- Weight Management
- Sexual Health
- Testosterone and Hormones (men)
- Womens Hormone Health (including menopause and perimenopause)
- Birth Control
- Hair
- Skin and Dermatology
- Mental Health
- Sleep
- Peptide Therapy
- Longevity and Wellness
- Primary Care and Labs

Each treatment record carries: category, prescription requirement, branded vs
compounded status, availability (available or coming soon), a short clinical
summary, and one or more plan cadences with per-month pricing. This taxonomy
is implemented by the catalog database migration and the catalog data module
delivered alongside this document.

## 8. Sources

- Hims, Mens Telehealth - https://www.hims.com/
- Hers, Womens Healthcare - https://www.forhers.com/
- Hims & Hers Health, Wikipedia - https://en.wikipedia.org/wiki/Hims_%26_Hers_Health
- Understanding the Hims & Hers Telehealth Business Model - https://bask.health/blog/hims-and-hers-telehealth
- Hims Cost: Monthly Pricing and Subscription Tiers - https://plexusdx.com/blogs/learn/hims-cost
- Testosterone Support, Prescribed Online - https://www.hims.com/testosterone
- The New Standard in Testosterone Treatment - https://news.hims.com/newsroom/the-new-standard-in-testosterone-treatment-exclusive-branded-oral-testosterone-and-expanded-treatment-options
- 2026 Hers Reviews: Pros, Cons, and Cost - https://www.healthline.com/health/womens-health/hers-review
- Hims & Hers Review 2026: GLP-1 Programs and Pricing - https://www.telehealthally.com/guides/hims-hers-review-guide
- The Hims Website, DesignRush - https://www.designrush.com/best-designs/websites/hims-website
