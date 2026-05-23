// ============================================================================
// Treatment catalog - the PepNationRX product catalog.
// ----------------------------------------------------------------------------
// Pure data plus small helper functions. Mirrors the catalog tables in
// database/migrations/0001_treatment_catalog.sql: categories, treatments, and
// per-treatment plan cadences. The pnrx-catalog component renders this; it
// holds no product content of its own.
//
// Pricing follows the multi-month model: priceCents is the per-month price,
// and longer cadences carry a standard discount. A treatment whose
// protocolCategory is set opens the matching triage flow; treatments without
// one are screened by a general intake in a later phase.
// ============================================================================

'use strict';

// Standard per-month discount applied to longer plan cadences.
const CADENCE_DISCOUNT = { 1: 0, 3: 0.1, 6: 0.18, 12: 0.25 };

// Build the plan list for a treatment. monthlyCents is the single-month price;
// each cadence in `cadences` becomes a plan with the discount applied and the
// per-month price rounded to the nearest dollar.
function tieredPlans(monthlyCents, cadences) {
  const list = cadences && cadences.length ? cadences : [1];
  const plans = list.map(function (months) {
    const discount = CADENCE_DISCOUNT[months] || 0;
    const perMonth = Math.round((monthlyCents * (1 - discount)) / 100) * 100;
    return {
      name: months === 1 ? 'Monthly' : months + '-Month Plan',
      cadenceMonths: months,
      priceCents: perMonth,
      isDefault: false,
    };
  });
  // Default to the 3-month plan when offered, otherwise the longest cadence.
  let defaultPlan = plans.filter(function (p) { return p.cadenceMonths === 3; })[0];
  if (!defaultPlan) defaultPlan = plans[plans.length - 1];
  defaultPlan.isDefault = true;
  return plans;
}

// Treatment factory. Keeps the catalog declaration compact and consistent.
function t(slug, categorySlug, name, summary, form, compound, availability, protocolCategory, monthlyCents, cadences, prescriptionRequired) {
  return {
    slug: slug,
    categorySlug: categorySlug,
    name: name,
    summary: summary,
    form: form,
    compound: compound,
    availability: availability,
    protocolCategory: protocolCategory || null,
    prescriptionRequired: prescriptionRequired !== false,
    plans: tieredPlans(monthlyCents, cadences),
  };
}

// ----------------------------------------------------------------------------
// Categories. audience controls which funnel (men, women, all) surfaces them.
// ----------------------------------------------------------------------------
export const CATEGORIES = [
  {
    slug: 'weight-management',
    name: 'Weight Management',
    summary: 'Medically Supervised Programs Built Around GLP-1 And Metabolic Therapy.',
    audience: 'all',
    sortOrder: 1,
  },
  {
    slug: 'sexual-health',
    name: 'Sexual Health',
    summary: 'Discreet, Clinician-Reviewed Care For Erectile Function And Libido.',
    audience: 'all',
    sortOrder: 2,
  },
  {
    slug: 'testosterone',
    name: 'Testosterone And Hormones',
    summary: 'Hormone Optimization For Energy, Strength, And Vitality.',
    audience: 'men',
    sortOrder: 3,
  },
  {
    slug: 'womens-hormone',
    name: 'Womens Hormone Health',
    summary: 'Hormone Care Across Every Life Stage, Including Perimenopause And Menopause.',
    audience: 'women',
    sortOrder: 4,
  },
  {
    slug: 'birth-control',
    name: 'Birth Control',
    summary: 'Online Birth Control Prescribed And Delivered, Refilled Automatically.',
    audience: 'women',
    sortOrder: 5,
  },
  {
    slug: 'hair',
    name: 'Hair',
    summary: 'Prescription And Topical Treatments For Thinning Hair And Regrowth.',
    audience: 'all',
    sortOrder: 6,
  },
  {
    slug: 'skin',
    name: 'Skin And Dermatology',
    summary: 'Anti-Aging, Acne, And Cosmetic Peptide Regimens.',
    audience: 'all',
    sortOrder: 7,
  },
  {
    slug: 'mental-health',
    name: 'Mental Health',
    summary: 'Provider-Managed Care For Anxiety, Depression, And Stress.',
    audience: 'all',
    sortOrder: 8,
  },
  {
    slug: 'sleep',
    name: 'Sleep',
    summary: 'Treatments And Support For Better, More Consistent Sleep.',
    audience: 'all',
    sortOrder: 9,
  },
  {
    slug: 'peptide-therapy',
    name: 'Peptide Therapy',
    summary: 'Targeted Peptides For Recovery, Repair, Growth, And Cognition.',
    audience: 'all',
    sortOrder: 10,
  },
  {
    slug: 'longevity',
    name: 'Longevity And Wellness',
    summary: 'Cellular Health, Antioxidant, And Foundational Wellness Therapies.',
    audience: 'all',
    sortOrder: 11,
  },
  {
    slug: 'primary-care',
    name: 'Primary Care And Labs',
    summary: 'Comprehensive Lab Panels To Establish And Track Your Baseline.',
    audience: 'all',
    sortOrder: 12,
  },
];

// ----------------------------------------------------------------------------
// Treatments. Grouped by category for readability; order within a category is
// the display order.
// ----------------------------------------------------------------------------
export const TREATMENTS = [
  // -- Weight Management ------------------------------------------------------
  t('semaglutide', 'weight-management', 'Semaglutide',
    'A Weekly GLP-1 Injection That Reduces Appetite And Supports Steady Weight Loss.',
    'injection', 'compounded', 'available', 'weight_management', 24900, [1, 3, 6]),
  t('tirzepatide', 'weight-management', 'Tirzepatide',
    'A Dual GLP-1 And GIP Injection For Patients Seeking Greater Weight Loss.',
    'injection', 'compounded', 'available', 'weight_management', 32900, [1, 3, 6]),
  t('retatrutide', 'weight-management', 'Retatrutide',
    'A Next-Generation Triple-Agonist Weight Loss Injection. Coming Soon.',
    'injection', 'compounded', 'coming_soon', 'weight_management', 39900, [1, 3]),
  t('cagrilintide', 'weight-management', 'Cagrilintide',
    'An Amylin Analog Used Alone Or Blended With A GLP-1 For Appetite Control.',
    'injection', 'compounded', 'available', 'weight_management', 29900, [1, 3]),
  t('aod-9604', 'weight-management', 'AOD9604',
    'A Peptide Fragment Studied For Fat Metabolism Without Affecting Blood Sugar.',
    'injection', 'compounded', 'available', 'weight_management', 17900, [1, 3]),
  t('lipo-c', 'weight-management', 'LIPO-C Injection',
    'An L-Carnitine And Lipotropic Blend That Supports Fat Metabolism And Energy.',
    'injection', 'compounded', 'available', 'weight_management', 9900, [1, 3]),

  // -- Sexual Health ---------------------------------------------------------
  t('sildenafil', 'sexual-health', 'Sildenafil',
    'The Active Ingredient In Viagra, Taken As Needed For Erectile Function.',
    'oral', 'branded', 'available', 'sexual_health', 7900, [1, 3]),
  t('tadalafil', 'sexual-health', 'Tadalafil',
    'The Active Ingredient In Cialis, Available As Needed Or As A Daily Dose.',
    'oral', 'branded', 'available', 'sexual_health', 8900, [1, 3]),
  t('ed-troche', 'sexual-health', 'Sildenafil And Tadalafil Troche',
    'A Dissolvable Combination Troche For A Faster, Longer Window Of Effect.',
    'troche', 'compounded', 'available', 'sexual_health', 11900, [1, 3]),
  t('pt-141', 'sexual-health', 'PT-141',
    'A Melanocortin Peptide That Supports Libido And Arousal In Men And Women.',
    'injection', 'compounded', 'available', 'sexual_health', 14900, [1, 3]),
  t('premature-ejaculation', 'sexual-health', 'Premature Ejaculation Treatment',
    'An Off-Label Oral Treatment To Improve Control And Confidence.',
    'oral', 'branded', 'available', 'sexual_health', 6900, [1, 3]),

  // -- Testosterone And Hormones ---------------------------------------------
  t('enclomiphene', 'testosterone', 'Enclomiphene',
    'An Oral Treatment That Raises Natural Testosterone While Preserving Fertility.',
    'oral', 'compounded', 'available', 'trt', 12900, [1, 3, 6]),
  t('testosterone-cypionate', 'testosterone', 'Testosterone Cypionate',
    'A Classic Injectable Testosterone Protocol For Confirmed Low Testosterone.',
    'injection', 'branded', 'available', 'trt', 9900, [1, 3, 6]),
  t('testosterone-cream', 'testosterone', 'Testosterone Cream',
    'A Daily Topical Testosterone For Patients Who Prefer To Avoid Injections.',
    'topical', 'compounded', 'available', 'trt', 11900, [1, 3]),
  t('oral-testosterone', 'testosterone', 'Oral Testosterone',
    'A Branded, FDA-Approved Oral Testosterone Capsule. Coming Soon.',
    'oral', 'branded', 'coming_soon', 'trt', 19900, [1, 3]),
  t('hcg', 'testosterone', 'HCG',
    'Often Paired With Testosterone Therapy To Help Maintain Fertility.',
    'injection', 'compounded', 'available', 'trt', 13900, [1, 3]),

  // -- Womens Hormone Health -------------------------------------------------
  t('estradiol-therapy', 'womens-hormone', 'Estradiol Therapy',
    'Estrogen Replacement For Perimenopause And Menopause Symptom Relief.',
    'patch', 'branded', 'available', 'womens_wellness', 13900, [1, 3, 6]),
  t('progesterone', 'womens-hormone', 'Progesterone',
    'Often Paired With Estrogen Therapy For Balanced Hormone Support.',
    'oral', 'branded', 'available', 'womens_wellness', 9900, [1, 3]),
  t('vaginal-estrogen', 'womens-hormone', 'Vaginal Estrogen',
    'A Localized Estrogen Treatment For Vaginal And Urinary Symptoms.',
    'topical', 'branded', 'available', 'womens_wellness', 10900, [1, 3]),
  t('womens-testosterone', 'womens-hormone', 'Womens Testosterone',
    'A Low-Dose Topical Testosterone To Support Energy And Libido In Women.',
    'topical', 'compounded', 'available', 'womens_wellness', 11900, [1, 3]),

  // -- Birth Control ---------------------------------------------------------
  t('birth-control-pill', 'birth-control', 'Birth Control Pill',
    'A Daily Oral Contraceptive Prescribed Online And Refilled Automatically.',
    'oral', 'branded', 'available', null, 2400, [1, 3, 12]),
  t('birth-control-patch', 'birth-control', 'Birth Control Patch',
    'A Weekly Transdermal Contraceptive Patch.',
    'patch', 'branded', 'available', null, 3200, [1, 3]),
  t('birth-control-ring', 'birth-control', 'Birth Control Ring',
    'A Monthly Vaginal Ring Contraceptive.',
    'device', 'branded', 'available', null, 3900, [1, 3]),
  t('emergency-contraception', 'birth-control', 'Emergency Contraception',
    'On-Hand Emergency Contraception, Available Without A Prescription.',
    'oral', 'otc', 'available', null, 3500, [1], false),

  // -- Hair ------------------------------------------------------------------
  t('finasteride', 'hair', 'Finasteride',
    'A Daily Oral Tablet That Slows Hair Loss And Supports Regrowth In Men.',
    'oral', 'branded', 'available', null, 2500, [1, 3, 12]),
  t('topical-hair-formula', 'hair', 'Topical Finasteride And Minoxidil',
    'A Compounded Topical That Combines Two Proven Ingredients In One Application.',
    'topical', 'compounded', 'available', null, 4400, [1, 3]),
  t('minoxidil', 'hair', 'Minoxidil Topical',
    'A Topical Solution That Stimulates Regrowth. Available Without A Prescription.',
    'topical', 'otc', 'available', null, 1900, [1, 3], false),
  t('oral-minoxidil', 'hair', 'Oral Minoxidil',
    'A Low-Dose Oral Tablet Prescribed For Hair Density.',
    'oral', 'branded', 'available', null, 2900, [1, 3]),
  t('biotin-gummies', 'hair', 'Biotin Gummies',
    'A Daily Supplement That Supports Hair, Skin, And Nail Health.',
    'oral', 'otc', 'available', null, 1600, [1, 3], false),

  // -- Skin And Dermatology --------------------------------------------------
  t('tretinoin', 'skin', 'Tretinoin',
    'A Prescription Retinoid For Fine Lines, Texture, And Overall Skin Renewal.',
    'topical', 'branded', 'available', null, 3300, [1, 3]),
  t('anti-aging-cream', 'skin', 'Custom Anti-Aging Cream',
    'A Compounded Nightly Cream Personalized To Your Skin Goals.',
    'topical', 'compounded', 'available', null, 4900, [1, 3]),
  t('acne-treatment', 'skin', 'Acne Treatment',
    'A Provider-Directed Regimen For Persistent And Hormonal Acne.',
    'topical', 'branded', 'available', null, 3000, [1, 3]),
  t('ghk-cu', 'skin', 'GHK-Cu',
    'A Copper Peptide Studied For Skin Firmness, Repair, And Collagen Support.',
    'topical', 'compounded', 'available', null, 8900, [1, 3]),
  t('glow-blend', 'skin', 'GLOW Blend',
    'A Cosmetic Peptide Blend Of TB-500, BPC-157, And GHK For Skin And Recovery.',
    'injection', 'compounded', 'available', null, 16900, [1, 3]),
  t('klow-blend', 'skin', 'KLOW Blend',
    'The GLOW Blend Plus KPV, Adding Anti-Inflammatory Support For Skin Health.',
    'injection', 'compounded', 'available', null, 18900, [1, 3]),
  t('snap-8', 'skin', 'SNAP-8',
    'A Topical Peptide Studied For The Appearance Of Expression Lines.',
    'topical', 'compounded', 'available', null, 7900, [1, 3]),
  t('argireline', 'skin', 'Argireline',
    'A Topical Peptide That Targets The Look Of Fine Lines And Wrinkles.',
    'topical', 'compounded', 'available', null, 7900, [1, 3]),
  t('matrixyl', 'skin', 'Matrixyl',
    'A Topical Peptide Studied For Collagen Support And Skin Smoothness.',
    'topical', 'compounded', 'available', null, 7900, [1, 3]),
  t('melanotan-2', 'skin', 'MT-2 Melanotan 2',
    'A Melanocortin Peptide Studied For Tanning Response. Provider Reviewed.',
    'injection', 'compounded', 'available', null, 12900, [1, 3]),

  // -- Mental Health ---------------------------------------------------------
  t('anxiety-depression', 'mental-health', 'Anxiety And Depression Treatment',
    'Provider-Managed Medication For Anxiety And Depression, Adjusted Over Time.',
    'oral', 'branded', 'available', null, 4900, [1, 3]),
  t('selank', 'mental-health', 'Selank',
    'A Peptide Studied For Calm Focus And A Balanced Stress Response.',
    'nasal_spray', 'compounded', 'available', null, 9900, [1, 3]),
  t('semax', 'mental-health', 'Semax',
    'A Peptide Studied For Cognitive Clarity And Mental Stamina.',
    'nasal_spray', 'compounded', 'available', null, 9900, [1, 3]),

  // -- Sleep -----------------------------------------------------------------
  t('sleep-support', 'sleep', 'Prescription Sleep Support',
    'A Provider-Directed Treatment For Difficulty Falling Or Staying Asleep.',
    'oral', 'branded', 'available', null, 3900, [1, 3]),
  t('melatonin', 'sleep', 'Melatonin',
    'A Nightly Supplement To Support A Consistent Sleep Routine.',
    'oral', 'otc', 'available', null, 1400, [1, 3], false),

  // -- Peptide Therapy -------------------------------------------------------
  t('bpc-157', 'peptide-therapy', 'BPC-157',
    'A Peptide Widely Studied For Tissue Repair And Recovery Support.',
    'injection', 'compounded', 'available', 'peptide_therapy', 13900, [1, 3]),
  t('tb-500', 'peptide-therapy', 'TB-500 Thymosin Beta-4',
    'A Peptide Studied For Flexibility, Recovery, And Tissue Repair.',
    'injection', 'compounded', 'available', 'peptide_therapy', 14900, [1, 3]),
  t('bpc-tb-blend', 'peptide-therapy', 'BPC-157 And TB-500 Blend',
    'A Combined 10mg And 10mg Recovery Blend In A Single Protocol.',
    'injection', 'compounded', 'available', 'peptide_therapy', 19900, [1, 3]),
  t('cjc-ipamorelin', 'peptide-therapy', 'CJC-1295 And Ipamorelin',
    'A Growth-Hormone Secretagogue Pairing Studied For Recovery And Body Composition.',
    'injection', 'compounded', 'available', 'peptide_therapy', 17900, [1, 3]),
  t('ipamorelin', 'peptide-therapy', 'Ipamorelin',
    'A Selective Growth-Hormone Secretagogue Used As A Standalone Protocol.',
    'injection', 'compounded', 'available', 'peptide_therapy', 13900, [1, 3]),
  t('sermorelin', 'peptide-therapy', 'Sermorelin',
    'A Growth-Hormone-Releasing Peptide Studied For Recovery And Sleep Quality.',
    'injection', 'compounded', 'available', 'peptide_therapy', 13900, [1, 3]),
  t('tesamorelin', 'peptide-therapy', 'Tesamorelin',
    'A Growth-Hormone-Releasing Peptide Studied For Visceral Fat Reduction.',
    'injection', 'compounded', 'available', 'peptide_therapy', 21900, [1, 3]),
  t('hgh-fragment-176-191', 'peptide-therapy', 'HGH Fragment 176-191',
    'A Growth-Hormone Fragment Studied For Fat Metabolism.',
    'injection', 'compounded', 'available', 'peptide_therapy', 15900, [1, 3]),
  t('peg-mgf', 'peptide-therapy', 'PEG-MGF',
    'A Mechano Growth Factor Variant Studied For Muscle Recovery.',
    'injection', 'compounded', 'available', 'peptide_therapy', 16900, [1, 3]),
  t('mots-c', 'peptide-therapy', 'MOTS-c',
    'A Mitochondrial-Derived Peptide Studied For Metabolism And Endurance.',
    'injection', 'compounded', 'available', 'peptide_therapy', 16900, [1, 3]),
  t('thymosin-alpha-1', 'peptide-therapy', 'Thymosin Alpha-1',
    'A Peptide Studied For Immune Regulation And Resilience.',
    'injection', 'compounded', 'available', 'peptide_therapy', 17900, [1, 3]),
  t('kpv', 'peptide-therapy', 'KPV',
    'A Short Peptide Studied For Anti-Inflammatory And Gut Health Support.',
    'injection', 'compounded', 'available', 'peptide_therapy', 12900, [1, 3]),
  t('five-amino-1mq', 'peptide-therapy', '5-Amino-1MQ',
    'An Oral Compound Studied For Metabolic Activity And Body Composition.',
    'oral', 'compounded', 'available', 'peptide_therapy', 13900, [1, 3]),
  t('dihexa', 'peptide-therapy', 'Dihexa',
    'A Peptide Studied For Cognitive Performance And Neural Support.',
    'oral', 'compounded', 'available', 'peptide_therapy', 18900, [1, 3]),
  t('humanin', 'peptide-therapy', 'Humanin',
    'A Mitochondrial-Derived Peptide Studied For Cellular Resilience.',
    'injection', 'compounded', 'available', 'peptide_therapy', 17900, [1, 3]),

  // -- Longevity And Wellness ------------------------------------------------
  t('nad-plus', 'longevity', 'NAD+',
    'A Coenzyme Therapy Studied For Cellular Energy And Healthy Aging.',
    'injection', 'compounded', 'available', 'longevity', 19900, [1, 3]),
  t('glutathione', 'longevity', 'Glutathione',
    'A Master Antioxidant Therapy Studied For Detoxification And Skin Clarity.',
    'injection', 'compounded', 'available', 'longevity', 9900, [1, 3]),
  t('vitamin-b12', 'longevity', 'Vitamin B12',
    'A B12 Injection To Support Energy And Healthy Metabolism.',
    'injection', 'compounded', 'available', 'longevity', 4900, [1, 3]),

  // -- Primary Care And Labs -------------------------------------------------
  t('comprehensive-lab-panel', 'primary-care', 'Comprehensive Lab Panel',
    'A Broad Blood Panel To Establish Your Baseline Health Picture.',
    'device', 'otc', 'available', null, 9900, [1], false),
  t('hormone-lab-panel', 'primary-care', 'Hormone Lab Panel',
    'A Focused Hormone Panel To Guide Testosterone And Hormone Therapy.',
    'device', 'otc', 'available', null, 7900, [1], false),
];

// ----------------------------------------------------------------------------
// Lookup helpers.
// ----------------------------------------------------------------------------

// Categories sorted by display order.
export function sortedCategories() {
  return CATEGORIES.slice().sort(function (a, b) {
    return a.sortOrder - b.sortOrder;
  });
}

// Categories shown for a given audience filter ('men' | 'women' | 'all').
// The 'all' filter is the no-op view and must show every category, including
// the men- and women-specific ones; a narrower filter shows the universal
// categories plus that audience's own. A filter set to 'all' never hides rows.
export function categoriesForAudience(audience) {
  return sortedCategories().filter(function (category) {
    return (
      audience === 'all' ||
      category.audience === 'all' ||
      category.audience === audience
    );
  });
}

// One category by slug, or null.
export function getCategory(slug) {
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    if (CATEGORIES[i].slug === slug) return CATEGORIES[i];
  }
  return null;
}

// All treatments in a category, in declared order.
export function treatmentsByCategory(categorySlug) {
  return TREATMENTS.filter(function (treatment) {
    return treatment.categorySlug === categorySlug;
  });
}

// One treatment by slug, or null.
export function getTreatment(slug) {
  for (let i = 0; i < TREATMENTS.length; i += 1) {
    if (TREATMENTS[i].slug === slug) return TREATMENTS[i];
  }
  return null;
}

// The default plan for a treatment (the one flagged isDefault).
export function defaultPlan(treatment) {
  if (!treatment || !treatment.plans) return null;
  const flagged = treatment.plans.filter(function (p) { return p.isDefault; })[0];
  return flagged || treatment.plans[0] || null;
}

// The lowest per-month price across a treatment's plans, in cents.
export function startingPriceCents(treatment) {
  if (!treatment || !treatment.plans || !treatment.plans.length) return 0;
  return treatment.plans.reduce(function (lowest, plan) {
    return plan.priceCents < lowest ? plan.priceCents : lowest;
  }, treatment.plans[0].priceCents);
}
