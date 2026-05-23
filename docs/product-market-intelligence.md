# PepNationRX Product and Market Intelligence

Internal reference. Companion to `competitive-analysis-gaps.md` and
`gap-closure-backlog.md`. This document captures the competitive landscape, the
24-compound legality reference, and the Signature Protocols product matrix that
was seeded into the catalog (migration `0008_signature_protocols.sql` and
`frontend/js/data/treatment-catalog.js`).

This is reference material for product, pricing, and clinical-scope decisions.
It is not patient-facing copy and contains no PHI.

---

## Part I: The Competitive Telehealth Landscape

The five large consumer telehealth platforms operate as high-volume billing and
marketing fronts for a narrow subset of compounds. Their reliance on mass-market
insurance and high-volume manufacturer distribution structurally limits them to
a handful of flagship offerings.

### The Big Five Core Competitive Matrix

| Platform | Flagship Offerings | Subscription / Platform Fee | Retail Medication Pricing |
|----------|--------------------|-----------------------------|----------------------------|
| Hims & Hers | Semaglutide (oral / injectable), Tirzepatide | $149/mo ($39 first month) | Pill $149/mo, Pen $199/mo, Tirzepatide $299+/mo |
| Ro (Ro Body) | Semaglutide (oral / injectable), Tirzepatide | $149/mo ($74/mo billed annually) | Pill $149/mo, Pen $199/mo, Tirzepatide $299-$449/mo |
| Sesame Care | Semaglutide (oral / injectable), Tirzepatide | $59/mo (Success by Sesame) | Pill $149/mo, Pen $199/mo ($349/mo after month 2) |
| PlushCare | Semaglutide, Tirzepatide (commercial) | $14.99/mo plus separate consult fees | Semaglutide $199-$349/mo, Tirzepatide $299-$449/mo |
| GoodRx Care | External commercial prescriptions only | $19-$39 per episodic consult | No direct fulfillment; retail pickup $900-$1,300/mo |

### The Regulatory Optimization Opportunity

The five legacy platforms address only a small portion of the legally
compoundable optimization agents. They are effectively locked out of custom
503A wellness formulations because their business model depends on commercial
brand-name networks and high-volume manufacturer channels.

A specialized telehealth MSO can address the remaining demand by connecting
patients directly with custom-compounded formulations under automated clinical
routing, rather than reselling commercial brand-name inventory.

> **Regulatory note.** `gap-closure-backlog.md` item P0-1 flags that
> continuing to sell *compounded* GLP-1s carries live regulatory and legal
> exposure following the 2026 Novo Nordisk and Eli Lilly settlements. The
> Signature Protocols line and the broader compounded catalog should be
> reviewed against that item: the supply path (branded, authorized
> distribution, or a still-compliant 503A relationship) is a business and
> legal decision that must be made before the compounded GLP-1 protocols are
> marketed at scale.

---

## Part II: The 24-Compound Legality and Market Reference

Each compound below is compoundable by a licensed U.S. 503A pharmacy for an
individual patient prescription, based on active pharmaceutical ingredients
matching existing FDA approvals or explicit USP monographs. Wholesale
acquisition costs are planning estimates and vary by dosage and supplier.

### Section A: Incretin and Metabolic Peptides

| # | Compound | Eligibility | Competitor Benchmark | Est. 503A Wholesale Cost |
|---|----------|-------------|----------------------|--------------------------|
| 1 | Semaglutide | 503A under active FDA shortage guidance | Hims, Ro, Sesame, PlushCare $149-$349/mo | $40-$75/mo |
| 2 | Tirzepatide | 503A under active FDA shortage guidance | Hims, Ro, Sesame $299-$449/mo | $75-$160/mo |
| 3 | Liraglutide | Shortage designation or active manufacturer files | Not sold by the big five; boutique ~$300/mo | $65-$95/mo |
| 4 | Exenatide | Custom 503A using cleared metabolic APIs | Not sold by the big five | $55-$85/mo |

### Section B: Anti-Aging and Growth Hormone Secretagogues

| # | Compound | Eligibility | Competitor Benchmark | Est. 503A Wholesale Cost |
|---|----------|-------------|----------------------|--------------------------|
| 5 | Sermorelin | Stable status, comprehensive USP monograph | Boutique clinics $250-$350/mo | $35-$50 per 15mg vial |
| 6 | Tesamorelin | 503A, anchored by existing FDA approvals | Boutique clinics $400-$600/mo | $120-$180/mo |
| 7 | Macimorelin | Approved diagnostic component | Not sold by the big five | $90-$140 per dose protocol |

### Section C: Hormonal Axis and Sexual Health

| # | Compound | Eligibility | Competitor Benchmark | Est. 503A Wholesale Cost |
|---|----------|-------------|----------------------|--------------------------|
| 8 | Bremelanotide (PT-141) | Matches FDA-cleared component (Vyleesi) | Boutique $150-$250 per cycle | $30-$45 per 10mg vial |
| 9 | Gonadorelin | Legal; common for fertility maintenance | Boutique $100-$150/mo | $25-$40 per vial |
| 10 | Kisspeptin-10 | Custom 503A endocrine compounding | Not sold by the big five | $40-$65 per vial |
| 11 | Oxytocin | Legal; sublingual troche or nasal spray | Not sold by the big five | $15-$30 per dispensation |
| 12 | Leuprolide | Legal under hormonal modulation parameters | Not sold by the big five | $70-$110 per vial |
| 13 | Goserelin | Established master drug files | Not sold by the big five | $85-$130 per protocol |

### Section D: Longevity and Cellular Repair

| # | Compound | Eligibility | Competitor Benchmark | Est. 503A Wholesale Cost |
|---|----------|-------------|----------------------|--------------------------|
| 14 | Glutathione | Legal, active USP monograph | Boutique $150-$200/mo | $20-$35 per 10mL vial |
| 15 | NAD+ | Legal for 503A compounding | Longevity clinics $250-$400/mo | $50-$85 per vial protocol |
| 16 | L-Carnitine | Injectable amino acid, valid USP monograph | Not sold by the big five | $15-$25 per 50mL vial |
| 17 | GAC Blend (Glutamine / Arginine / Carnitine) | Legal multi-amino acid compound | Not sold by the big five | $25-$40 per 30mL vial |
| 18 | AOC Blend (Arginine / Ornithine / Citrulline) | Legal nitric-oxide precursor formulation | Not sold by the big five | $25-$40 per 30mL vial |
| 19 | MIC + B12 (Lipotropic Blend) | Legal, widely used across 503A networks | Not sold by the big five | $18-$30 per 30mL vial |

### Section E: Clinical and Systemic Peptides (Not for Consumer Subscription)

Octreotide, Desmopressin, Glucagon, Calcitonin, and Bivalirudin are compoundable
but reserved for inpatient clinical environments due to acute medical
parameters. They are deliberately excluded from the consumer catalog.

---

## Part III: PepNationRX Signature Protocols Matrix

The 16 protocols below are branded multi-compound stacks. They are seeded into
the catalog under the `signature-protocols` category. The "Net Margin" figures
are planning estimates using the wholesale costs above and are not patient-facing.

### Phase 1: Launch Today (live, `availability = available`, `is_active = TRUE`)

| Catalog Slug | Protocol | Formulation | Retail / mo | Est. 503A Cost / mo | Est. Net Margin / mo |
|--------------|----------|-------------|-------------|---------------------|----------------------|
| `kinetic-protocol` | The Kinetic Protocol | L-Glutamine, L-Arginine, L-Carnitine | $199 | $30 | $169 |
| `vaso-drive-protocol` | The Vaso-Drive Protocol | L-Arginine, L-Ornithine, L-Citrulline | $199 | $30 | $169 |
| `metabolic-flux-protocol` | The Metabolic Flux Protocol | Methionine, Inositol, Choline, Methylcobalamin | $149 | $22 | $127 |
| `lumen-protocol` | The Lumen Protocol | NAD+ and Glutathione (dual-vial) | $449 | $110 | $339 |
| `aegis-protocol` | The Aegis Protocol | Ascorbic Acid, Zinc Chloride, Glutathione | $149 | $25 | $124 |
| `zenith-protocol` | The Zenith Protocol | L-Theanine, Taurine, GABA | $129 | $32 | $97 |
| `kera-matrix-protocol` | The Kera-Matrix Protocol | Dexpanthenol, High-Dose Biotin | $129 | $20 | $109 |

All Phase 1 protocols rely on vitamins, coenzymes, minerals, and amino acids,
which carry low regulatory risk and low wholesale acquisition cost.

### Phase 2: Build But Hide (database-active, UI-dormant, `is_active = FALSE`)

These next-generation peptide and metabolic protocols are seeded into the
database with `is_active = FALSE` and `availability = coming_soon`, and are kept
out of the rendered frontend `TREATMENTS` array (carried in the dormant
`PHASE_2_PROTOCOLS` export). They are not browsable or purchasable until the
`is_active` flag is flipped at launch, pending the supply-path and regulatory
review noted in Part I.

| Catalog Slug | Protocol | Formulation | Retail / mo | Est. 503A Cost / mo |
|--------------|----------|-------------|-------------|---------------------|
| `wolverine-protocol` | The Wolverine Protocol | BPC-157, TB-500 | $349 | $75 |
| `glow-protocol` | The Glow Protocol | GHK-Cu, BPC-157, TB-500 | $449 | $105 |
| `klow-protocol` | The Klow Protocol | GHK-Cu, BPC-157, TB-500, KPV | $499 | $125 |
| `neuro-apex-protocol` | The Neuro-Apex Protocol | Semax, Selank | $299 | $65 |
| `chronos-protocol` | The Chronos Protocol | Epitalon, DSIP | $399 | $90 |
| `titan-protocol` | The Titan Protocol | Retatrutide | $499 | $140-$190 |
| `apex-dual-protocol` | The Apex-Dual Protocol | Cagrilintide, Semaglutide | $449 | $130-$180 |
| `hepatic-flux-protocol` | The Hepatic Flux Protocol | Survodutide | $399 | $120-$165 |
| `myo-preserve-protocol` | The Myo-Preserve Protocol | Anti-Activin Type II Receptor antibody | $599 | $180-$240 |

### Launching a Phase 2 protocol

1. Confirm the regulatory and supply-path review in Part I for that compound.
2. In the database, set `treatments.is_active = TRUE` and
   `availability = 'available'` for the protocol's slug.
3. Move the protocol's entry from the `PHASE_2_PROTOCOLS` export into the
   rendered `TREATMENTS` array in `frontend/js/data/treatment-catalog.js`.
4. Deploy the frontend and verify the protocol is browsable and purchasable.

---

## Pricing and Catalog Mechanics

Catalog pricing follows the standard multi-month model. `price_cents` is the
per-month price. The 3-month cadence applies the standard 10 percent per-month
discount, rounded to the nearest dollar, and is the default plan. Every
Signature Protocol is offered on the Monthly and 3-Month cadences.

The backend treats `treatment_plans.price_cents` as the authoritative price.
Checkout resolves price server-side from this table and never trusts a
client-supplied amount.
