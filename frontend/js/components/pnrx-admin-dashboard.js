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
import { fetchAdminDashboard, fetchAuditLog } from '../services/admin.service.js';
import { money, formatStamp, humanize } from '../utils/format.js';

export class PnrxAdminDashboard extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading', // loading | ready | error
      dashboard: null,
      auditLog: [],
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
      const [dashboard, auditResult] = await Promise.all([
        fetchAdminDashboard(),
        fetchAuditLog(25),
      ]);
      this.setState({
        status: 'ready',
        dashboard: dashboard,
        auditLog: auditResult.entries || [],
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
  renderData(dashboard, auditEntries) {
    this.setState({
      status: 'ready',
      dashboard: dashboard,
      auditLog: auditEntries || [],
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
      this.renderAuditTable()
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
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-admin-dashboard')) {
  customElements.define('pnrx-admin-dashboard', PnrxAdminDashboard);
}
