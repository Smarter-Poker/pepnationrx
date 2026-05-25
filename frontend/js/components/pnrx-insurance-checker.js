// ============================================================================
// pnrx-insurance-checker - the patient insurance eligibility view.
// ----------------------------------------------------------------------------
// Lets a patient add an insurance policy, run a self-service eligibility
// check, and - when coverage is unclear or denied - request an assisted
// concierge review. Backed by /api/patient/insurance/*.
//
// In demo mode (the `mode="demo"` attribute) the component does not call the
// API; a host page supplies data with renderData(payload).
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { api } from '../services/api.js';
import { money } from '../utils/format.js';

// Protocol categories the patient can price, with patient-facing labels.
const CATEGORY_OPTIONS = [
  { value: 'weight_management', label: 'Weight Management' },
  { value: 'mens_optimization', label: "Men's Optimization" },
  { value: 'womens_wellness', label: "Women's Wellness" },
  { value: 'trt', label: 'TRT' },
  { value: 'peptide_therapy', label: 'Peptide Therapy' },
  { value: 'longevity', label: 'Longevity' },
  { value: 'sexual_health', label: 'Sexual Health' },
];

// How each eligibility status reads to the patient, and its pill kind.
const STATUS_DISPLAY = {
  eligible: { label: 'Likely Covered', kind: 'good' },
  not_eligible: { label: 'Not Covered', kind: 'warn' },
  needs_review: { label: 'Needs Review', kind: 'neutral' },
  error: { label: 'Could Not Check', kind: 'warn' },
  pending: { label: 'Pending', kind: 'neutral' },
};

// How each concierge state reads to the patient.
const CONCIERGE_DISPLAY = {
  not_requested: '',
  requested: 'Concierge Review Requested',
  in_progress: 'Concierge Review In Progress',
  resolved: 'Concierge Review Resolved',
  closed: 'Concierge Review Closed',
};

export class PnrxInsuranceChecker extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading',
      error: null,
      policies: [],
      checks: [],
      busy: false,
    };
  }

  connectedCallback() {
    this._performRender();
    if (this.getAttribute('mode') !== 'demo') {
      this.load();
    }
  }

  // Fetch policies and checks.
  async load() {
    this.setState({ status: 'loading', error: null });
    try {
      const [policiesRes, checksRes] = await Promise.all([
        api.get('/api/patient/insurance/policies'),
        api.get('/api/patient/insurance/checks'),
      ]);
      this.setState({
        status: 'ready',
        policies: (policiesRes && policiesRes.policies) || [],
        checks: (checksRes && checksRes.checks) || [],
        busy: false,
      });
    } catch (err) {
      this.setState({
        status: 'error',
        error:
          err && err.message
            ? err.message
            : 'Your Insurance Information Could Not Be Loaded.',
      });
    }
  }

  // Render a payload directly, bypassing the API. Used by the demo page.
  renderData(data) {
    this.setState({
      status: 'ready',
      policies: (data && data.policies) || [],
      checks: (data && data.checks) || [],
    });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.status === 'loading') {
      body = '<p class="pnrx-ins__notice">Loading Your Insurance...</p>';
    } else if (this.state.status === 'error') {
      body =
        '<div class="pnrx-ins__state pnrx-ins__state--error">' +
        '<p class="pnrx-ins__notice">' + escapeHtml(this.state.error) + '</p>' +
        '<button type="button" class="pnrx-ins__btn" data-action="retry">' +
        'Try Again</button>' +
        '</div>';
    } else {
      body =
        '<header class="pnrx-ins__head">' +
        '<h2 class="pnrx-ins__title">Insurance And Coverage</h2>' +
        '<p class="pnrx-ins__sub">Add Your Insurance, Check Whether A ' +
        'Protocol Category Is Covered, And Request A Concierge Review If You ' +
        'Need A Hand.</p>' +
        '</header>' +
        this.renderPolicies() +
        this.renderCheckForm() +
        this.renderHistory();
    }
    return '<div class="pnrx-ins">' + body + '</div>';
  }

  renderPolicies() {
    const policies = this.state.policies || [];
    let rows;
    if (policies.length === 0) {
      rows =
        '<p class="pnrx-ins__empty">No Insurance On File Yet. Add A Policy ' +
        'Below.</p>';
    } else {
      rows = policies
        .map(function (p) {
          return (
            '<div class="pnrx-ins__row">' +
            '<div class="pnrx-ins__row-main">' +
            '<span class="pnrx-ins__row-primary">' +
            escapeHtml(p.carrierName) +
            (p.planName ? ' - ' + escapeHtml(p.planName) : '') +
            '</span>' +
            '<span class="pnrx-ins__row-secondary">Member ID ' +
            escapeHtml(p.memberIdMasked || 'On File') + '</span>' +
            '</div>' +
            '</div>'
          );
        })
        .join('');
    }
    return (
      '<section class="pnrx-ins__card">' +
      '<h3 class="pnrx-ins__card-title">Your Insurance</h3>' +
      '<div class="pnrx-ins__list">' + rows + '</div>' +
      '<form class="pnrx-ins__form" data-action="add-policy">' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-carrier">Carrier Name</label>' +
      '<input id="pnrx-ins-carrier" class="pnrx-ins__input" data-field="carrierName" ' +
      'type="text" maxlength="120" placeholder="Carrier Name" required />' +
      '</div>' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-member">Member ID</label>' +
      '<input id="pnrx-ins-member" class="pnrx-ins__input" data-field="memberId" ' +
      'type="text" maxlength="64" placeholder="Member ID" required />' +
      '</div>' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-group">Group Number</label>' +
      '<input id="pnrx-ins-group" class="pnrx-ins__input" data-field="groupNumber" ' +
      'type="text" maxlength="64" placeholder="Group Number (Optional)" />' +
      '</div>' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-plan">Plan Name</label>' +
      '<input id="pnrx-ins-plan" class="pnrx-ins__input" data-field="planName" ' +
      'type="text" maxlength="120" placeholder="Plan Name (Optional)" />' +
      '</div>' +
      '<button type="submit" class="pnrx-ins__btn"' +
      (this.state.busy ? ' disabled' : '') + '>Add Policy</button>' +
      '</form>' +
      '</section>'
    );
  }

  renderCheckForm() {
    const policies = this.state.policies || [];
    if (policies.length === 0) return '';
    const policyOptions = policies
      .map(function (p) {
        return (
          '<option value="' + escapeHtml(p.id) + '">' +
          escapeHtml(p.carrierName) +
          (p.planName ? ' - ' + escapeHtml(p.planName) : '') +
          '</option>'
        );
      })
      .join('');
    const categoryOptions = CATEGORY_OPTIONS
      .map(function (c) {
        return '<option value="' + c.value + '">' + c.label + '</option>';
      })
      .join('');
    return (
      '<section class="pnrx-ins__card">' +
      '<h3 class="pnrx-ins__card-title">Check Coverage</h3>' +
      '<form class="pnrx-ins__form" data-action="run-check">' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-policy">Insurance Policy</label>' +
      '<select id="pnrx-ins-policy" class="pnrx-ins__input" data-field="policyId">' +
      policyOptions +
      '</select>' +
      '</div>' +
      '<div class="pnrx-ins__field">' +
      '<label class="pnrx-ins__label" for="pnrx-ins-category">Protocol Category</label>' +
      '<select id="pnrx-ins-category" class="pnrx-ins__input" data-field="protocolCategory">' +
      categoryOptions +
      '</select>' +
      '</div>' +
      '<button type="submit" class="pnrx-ins__btn"' +
      (this.state.busy ? ' disabled' : '') + '>Check Eligibility</button>' +
      '</form>' +
      '</section>'
    );
  }

  renderHistory() {
    const checks = this.state.checks || [];
    if (checks.length === 0) return '';
    const self = this;
    const rows = checks
      .map(function (c) {
        return self.renderCheckRow(c);
      })
      .join('');
    return (
      '<section class="pnrx-ins__card">' +
      '<h3 class="pnrx-ins__card-title">Eligibility Results</h3>' +
      '<div class="pnrx-ins__list">' + rows + '</div>' +
      '</section>'
    );
  }

  renderCheckRow(check) {
    const display = STATUS_DISPLAY[check.status] ||
      { label: check.status, kind: 'neutral' };
    const pill =
      '<span class="pnrx-ins__pill pnrx-ins__pill--' + display.kind + '">' +
      escapeHtml(display.label) + '</span>';

    const costParts = [];
    if (typeof check.copayCents === 'number') {
      costParts.push('Estimated Copay ' + money(check.copayCents));
    }
    if (typeof check.deductibleCents === 'number' && check.deductibleCents > 0) {
      costParts.push('Deductible ' + money(check.deductibleCents));
    }
    const costLine = costParts.length
      ? '<p class="pnrx-ins__cost">' + escapeHtml(costParts.join('  -  ')) + '</p>'
      : '';

    const conciergeLabel = CONCIERGE_DISPLAY[check.conciergeState] || '';
    const conciergeLine = conciergeLabel
      ? '<p class="pnrx-ins__concierge-state">' +
        escapeHtml(conciergeLabel) + '</p>'
      : '';

    // The concierge button shows only when a review has not been requested
    // yet and the result is one a human should look at.
    const offerConcierge =
      check.conciergeState === 'not_requested' &&
      (check.status === 'needs_review' ||
        check.status === 'not_eligible' ||
        check.status === 'error');
    const conciergeBtn = offerConcierge
      ? '<button type="button" class="pnrx-ins__btn pnrx-ins__btn--ghost" ' +
        'data-concierge-id="' + escapeHtml(check.id) + '"' +
        (this.state.busy ? ' disabled' : '') +
        '>Request Concierge Help</button>'
      : '';

    return (
      '<div class="pnrx-ins__check">' +
      '<div class="pnrx-ins__check-head">' +
      '<span class="pnrx-ins__row-primary">Coverage Check</span>' +
      pill +
      '</div>' +
      '<p class="pnrx-ins__summary">' +
      escapeHtml(check.coverageSummary || 'No Summary Available.') + '</p>' +
      costLine +
      conciergeLine +
      conciergeBtn +
      '</div>'
    );
  }

  // -- Event binding ---------------------------------------------------------

  afterRender() {
    const self = this;

    const retry = this.$('[data-action="retry"]');
    if (retry) {
      retry.addEventListener('click', function () {
        self.load();
      });
    }

    if (this.getAttribute('mode') === 'demo') return;

    const addForm = this.$('[data-action="add-policy"]');
    if (addForm) {
      addForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (self.state.busy) return;
        const body = {
          carrierName: self.fieldValue('carrierName'),
          memberId: self.fieldValue('memberId'),
          groupNumber: self.fieldValue('groupNumber'),
          planName: self.fieldValue('planName'),
        };
        if (body.carrierName === '' || body.memberId === '') return;
        self.setState({ busy: true });
        try {
          await api.post('/api/patient/insurance/policies', body);
          await self.load();
        } catch (err) {
          self.fail(err, 'Your Policy Could Not Be Saved.');
        }
      });
    }

    const checkForm = this.$('[data-action="run-check"]');
    if (checkForm) {
      checkForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (self.state.busy) return;
        const body = {
          policyId: self.fieldValue('policyId'),
          protocolCategory: self.fieldValue('protocolCategory'),
        };
        if (body.policyId === '') return;
        self.setState({ busy: true });
        try {
          await api.post('/api/patient/insurance/checks', body);
          await self.load();
        } catch (err) {
          self.fail(err, 'Your Eligibility Check Could Not Be Completed.');
        }
      });
    }

    this.$$('[data-concierge-id]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (self.state.busy) return;
        const id = btn.getAttribute('data-concierge-id');
        if (!id) return;
        self.setState({ busy: true });
        try {
          await api.post(
            '/api/patient/insurance/checks/' + encodeURIComponent(id) +
              '/concierge'
          );
          await self.load();
        } catch (err) {
          self.fail(err, 'Your Concierge Request Could Not Be Sent.');
        }
      });
    });
  }

  // Read a trimmed value from a data-field input or select.
  fieldValue(field) {
    const el = this.$('[data-field="' + field + '"]');
    return el ? String(el.value || '').trim() : '';
  }

  // Surface an error and clear the busy flag.
  fail(err, fallback) {
    this.setState({
      status: 'error',
      busy: false,
      error: err && err.message ? err.message : fallback,
    });
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-insurance-checker')) {
  customElements.define('pnrx-insurance-checker', PnrxInsuranceChecker);
}
