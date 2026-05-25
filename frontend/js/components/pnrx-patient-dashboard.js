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
import { money, formatDate, humanize } from '../utils/format.js';


export class PnrxPatientDashboard extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading',
      data: null,
      error: null,
      prefs: { emailEnabled: true, smsEnabled: false },
      prefsSaved: false,
    };
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
      // Notification preferences are non-critical: a failure here falls back
      // to the platform defaults rather than failing the whole dashboard.
      let prefs = { emailEnabled: true, smsEnabled: false };
      try {
        const pr = await api.get('/api/patient/notification-preferences');
        if (pr && pr.preferences) prefs = pr.preferences;
      } catch (prefErr) {
        prefs = { emailEnabled: true, smsEnabled: false };
      }
      this.setState({ status: 'ready', data: data, prefs: prefs });
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
    // Animated skeleton screen matching dashboard card layout
    const skelCard =
      '<div class="pnrx-dash__skel-card">' +
      '<div class="pnrx-dash__skel pnrx-dash__skel--title"></div>' +
      '<div class="pnrx-dash__skel pnrx-dash__skel--row"></div>' +
      '<div class="pnrx-dash__skel pnrx-dash__skel--row"></div>' +
      '</div>';
    return (
      '<div class="pnrx-dash__skeleton">' +
      '<div class="pnrx-dash__skel pnrx-dash__skel--heading"></div>' +
      '<div class="pnrx-dash__skel pnrx-dash__skel--sub"></div>' +
      '<div class="pnrx-dash__stats">' +
      '<div class="pnrx-dash__stat pnrx-dash__stat--skel"><div class="pnrx-dash__skel pnrx-dash__skel--value"></div><div class="pnrx-dash__skel pnrx-dash__skel--label"></div></div>' +
      '<div class="pnrx-dash__stat pnrx-dash__stat--skel"><div class="pnrx-dash__skel pnrx-dash__skel--value"></div><div class="pnrx-dash__skel pnrx-dash__skel--label"></div></div>' +
      '<div class="pnrx-dash__stat pnrx-dash__stat--skel"><div class="pnrx-dash__skel pnrx-dash__skel--value"></div><div class="pnrx-dash__skel pnrx-dash__skel--label"></div></div>' +
      '<div class="pnrx-dash__stat pnrx-dash__stat--skel"><div class="pnrx-dash__skel pnrx-dash__skel--value"></div><div class="pnrx-dash__skel pnrx-dash__skel--label"></div></div>' +
      '</div>' +
      skelCard + skelCard +
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
      this.renderNotificationPrefs() +
      '<p class="pnrx-dash__legal">All Clinical Services Are Provided By ' +
      'Independent, Licensed Practitioners. PepNationRX Acts Solely As The ' +
      'Designated Billing Agent.</p>'
    );
  }

  renderSummary(summary) {
    // SVG icons for each stat card — clinical line art, no emojis
    const STAT_ICONS = [
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M8 2v4M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/></svg>',
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/></svg>',
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>',
    ];
    const cards = [
      { label: 'Active Subscriptions', value: summary.activeSubscriptionCount || 0 },
      { label: 'Prescriptions', value: summary.prescriptionCount || 0 },
      { label: 'Open Shipments', value: summary.openOrderCount || 0 },
      { label: 'Lifetime Spend', value: money(summary.lifetimeSpendCents || 0) },
    ];
    const items = cards
      .map(function (card, i) {
        return (
          '<div class="pnrx-dash__stat">' +
          '<span class="pnrx-dash__stat-icon">' + STAT_ICONS[i] + '</span>' +
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
    // Quick-action bar below stats
    const actions =
      '<div class="pnrx-dash__actions">' +
      '<a href="#/intake" class="pnrx-dash__action">' +
      '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>' +
      'Start New Intake</a>' +
      '<a href="#/catalog" class="pnrx-dash__action">' +
      '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
      'Browse Treatments</a>' +
      '</div>';
    return '<div class="pnrx-dash__stats">' + items + '</div>' + actions;
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
        return self.subscriptionRow(s);
      })
      .join('');
    return this.section('Your Subscriptions', rows, 'You Have No Subscriptions Yet.');
  }

  // One subscription row with self-service controls. An active or trialing
  // plan can be paused or canceled; a paused plan can be resumed or canceled;
  // a past_due plan can only be canceled; a canceled or expired plan shows no
  // controls. Action buttons are omitted entirely in demo mode, which has no
  // authenticated API session.
  subscriptionRow(s) {
    // Guard: if id is missing there is no safe way to build action URLs.
    if (!s || !s.id) return '';
    const detail =
      'Next Billing ' + formatDate(s.next_billing_date, 'Not Scheduled');
    const kind =
      s.status === 'active' || s.status === 'trialing'
        ? 'good'
        : s.status === 'past_due'
          ? 'warn'
          : 'neutral';
    const pill =
      '<span class="pnrx-dash__pill pnrx-dash__pill--' +
      kind +
      '">' +
      escapeHtml(humanize(s.status)) +
      '</span>';

    let buttons = '';
    if (this.getAttribute('mode') !== 'demo') {
      const id = escapeHtml(String(s.id || ''));
      const pauseBtn =
        '<button type="button" class="pnrx-dash__btn pnrx-dash__btn--sm" ' +
        'data-sub-action="pause" data-sub-id="' + id + '">Pause</button>';
      const resumeBtn =
        '<button type="button" class="pnrx-dash__btn pnrx-dash__btn--sm" ' +
        'data-sub-action="resume" data-sub-id="' + id + '">Resume</button>';
      const cancelBtn =
        '<button type="button" ' +
        'class="pnrx-dash__btn pnrx-dash__btn--sm pnrx-dash__btn--danger" ' +
        'data-sub-action="cancel" data-sub-id="' + id + '">Cancel</button>';
      if (s.status === 'active' || s.status === 'trialing') {
        buttons = pauseBtn + cancelBtn;
      } else if (s.status === 'paused') {
        buttons = resumeBtn + cancelBtn;
      } else if (s.status === 'past_due') {
        buttons = cancelBtn;
      }
    }
    const actions = buttons
      ? '<div class="pnrx-dash__row-actions">' + buttons + '</div>'
      : '';

    return (
      '<div class="pnrx-dash__row pnrx-dash__row--sub">' +
      '<div class="pnrx-dash__row-main">' +
      '<span class="pnrx-dash__row-primary">' +
      escapeHtml(s.plan_name || humanize(s.protocol_category)) +
      '</span>' +
      '<span class="pnrx-dash__row-secondary">' +
      escapeHtml(detail) +
      '</span>' +
      '</div>' +
      pill +
      actions +
      '</div>'
    );
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

  // The notification-preferences panel: a per-channel opt-in the patient can
  // change. Email is on by default; SMS is off until that channel ships.
  renderNotificationPrefs() {
    const prefs = this.state.prefs || { emailEnabled: true, smsEnabled: false };
    const emailChecked = prefs.emailEnabled !== false ? ' checked' : '';
    const smsChecked = prefs.smsEnabled === true ? ' checked' : '';
    const savedNote = this.state.prefsSaved
      ? '<p class="pnrx-dash__empty">Your Preferences Have Been Saved.</p>'
      : '';
    return (
      '<section class="pnrx-dash__card">' +
      '<h3 class="pnrx-dash__card-title">Notification Preferences</h3>' +
      '<div class="pnrx-dash__list">' +
      '<label class="pnrx-dash__row">' +
      '<input type="checkbox" data-pref="email"' + emailChecked + ' />' +
      '<span class="pnrx-dash__row-primary">Email Notifications</span>' +
      '</label>' +
      '<label class="pnrx-dash__row">' +
      '<input type="checkbox" data-pref="sms"' + smsChecked + ' />' +
      '<span class="pnrx-dash__row-primary">Text Message Notifications</span>' +
      '</label>' +
      '</div>' +
      savedNote +
      '<button type="button" class="pnrx-dash__btn" data-action="save-prefs">' +
      'Save Preferences</button>' +
      '</section>'
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

    // Subscription self-service controls: pause, resume, or cancel. Skipped in
    // demo mode (the buttons are not rendered there). Cancel asks for explicit
    // confirmation because it cannot be undone. On success the dashboard is
    // reloaded so every panel reflects the new state.
    if (this.getAttribute('mode') !== 'demo') {
      this.$$('[data-sub-action]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const action = btn.getAttribute('data-sub-action');
          const id = btn.getAttribute('data-sub-id');
          if (!id) return;
          if (
            action === 'cancel' &&
            !window.confirm(
              'Cancel This Subscription? This Cannot Be Undone.'
            )
          ) {
            return;
          }
          btn.disabled = true;
          try {
            await api.patch(
              '/api/patient/subscriptions/' + encodeURIComponent(id),
              { action: action }
            );
            await self.load();
          } catch (e) {
            self.setState({
              status: 'error',
              error:
                e && e.message
                  ? e.message
                  : 'The Subscription Change Could Not Be Applied.',
            });
          }
        });
      });
    }

    // Save the notification preferences. Skipped in demo mode, which has no
    // authenticated API session.
    const savePrefs = this.$('[data-action="save-prefs"]');
    if (savePrefs && this.getAttribute('mode') !== 'demo') {
      savePrefs.addEventListener('click', async function () {
        const emailEl = self.$('[data-pref="email"]');
        const smsEl = self.$('[data-pref="sms"]');
        const body = {
          emailEnabled: emailEl ? emailEl.checked : true,
          smsEnabled: smsEl ? smsEl.checked : false,
        };
        try {
          const res = await api.put(
            '/api/patient/notification-preferences',
            body
          );
          self.setState({
            prefs: (res && res.preferences) || body,
            prefsSaved: true,
          });
        } catch (e) {
          self.setState({ prefsSaved: false });
        }
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-patient-dashboard')) {
  customElements.define('pnrx-patient-dashboard', PnrxPatientDashboard);
}
