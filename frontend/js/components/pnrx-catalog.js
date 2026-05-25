// ============================================================================
// pnrx-catalog - the PepNationRX treatment storefront.
// ----------------------------------------------------------------------------
// A shallow three-level browse, matching the Hims & Hers information
// architecture documented in docs/competitive-analysis-hims-hers.md:
//
//   hub      -> category grid, with a men / women / all audience filter
//   category -> the treatments within one category
//   treatment-> a single treatment, its plan cadences, and the intake CTA
//
// Choosing "Begin Intake" emits a "catalog:select" CustomEvent whose detail
// carries the treatment, its protocol category (the triage flow to open), and
// the selected plan. A host application wires that to pnrx-triage-form.
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import {
  categoriesForAudience,
  getCategory,
  treatmentsByCategory,
  getTreatment,
  defaultPlan,
  startingPriceCents,
} from '../data/treatment-catalog.js';

// Format an integer cent amount as a whole-dollar price string.
function formatPrice(cents) {
  return '$' + Math.round(cents / 100);
}

// Human label for a compound_type value.
function compoundLabel(compound) {
  if (compound === 'branded') return 'Branded';
  if (compound === 'otc') return 'Over The Counter';
  return 'Compounded';
}

// SVG icon map keyed by category slug. Each icon is a 24x24 stroke-based SVG.
const CATEGORY_ICONS = {
  'weight-management': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 8l2-2h10l2 2"/><rect x="3" y="8" width="4" height="8" rx="1"/><rect x="17" y="8" width="4" height="8" rx="1"/></svg>',
  'sexual-health': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12.572l-7.5 7.428-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.566z"/></svg>',
  'testosterone': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M21 3l-7.5 7.5"/><circle cx="9" cy="15" r="6"/></svg>',
  'womens-hormone': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M12 14v7"/><path d="M9 18h6"/></svg>',
  'birth-control': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  'hair': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 4 6 4 10c0 3 1.5 5 3 6v4a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4c1.5-1 3-3 3-6 0-4-2.5-8-8-8z"/><path d="M9 22v-6"/><path d="M15 22v-6"/></svg>',
  'skin': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"/><path d="M12 3c-2 3-3 6-3 9s1 6 3 9"/><path d="M12 3c2 3 3 6 3 9s-1 6-3 9"/><path d="M3 12h18"/></svg>',
  'mental-health': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 4 7l3 5 3-5c2-2 4-4 4-7a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2"/></svg>',
  'sleep': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  'peptide-therapy': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6v2H9z"/><rect x="7" y="5" width="10" height="16" rx="2"/><path d="M10 10h4"/><path d="M10 14h4"/></svg>',
  'longevity': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>',
  'primary-care': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/></svg>',
  'signature-protocols': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

export class PnrxCatalog extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      screen: 'hub', // hub | category | treatment
      audience: 'all', // all | men | women
      categorySlug: null,
      treatmentSlug: null,
      selectedCadence: null,
    };
  }

  // -- State transitions -----------------------------------------------------

  setAudience(audience) {
    this.setState({ audience: audience });
  }

  openCategory(slug) {
    this.setState({ screen: 'category', categorySlug: slug });
  }

  openTreatment(slug) {
    const treatment = getTreatment(slug);
    const plan = defaultPlan(treatment);
    this.setState({
      screen: 'treatment',
      treatmentSlug: slug,
      selectedCadence: plan ? plan.cadenceMonths : null,
    });
  }

  backToHub() {
    this.setState({ screen: 'hub', categorySlug: null, treatmentSlug: null });
  }

  backToCategory() {
    this.setState({ screen: 'category', treatmentSlug: null });
  }

  selectCadence(months) {
    this.setState({ selectedCadence: months });
  }

  beginIntake() {
    const treatment = getTreatment(this.state.treatmentSlug);
    if (!treatment || treatment.availability !== 'available') return;
    const selectedCadence = this.state.selectedCadence;
    const plan =
      treatment.plans.filter(function (p) {
        return p.cadenceMonths === selectedCadence;
      })[0] || defaultPlan(treatment);
    // Guard: a treatment must have a resolvable plan with a price before we
    // can proceed. Without this, an order with null priceCents could slip
    // through to checkout and be rejected by the backend.
    if (!plan || typeof plan.priceCents !== 'number') return;
    this.emit('catalog:select', {
      treatmentSlug: treatment.slug,
      treatmentName: treatment.name,
      categorySlug: treatment.categorySlug,
      protocolCategory: treatment.protocolCategory,
      prescriptionRequired: treatment.prescriptionRequired,
      planCadenceMonths: plan.cadenceMonths,
      planPriceCents: plan.priceCents,
    });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.screen === 'category') {
      body = this.renderCategoryScreen();
    } else if (this.state.screen === 'treatment') {
      body = this.renderTreatmentScreen();
    } else {
      body = this.renderHubScreen();
    }
    return '<div class="pnrx-catalog">' + body + '</div>';
  }

  renderHubScreen() {
    const audience = this.state.audience;
    const toggle = ['all', 'men', 'women']
      .map(function (value) {
        const label =
          value === 'all' ? 'All' : value === 'men' ? 'Men' : 'Women';
        const active = value === audience ? ' is-active' : '';
        return (
          '<button type="button" class="pnrx-catalog__toggle' +
          active +
          '" data-audience="' +
          value +
          '">' +
          label +
          '</button>'
        );
      })
      .join('');

    const cards = categoriesForAudience(audience)
      .map(function (category) {
        const iconSvg = CATEGORY_ICONS[category.slug] || '';
        const iconHtml = iconSvg
          ? '<span class="pnrx-catalog__card-icon">' + iconSvg + '</span>'
          : '';
        return (
          '<button type="button" class="pnrx-catalog__card" data-category="' +
          escapeHtml(category.slug) +
          '">' +
          iconHtml +
          '<span class="pnrx-catalog__card-title">' +
          escapeHtml(category.name) +
          '</span>' +
          '<span class="pnrx-catalog__card-text">' +
          escapeHtml(category.summary) +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    // Hero section
    const hero =
      '<section class="pnrx-hero">' +
      '<div class="pnrx-hero__content">' +
      '<span class="pnrx-hero__eyebrow">CLINICIAN-REVIEWED TELEHEALTH</span>' +
      '<h1 class="pnrx-hero__h1">Premium Care,<br>Delivered To Your Door</h1>' +
      '<p class="pnrx-hero__sub">Board-Certified Providers. FDA-Regulated Medications. Discreet Shipping. No Insurance Needed.</p>' +
      '<a class="pnrx-hero__cta" href="#/intake">Start Your Intake</a>' +
      '</div>' +
      '</section>';

    // Trust bar
    const trust =
      '<div class="pnrx-trust">' +
      '<div class="pnrx-trust__item">' +
      '<span class="pnrx-trust__number">50</span>' +
      '<span class="pnrx-trust__label">States Licensed</span>' +
      '</div>' +
      '<div class="pnrx-trust__divider"></div>' +
      '<div class="pnrx-trust__item">' +
      '<span class="pnrx-trust__number">100%</span>' +
      '<span class="pnrx-trust__label">HIPAA Compliant</span>' +
      '</div>' +
      '<div class="pnrx-trust__divider"></div>' +
      '<div class="pnrx-trust__item">' +
      '<span class="pnrx-trust__number">Board-Certified</span>' +
      '<span class="pnrx-trust__label">Licensed Providers</span>' +
      '</div>' +
      '<div class="pnrx-trust__divider"></div>' +
      '<div class="pnrx-trust__item">' +
      '<span class="pnrx-trust__number">Free</span>' +
      '<span class="pnrx-trust__label">Discreet Shipping</span>' +
      '</div>' +
      '</div>';

    return (
      hero +
      trust +
      '<header class="pnrx-catalog__head">' +
      '<h2 class="pnrx-catalog__title">Browse Treatments</h2>' +
      '<p class="pnrx-catalog__sub">Clinician-Reviewed Care, Delivered To Your ' +
      'Door. Select A Category To Begin.</p>' +
      '<div class="pnrx-catalog__toggles">' +
      toggle +
      '</div>' +
      '</header>' +
      '<div class="pnrx-catalog__grid">' +
      cards +
      '</div>'
    );
  }

  renderCategoryScreen() {
    const category = getCategory(this.state.categorySlug);
    if (!category) return this.renderHubScreen();

    const cards = treatmentsByCategory(category.slug)
      .map(function (treatment) {
        const soon = treatment.availability === 'coming_soon';
        const badge = soon
          ? '<span class="pnrx-catalog__badge pnrx-catalog__badge--soon">Coming Soon</span>'
          : '';
        const price =
          'From ' + formatPrice(startingPriceCents(treatment)) + ' Per Month';
        return (
          '<button type="button" class="pnrx-catalog__card" data-treatment="' +
          escapeHtml(treatment.slug) +
          '">' +
          '<span class="pnrx-catalog__card-row">' +
          '<span class="pnrx-catalog__card-title">' +
          escapeHtml(treatment.name) +
          '</span>' +
          badge +
          '</span>' +
          '<span class="pnrx-catalog__card-text">' +
          escapeHtml(treatment.summary) +
          '</span>' +
          '<span class="pnrx-catalog__card-price">' +
          escapeHtml(price) +
          '</span>' +
          '</button>'
        );
      })
      .join('');

    return (
      '<header class="pnrx-catalog__head">' +
      '<button type="button" class="pnrx-catalog__back" data-action="hub">' +
      'Back To Categories</button>' +
      '<h2 class="pnrx-catalog__title">' +
      escapeHtml(category.name) +
      '</h2>' +
      '<p class="pnrx-catalog__sub">' +
      escapeHtml(category.summary) +
      '</p>' +
      '</header>' +
      '<div class="pnrx-catalog__grid">' +
      cards +
      '</div>'
    );
  }

  renderTreatmentScreen() {
    const treatment = getTreatment(this.state.treatmentSlug);
    if (!treatment) return this.renderHubScreen();
    const self = this;
    const soon = treatment.availability === 'coming_soon';

    const badges =
      '<span class="pnrx-catalog__tag">' +
      escapeHtml(compoundLabel(treatment.compound)) +
      '</span>' +
      (treatment.prescriptionRequired
        ? '<span class="pnrx-catalog__tag">Prescription</span>'
        : '<span class="pnrx-catalog__tag">No Prescription Needed</span>') +
      (soon
        ? '<span class="pnrx-catalog__tag pnrx-catalog__tag--soon">Coming Soon</span>'
        : '');

    const plans = treatment.plans
      .map(function (plan) {
        const selected =
          plan.cadenceMonths === self.state.selectedCadence ? ' is-selected' : '';
        const total = plan.priceCents * plan.cadenceMonths;
        const totalNote =
          plan.cadenceMonths > 1
            ? '<span class="pnrx-catalog__plan-total">' +
              formatPrice(total) +
              ' Billed Per ' +
              plan.cadenceMonths +
              ' Months</span>'
            : '';
        return (
          '<button type="button" class="pnrx-catalog__plan' +
          selected +
          '" data-cadence="' +
          plan.cadenceMonths +
          '">' +
          '<span class="pnrx-catalog__plan-name">' +
          escapeHtml(plan.name) +
          '</span>' +
          '<span class="pnrx-catalog__plan-price">' +
          formatPrice(plan.priceCents) +
          ' Per Month</span>' +
          totalNote +
          '</button>'
        );
      })
      .join('');

    const cta = soon
      ? '<button type="button" class="pnrx-catalog__cta" disabled>' +
        'Coming Soon</button>'
      : '<button type="button" class="pnrx-catalog__cta" data-action="intake">' +
        'Begin Intake</button>';

    return (
      '<header class="pnrx-catalog__head">' +
      '<button type="button" class="pnrx-catalog__back" data-action="category">' +
      'Back</button>' +
      '<h2 class="pnrx-catalog__title">' +
      escapeHtml(treatment.name) +
      '</h2>' +
      '<div class="pnrx-catalog__tags">' +
      badges +
      '</div>' +
      '<p class="pnrx-catalog__sub">' +
      escapeHtml(treatment.summary) +
      '</p>' +
      '</header>' +
      '<h3 class="pnrx-catalog__subhead">Choose Your Plan</h3>' +
      '<div class="pnrx-catalog__plans">' +
      plans +
      '</div>' +
      '<div class="pnrx-catalog__foot">' +
      cta +
      '</div>' +
      (treatment.compound !== 'branded' && treatment.compound !== 'otc'
        ? '<p class="pnrx-catalog__legal pnrx-catalog__legal--compound">' +
          '*Compounded Medications Are Not FDA-Approved. The FDA Does Not Evaluate ' +
          'Compounded Drug Products For Safety, Effectiveness, Or Quality. Compounded ' +
          'Medications Are Prepared By Licensed 503A Compounding Pharmacists For ' +
          'Individual Patients Based On A Valid Prescription.' +
          '</p>'
        : '') +
      '<p class="pnrx-catalog__legal">All Prescriptions Require A Clinical ' +
      'Intake Reviewed By An Independent, Licensed Provider. A Prescription Is ' +
      'Not Guaranteed And Is At The Sole Discretion Of The Clinician. ' +
      'PepNationRX Acts Solely As The Designated Billing Agent. Not Available ' +
      'In All States. Not Insurance. Not For Emergencies &mdash; Call 911.</p>'
    );
  }

  // -- Event binding ---------------------------------------------------------

  afterRender() {
    const self = this;

    this.$$('[data-audience]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.setAudience(button.getAttribute('data-audience'));
      });
    });

    this.$$('[data-category]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.openCategory(button.getAttribute('data-category'));
      });
    });

    this.$$('[data-treatment]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.openTreatment(button.getAttribute('data-treatment'));
      });
    });

    this.$$('[data-cadence]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.selectCadence(Number(button.getAttribute('data-cadence')));
      });
    });

    const hub = this.$('[data-action="hub"]');
    if (hub) hub.addEventListener('click', function () { self.backToHub(); });

    const category = this.$('[data-action="category"]');
    if (category) {
      category.addEventListener('click', function () { self.backToCategory(); });
    }

    const intake = this.$('[data-action="intake"]');
    if (intake) {
      intake.addEventListener('click', function () { self.beginIntake(); });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-catalog')) {
  customElements.define('pnrx-catalog', PnrxCatalog);
}
