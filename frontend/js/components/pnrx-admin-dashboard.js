// ============================================================================
// pnrx-admin-dashboard - the PepNationRX staff operations dashboard.
// ----------------------------------------------------------------------------
// Fetches GET /api/admin/dashboard and GET /api/admin/audit-log and renders the
// platform overview: revenue, user and subscription counts, the open-intake
// queue size, and the recent audit trail. The endpoints are staff-gated
// server-side, so a non-staff session simply sees a load error.
//
// In demo mode (the `mode="demo"` attribute) the component does not call the
// API; a host page supplies data with renderData(dashboard, auditEntries).
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import {
  fetchAdminDashboard,
  fetchAuditLog,
  fetchCoupons,
  createCoupon,
  updateCoupon,
} from '../services/admin.service.js';
import { money, formatStamp, humanize } from '../utils/format.js';

// A blank coupon create form.
function emptyCouponForm() {
  return {
    code: '',
    type: 'percent',
    value: '',
    maxRedemptions: '',
    perUserLimit: '',
    minSubtotalCents: '',
    description: '',
  };
}

export class PnrxAdminDashboard extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading', // loading | ready | error
      dashboard: null,
      auditLog: [],
      coupons: [],
      couponForm: emptyCouponForm(),
      couponBusy: false,
      couponError: null,
      couponNotice: null,
      error: null,
    };
  }

  connectedCallback() {
    this._performRender();
    if (this.getAttribute('mode') !== 'demo') {
      this.load();
    }
  }

  // Fetch the dashboard and the audit log together.
  async load() {
    this.setState({ status: 'loading', error: null });
    try {
      const [dashboard, auditResult, couponResult] = await Promise.all([
        fetchAdminDashboard(),
        fetchAuditLog(25),
        fetchCoupons(),
      ]);
      this.setState({
        status: 'ready',
        dashboard: dashboard,
        auditLog: auditResult.entries || [],
        coupons: couponResult.coupons || [],
      });
    } catch (err) {
      this.setState({
        status: 'error',
        error:
          err && err.message
            ? err.message
            : 'The Admin Dashboard Could Not Be Loaded.',
      });
    }
  }

  // Render supplied data directly, bypassing the API. Used by the demo page.
  renderData(dashboard, auditEntries, coupons) {
    this.setState({
      status: 'ready',
      dashboard: dashboard,
      auditLog: auditEntries || [],
      coupons: coupons || [],
    });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.status === 'loading') {
      body = this.renderState('Loading The Admin Dashboard', false);
    } else if (this.state.status === 'error') {
      body = this.renderState(this.state.error, true);
    } else {
      body = this.renderDashboard();
    }
    return '<div class="pnrx-admin">' + body + '</div>';
  }

  renderState(text, isError) {
    const cls = isError
      ? 'pnrx-admin__state pnrx-admin__state--error'
      : 'pnrx-admin__state';
    const retry = isError
      ? '<button type="button" class="pnrx-admin__btn" data-action="retry">' +
        'Try Again</button>'
      : '';
    return (
      '<div class="' + cls + '">' +
      '<p class="pnrx-admin__state-text">' + escapeHtml(text) + '</p>' +
      retry +
      '</div>'
    );
  }

  renderDashboard() {
    const d = this.state.dashboard || {};
    const summary = d.summary || {};
    return (
      '<header class="pnrx-admin__head">' +
      '<h2 class="pnrx-admin__title">Platform Operations</h2>' +
      '<p class="pnrx-admin__sub">A Staff Overview Of Revenue, Accounts, And ' +
      'The Clinical Review Queue.</p>' +
      '</header>' +
      this.renderStatGrid(summary) +
      this.renderCountTable(
        'Accounts By Role',
        d.usersByRole || [],
        'role'
      ) +
      this.renderCountTable(
        'Subscriptions By Status',
        d.subscriptionsByStatus || [],
        'status'
      ) +
      this.renderCoupons() +
      this.renderAuditTable()
    );
  }

  // The coupon management panel: a create form and the list of every coupon
  // with an activate / deactivate control.
  renderCoupons() {
    const notice = this.state.couponNotice
      ? '<p class="pnrx-admin__coupon-notice" role="status">' +
        escapeHtml(this.state.couponNotice) +
        '</p>'
      : '';
    const error = this.state.couponError
      ? '<p class="pnrx-admin__coupon-error" role="alert">' +
        escapeHtml(this.state.couponError) +
        '</p>'
      : '';
    return (
      '<section class="pnrx-admin__section">' +
      '<h3 class="pnrx-admin__section-title">Discount Coupons</h3>' +
      this.renderCouponForm() +
      notice +
      error +
      this.renderCouponTable() +
      '</section>'
    );
  }

  renderCouponForm() {
    const f = this.state.couponForm;
    const busy = this.state.couponBusy;
    function opt(value, label, selected) {
      return (
        '<option value="' +
        value +
        '"' +
        (selected ? ' selected' : '') +
        '>' +
        label +
        '</option>'
      );
    }
    return (
      '<div class="pnrx-admin__coupon-form">' +
      '<input type="text" data-coupon-field="code" placeholder="Code" ' +
      'value="' + escapeHtml(f.code) + '" />' +
      '<select data-coupon-field="type">' +
      opt('percent', 'Percent', f.type === 'percent') +
      opt('fixed', 'Fixed (Cents)', f.type === 'fixed') +
      '</select>' +
      '<input type="text" data-coupon-field="value" ' +
      'placeholder="Value" value="' + escapeHtml(f.value) + '" />' +
      '<input type="text" data-coupon-field="maxRedemptions" ' +
      'placeholder="Max Uses" value="' + escapeHtml(f.maxRedemptions) + '" />' +
      '<input type="text" data-coupon-field="perUserLimit" ' +
      'placeholder="Per User" value="' + escapeHtml(f.perUserLimit) + '" />' +
      '<input type="text" data-coupon-field="minSubtotalCents" ' +
      'placeholder="Min Order (Cents)" value="' +
      escapeHtml(f.minSubtotalCents) + '" />' +
      '<input type="text" data-coupon-field="description" ' +
      'placeholder="Description" value="' + escapeHtml(f.description) + '" />' +
      '<button type="button" class="pnrx-admin__btn" ' +
      'data-action="create-coupon"' + (busy ? ' disabled' : '') + '>' +
      (busy ? 'Saving' : 'Create Coupon') +
      '</button>' +
      '</div>'
    );
  }

  renderCouponTable() {
    const rows = this.state.coupons || [];
    if (!rows.length) {
      return '<p class="pnrx-admin__empty">No Coupons Yet.</p>';
    }
    const body = rows
      .map(function (c) {
        const value =
          c.type === 'percent'
            ? c.value + ' Percent'
            : money(c.value);
        const uses =
          String(c.redemptionCount) +
          (c.maxRedemptions != null ? ' / ' + c.maxRedemptions : '');
        const statusTag = c.isActive
          ? '<span class="pnrx-admin__tag pnrx-admin__tag--good">Active</span>'
          : '<span class="pnrx-admin__tag">Inactive</span>';
        const toggleLabel = c.isActive ? 'Deactivate' : 'Activate';
        return (
          '<tr>' +
          '<td>' + escapeHtml(c.code) + '</td>' +
          '<td>' + escapeHtml(humanize(c.type)) + '</td>' +
          '<td>' + escapeHtml(value) + '</td>' +
          '<td class="pnrx-admin__num">' + escapeHtml(uses) + '</td>' +
          '<td>' + statusTag + '</td>' +
          '<td><button type="button" class="pnrx-admin__btn ' +
          'pnrx-admin__btn--sm" data-toggle-coupon="' + escapeHtml(c.id) +
          '" data-coupon-active="' + (c.isActive ? '1' : '0') + '">' +
          toggleLabel + '</button></td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<table class="pnrx-admin__table">' +
      '<thead><tr><th>Code</th><th>Type</th><th>Value</th>' +
      '<th class="pnrx-admin__num">Uses</th><th>Status</th>' +
      '<th>Action</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' +
      '</table>'
    );
  }

  renderStatGrid(summary) {
    const cards = [
      { label: 'Live Monthly Recurring Revenue', value: money(summary.liveMrrCents) },
      { label: 'Settled Gross Revenue', value: money(summary.settledGrossCents) },
      {
        label: 'Settled Transactions',
        value: String(summary.settledTransactionCount || 0),
      },
      {
        label: 'Open Intake Queue',
        value: String(summary.openIntakeCount || 0),
      },
    ];
    const items = cards
      .map(function (card) {
        return (
          '<div class="pnrx-admin__stat">' +
          '<span class="pnrx-admin__stat-value">' +
          escapeHtml(card.value) +
          '</span>' +
          '<span class="pnrx-admin__stat-label">' +
          escapeHtml(card.label) +
          '</span>' +
          '</div>'
        );
      })
      .join('');
    return '<div class="pnrx-admin__stats">' + items + '</div>';
  }

  renderCountTable(title, rows, keyName) {
    if (!rows.length) {
      return (
        '<section class="pnrx-admin__section">' +
        '<h3 class="pnrx-admin__section-title">' + escapeHtml(title) + '</h3>' +
        '<p class="pnrx-admin__empty">No Records Yet.</p>' +
        '</section>'
      );
    }
    const body = rows
      .map(function (row) {
        return (
          '<tr><td>' +
          escapeHtml(humanize(row[keyName])) +
          '</td><td class="pnrx-admin__num">' +
          escapeHtml(String(row.count)) +
          '</td></tr>'
        );
      })
      .join('');
    return (
      '<section class="pnrx-admin__section">' +
      '<h3 class="pnrx-admin__section-title">' + escapeHtml(title) + '</h3>' +
      '<table class="pnrx-admin__table">' +
      '<thead><tr><th>' + escapeHtml(humanize(keyName)) +
      '</th><th class="pnrx-admin__num">Count</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' +
      '</table>' +
      '</section>'
    );
  }

  renderAuditTable() {
    const rows = this.state.auditLog;
    if (!rows.length) {
      return (
        '<section class="pnrx-admin__section">' +
        '<h3 class="pnrx-admin__section-title">Recent Audit Activity</h3>' +
        '<p class="pnrx-admin__empty">No Audit Entries Yet.</p>' +
        '</section>'
      );
    }
    const body = rows
      .map(function (entry) {
        const phi = entry.phi_accessed
          ? '<span class="pnrx-admin__tag">PHI</span>'
          : '';
        return (
          '<tr>' +
          '<td>' + escapeHtml(formatStamp(entry.occurred_at)) + '</td>' +
          '<td>' + escapeHtml(entry.action || '') + ' ' + phi + '</td>' +
          '<td>' + escapeHtml(humanize(entry.actor_role) || 'System') + '</td>' +
          '<td>' + escapeHtml(entry.entity_type || '') + '</td>' +
          '</tr>'
        );
      })
      .join('');
    return (
      '<section class="pnrx-admin__section">' +
      '<h3 class="pnrx-admin__section-title">Recent Audit Activity</h3>' +
      '<table class="pnrx-admin__table">' +
      '<thead><tr><th>When</th><th>Action</th><th>Actor Role</th>' +
      '<th>Entity</th></tr></thead>' +
      '<tbody>' + body + '</tbody>' +
      '</table>' +
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

    const createBtn = this.$('[data-action="create-coupon"]');
    if (createBtn) {
      createBtn.addEventListener('click', function () {
        self.submitCoupon();
      });
    }

    this.$$('[data-toggle-coupon]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.toggleCoupon(
          btn.getAttribute('data-toggle-coupon'),
          btn.getAttribute('data-coupon-active') === '1'
        );
      });
    });
  }

  // -- Coupon actions --------------------------------------------------------

  // Read the coupon create form straight from the DOM. The form fields are not
  // bound to state per keystroke - the base component re-renders by replacing
  // innerHTML, which would drop input focus on every character - so the values
  // are collected only when an action runs.
  readCouponForm() {
    const self = this;
    function read(name) {
      const el = self.$('[data-coupon-field="' + name + '"]');
      return el ? el.value : '';
    }
    return {
      code: read('code'),
      type: read('type'),
      value: read('value'),
      maxRedemptions: read('maxRedemptions'),
      perUserLimit: read('perUserLimit'),
      minSubtotalCents: read('minSubtotalCents'),
      description: read('description'),
    };
  }

  // Create a coupon from the form. Optional numeric fields are omitted when
  // left blank so the backend applies its defaults.
  async submitCoupon() {
    if (this.state.couponBusy) return;
    const form = this.readCouponForm();
    const code = form.code.trim();
    const value = parseInt(form.value, 10);
    if (code === '' || !Number.isInteger(value) || value <= 0) {
      this.setState({
        couponForm: form,
        couponError: 'A Code And A Positive Value Are Required.',
        couponNotice: null,
      });
      return;
    }

    const payload = { code: code, type: form.type, value: value };
    function optPositiveInt(name, raw) {
      const n = parseInt(raw, 10);
      if (Number.isInteger(n) && n > 0) payload[name] = n;
    }
    optPositiveInt('maxRedemptions', form.maxRedemptions);
    optPositiveInt('perUserLimit', form.perUserLimit);
    const minSub = parseInt(form.minSubtotalCents, 10);
    if (Number.isInteger(minSub) && minSub >= 0) {
      payload.minSubtotalCents = minSub;
    }
    if (form.description.trim() !== '') {
      payload.description = form.description.trim();
    }

    this.setState({
      couponBusy: true,
      couponError: null,
      couponNotice: null,
      couponForm: form,
    });
    try {
      await createCoupon(payload);
      this.setState({
        couponBusy: false,
        couponForm: emptyCouponForm(),
        couponNotice: 'Coupon ' + code.toUpperCase() + ' Created.',
        couponError: null,
      });
      await this.load();
    } catch (err) {
      this.setState({
        couponBusy: false,
        couponForm: form,
        couponError:
          err && err.message
            ? err.message
            : 'The Coupon Could Not Be Created.',
      });
    }
  }

  // Activate or deactivate a coupon.
  async toggleCoupon(couponId, isCurrentlyActive) {
    if (this.state.couponBusy) return;
    this.setState({
      couponBusy: true,
      couponError: null,
      couponNotice: null,
      couponForm: this.readCouponForm(),
    });
    try {
      await updateCoupon(couponId, { isActive: !isCurrentlyActive });
      this.setState({ couponBusy: false });
      await this.load();
    } catch (err) {
      this.setState({
        couponBusy: false,
        couponError:
          err && err.message
            ? err.message
            : 'The Coupon Could Not Be Updated.',
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-admin-dashboard')) {
  customElements.define('pnrx-admin-dashboard', PnrxAdminDashboard);
}
