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
    const plan =
      treatment.plans.filter(function (p) {
        return p.cadenceMonths === this.state.selectedCadence;
      }, this)[0] || defaultPlan(treatment);
    this.emit('catalog:select', {
      treatmentSlug: treatment.slug,
      treatmentName: treatment.name,
      categorySlug: treatment.categorySlug,
      protocolCategory: treatment.protocolCategory,
      prescriptionRequired: treatment.prescriptionRequired,
      planCadenceMonths: plan ? plan.cadenceMonths : null,
      planPriceCents: plan ? plan.priceCents : null,
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
        return (
          '<button type="button" class="pnrx-catalog__card" data-category="' +
          escapeHtml(category.slug) +
          '">' +
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

    return (
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
      '<p class="pnrx-catalog__legal">All Prescriptions Require A Clinical ' +
      'Intake Reviewed By An Independent, Licensed Provider. PepNationRX Acts ' +
      'Solely As The Designated Billing Agent.</p>'
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
