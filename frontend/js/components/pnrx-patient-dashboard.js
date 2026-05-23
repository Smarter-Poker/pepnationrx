// ============================================================================
// pnrx-patient-dashboard - the PepNationRX patient dashboard.
// ----------------------------------------------------------------------------
// Fetches GET /api/patient/dashboard and renders the patient's profile,
// summary statistics, subscriptions, prescriptions, shipments, and billing.
//
// In demo mode (the `mode="demo"` attribute) the component does not call the
// API; a host page supplies data with renderData(payload).
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { api } from '../services/api.js';

// Format an integer cent amount as a dollar string.
function money(cents) {
  const value = Number(cents) || 0;
  return '$' + (value / 100).toFixed(2);
}

// Format an ISO date/timestamp as a short readable date, or a fallback.
function formatDate(value, fallback) {
  if (!value) return fallback || 'Not Available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback || 'Not Available';
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Convert a snake_case enum value into a Title Case label.
function humanize(value) {
  if (!value) return '';
  return String(value)
    .split('_')
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export class PnrxPatientDashboard extends PnrxComponent {
  constructor() {
    super();
    this.state = { status: 'loading', data: null, error: null };
  }

  connectedCallback() {
    this._performRender();
    if (this.getAttribute('mode') !== 'demo') {
      this.load();
    }
  }

  // Fetch the dashboard from the API.
  async load() {
    this.setState({ status: 'loading', error: null });
    try {
      const data = await api.get('/api/patient/dashboard');
      this.setState({ status: 'ready', data: data });
    } catch (err) {
      this.setState({
        status: 'error',
        error: err && err.message ? err.message : 'Your Dashboard Could Not Be Loaded.',
      });
    }
  }

  // Render a payload directly, bypassing the API. Used by the demo page.
  renderData(data) {
    this.setState({ status: 'ready', data: data });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.status === 'loading') {
      body = this.renderLoading();
    } else if (this.state.status === 'error') {
      body = this.renderError();
    } else {
      body = this.renderDashboard();
    }
    return '<div class="pnrx-dash">' + body + '</div>';
  }

  renderLoading() {
    return (
      '<div class="pnrx-dash__state">' +
      '<p class="pnrx-dash__state-text">Loading Your Dashboard</p>' +
      '</div>'
    );
  }

  renderError() {
    return (
      '<div class="pnrx-dash__state pnrx-dash__state--error">' +
      '<p class="pnrx-dash__state-text">' +
      escapeHtml(this.state.error) +
      '</p>' +
      '<button type="button" class="pnrx-dash__btn" data-action="retry">' +
      'Try Again</button>' +
      '</div>'
    );
  }

  renderDashboard() {
    const data = this.state.data || {};
    const profile = data.profile || {};
    const name = profile.first_name ? escapeHtml(profile.first_name) : 'Patient';
    return (
      '<header class="pnrx-dash__head">' +
      '<h2 class="pnrx-dash__title">Welcome Back, ' + name + '</h2>' +
      '<p class="pnrx-dash__sub">Your Treatments, Shipments, And Billing In One ' +
      'Place.</p>' +
      '</header>' +
      this.renderSummary(data.summary || {}) +
      this.renderSubscriptions(data.subscriptions || []) +
      this.renderPrescriptions(data.prescriptions || []) +
      this.renderOrders(data.orders || []) +
      this.renderBilling(data.billing || {}) +
      '<p class="pnrx-dash__legal">All Clinical Services Are Provided By ' +
      'Independent, Licensed Practitioners. PepNationRX Acts Solely As The ' +
      'Designated Billing Agent.</p>'
    );
  }

  renderSummary(summary) {
    const cards = [
      { label: 'Active Subscriptions', value: summary.activeSubscriptionCount || 0 },
      { label: 'Prescriptions', value: summary.prescriptionCount || 0 },
      { label: 'Open Shipments', value: summary.openOrderCount || 0 },
      { label: 'Lifetime Spend', value: money(summary.lifetimeSpendCents || 0) },
    ];
    const items = cards
      .map(function (card) {
        return (
          '<div class="pnrx-dash__stat">' +
          '<span class="pnrx-dash__stat-value">' +
          escapeHtml(String(card.value)) +
          '</span>' +
          '<span class="pnrx-dash__stat-label">' +
          escapeHtml(card.label) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
    return '<div class="pnrx-dash__stats">' + items + '</div>';
  }

  // Generic section wrapper: a titled card holding either rows or an empty
  // state message.
  section(title, rowsHtml, emptyText) {
    const inner = rowsHtml
      ? '<div class="pnrx-dash__list">' + rowsHtml + '</div>'
      : '<p class="pnrx-dash__empty">' + escapeHtml(emptyText) + '</p>';
    return (
      '<section class="pnrx-dash__card">' +
      '<h3 class="pnrx-dash__card-title">' +
      escapeHtml(title) +
      '</h3>' +
      inner +
      '</section>'
    );
  }

  // Build one list row: a primary label, a secondary detail, and a status pill.
  row(primary, secondary, statusText, statusKind) {
    const pill = statusText
      ? '<span class="pnrx-dash__pill pnrx-dash__pill--' +
        escapeHtml(statusKind || 'neutral') +
        '">' +
        escapeHtml(statusText) +
        '</span>'
      : '';
    return (
      '<div class="pnrx-dash__row">' +
      '<div class="pnrx-dash__row-main">' +
      '<span class="pnrx-dash__row-primary">' +
      escapeHtml(primary) +
      '</span>' +
      '<span class="pnrx-dash__row-secondary">' +
      escapeHtml(secondary) +
      '</span>' +
      '</div>' +
      pill +
      '</div>'
    );
  }

  renderSubscriptions(subscriptions) {
    const self = this;
    const rows = subscriptions
      .map(function (s) {
        const detail =
          'Next Billing ' + formatDate(s.next_billing_date, 'Not Scheduled');
        const kind = s.status === 'active' || s.status === 'trialing' ? 'good' :
          s.status === 'past_due' ? 'warn' : 'neutral';
        return self.row(
          s.plan_name || humanize(s.protocol_category),
          detail,
          humanize(s.status),
          kind
        );
      })
      .join('');
    return this.section('Your Subscriptions', rows, 'You Have No Subscriptions Yet.');
  }

  renderPrescriptions(prescriptions) {
    const self = this;
    const rows = prescriptions
      .map(function (rx) {
        const detail =
          (rx.strength ? rx.strength + ' - ' : '') +
          'Written ' +
          formatDate(rx.written_date, 'Pending');
        const kind = rx.status === 'active' || rx.status === 'approved' ? 'good' :
          rx.status === 'denied' || rx.status === 'discontinued' ? 'warn' : 'neutral';
        return self.row(
          rx.drug_compound || 'Prescription',
          detail,
          humanize(rx.status),
          kind
        );
      })
      .join('');
    return this.section(
      'Your Prescriptions',
      rows,
      'No Prescriptions Have Been Issued Yet.'
    );
  }

  renderOrders(orders) {
    const self = this;
    const rows = orders
      .map(function (o) {
        const tracking = o.tracking_number
          ? (o.tracking_carrier || 'Carrier').toUpperCase() + ' ' + o.tracking_number
          : 'Tracking Pending';
        const detail =
          tracking + ' - Est. ' + formatDate(o.estimated_delivery, 'To Be Confirmed');
        const kind = o.status === 'delivered' ? 'good' :
          o.status === 'exception' || o.status === 'canceled' ? 'warn' : 'neutral';
        return self.row('Shipment', detail, humanize(o.status), kind);
      })
      .join('');
    return this.section('Your Shipments', rows, 'No Shipments Are In Progress.');
  }

  renderBilling(billing) {
    const self = this;
    const transactions = billing.transactions || [];
    const rows = transactions
      .map(function (txn) {
        const kind = txn.status === 'succeeded' ? 'good' :
          txn.status === 'failed' || txn.status === 'disputed' ? 'warn' : 'neutral';
        return self.row(
          money(txn.gross_amount_cents),
          formatDate(txn.created_at, ''),
          humanize(txn.status),
          kind
        );
      })
      .join('');
    return this.section('Recent Billing', rows, 'No Charges Have Been Made Yet.');
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
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-patient-dashboard')) {
  customElements.define('pnrx-patient-dashboard', PnrxPatientDashboard);
}
