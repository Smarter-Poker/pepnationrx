// ============================================================================
// pnrx-affiliate-dashboard - the PepNationRX affiliate dashboard.
// ----------------------------------------------------------------------------
// Fetches GET /api/affiliate/dashboard and renders the affiliate's referral
// link, performance summary, referral funnel, and payout ledger. It reuses the
// shared pnrx-dash* primitives styled in css/components/dashboard.css.
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

// Format a 0..1 ratio as a whole-percent string.
function percent(ratio) {
  return Math.round((Number(ratio) || 0) * 100) + '%';
}

// Format an ISO date as a short readable date, or a fallback.
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

export class PnrxAffiliateDashboard extends PnrxComponent {
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
      const data = await api.get('/api/affiliate/dashboard');
      this.setState({ status: 'ready', data: data });
    } catch (err) {
      this.setState({
        status: 'error',
        error: err && err.message ? err.message : 'Your dashboard could not be loaded.',
      });
    }
  }

  // Render a payload directly, bypassing the API. Used by the demo page.
  renderData(data) {
    this.setState({ status: 'ready', data: data });
  }

  // The absolute referral URL a host application would resolve.
  referralUrl() {
    const data = this.state.data || {};
    const path = data.referralPath || '/';
    const origin =
      typeof window !== 'undefined' && window.location
        ? window.location.origin
        : '';
    return origin + path;
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
    const affiliate = data.affiliate || {};
    const org = affiliate.organization_name
      ? escapeHtml(affiliate.organization_name)
      : 'Affiliate';
    return (
      '<header class="pnrx-dash__head">' +
      '<h2 class="pnrx-dash__title">' + org + '</h2>' +
      '<p class="pnrx-dash__sub">Your Referral Performance And Revenue Share.</p>' +
      '</header>' +
      this.renderReferral() +
      this.renderSummary(data.summary || {}) +
      this.renderReferrals(data.referrals || []) +
      this.renderPayouts(data.payouts || []) +
      '<p class="pnrx-dash__legal">Revenue Share Is Paid On Tracked, Converted ' +
      'Referrals. PepNationRX Acts Solely As The Designated Billing Agent.</p>'
    );
  }

  renderReferral() {
    return (
      '<div class="pnrx-dash__referral">' +
      '<span class="pnrx-dash__referral-label">Your Referral Link</span>' +
      '<div class="pnrx-dash__referral-row">' +
      '<span class="pnrx-dash__referral-code">' +
      escapeHtml(this.referralUrl()) +
      '</span>' +
      '<button type="button" class="pnrx-dash__copy" data-action="copy">' +
      'Copy</button>' +
      '</div>' +
      '</div>'
    );
  }

  renderSummary(summary) {
    const cards = [
      { label: 'Referrals Landed', value: summary.referralsLanded || 0 },
      { label: 'Conversions', value: summary.referralsConverted || 0 },
      { label: 'Conversion Rate', value: percent(summary.conversionRate || 0) },
      {
        label: 'Estimated Monthly',
        value: money(summary.estimatedMonthlyEarningsCents || 0),
      },
      { label: 'Paid To Date', value: money(summary.paidToDateCents || 0) },
      { label: 'Pending Payout', value: money(summary.pendingPayoutCents || 0) },
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

  // Generic titled section with rows or an empty state.
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

  renderReferrals(referrals) {
    const self = this;
    const rows = referrals
      .map(function (r) {
        const converted = Boolean(r.converted_at);
        const detail = 'Landed ' + formatDate(r.landed_at, '');
        return self.row(
          r.referral_link_slug || 'Referral',
          detail,
          converted ? 'Converted' : 'Pending',
          converted ? 'good' : 'neutral'
        );
      })
      .join('');
    return this.section('Recent Referrals', rows, 'No Referrals Have Landed Yet.');
  }

  renderPayouts(payouts) {
    const self = this;
    const rows = payouts
      .map(function (p) {
        const period =
          formatDate(p.period_start, '') + ' To ' + formatDate(p.period_end, '');
        const kind = p.status === 'paid' ? 'good' :
          p.status === 'failed' ? 'warn' : 'neutral';
        return self.row(money(p.amount_cents), period, humanize(p.status), kind);
      })
      .join('');
    return this.section('Payout History', rows, 'No Payouts Have Been Issued Yet.');
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

    const copy = this.$('[data-action="copy"]');
    if (copy) {
      copy.addEventListener('click', function () {
        const url = self.referralUrl();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            copy.textContent = 'Copied';
            setTimeout(function () {
              copy.textContent = 'Copy';
            }, 2000);
          });
        }
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-affiliate-dashboard')) {
  customElements.define('pnrx-affiliate-dashboard', PnrxAffiliateDashboard);
}
