// ============================================================================
// pnrx-membership - the PepNationRX Plus membership view.
// ----------------------------------------------------------------------------
// For a non-member this is the upsell: the Plus perks, the price, and an
// enroll button. For a member it is the membership card: status, renewal
// date, perks, and a cancel button. Backed by /api/patient/membership.
//
// In demo mode (the `mode="demo"` attribute) the component does not call the
// API; a host page supplies data with renderData(payload).
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { api } from '../services/api.js';
import { money, formatDate } from '../utils/format.js';

export class PnrxMembership extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading',
      error: null,
      membership: null,
      perks: [],
      pricing: {},
      busy: false,
    };
  }

  connectedCallback() {
    this._performRender();
    if (this.getAttribute('mode') !== 'demo') {
      this.load();
    }
  }

  // Fetch the membership, perks, and pricing. load() is the terminal step of
  // both enroll and cancel, so it always clears the busy flag - otherwise the
  // action button stays disabled after a successful enroll or cancel until the
  // page is reloaded.
  async load() {
    this.setState({ status: 'loading', error: null });
    try {
      const res = await api.get('/api/patient/membership');
      this.setState({
        status: 'ready',
        membership: (res && res.membership) || null,
        perks: (res && res.perks) || [],
        pricing: (res && res.pricing) || {},
        busy: false,
      });
    } catch (err) {
      this.setState({
        status: 'error',
        busy: false,
        error:
          err && err.message
            ? err.message
            : 'Your Membership Could Not Be Loaded.',
      });
    }
  }

  // Render a payload directly, bypassing the API. Used by the demo page.
  renderData(data) {
    this.setState({
      status: 'ready',
      membership: (data && data.membership) || null,
      perks: (data && data.perks) || [],
      pricing: (data && data.pricing) || {},
    });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.status === 'loading') {
      body = '<p class="pnrx-mem__notice">Loading Your Membership...</p>';
    } else if (this.state.status === 'error') {
      body =
        '<div class="pnrx-mem__state pnrx-mem__state--error">' +
        '<p class="pnrx-mem__notice">' + escapeHtml(this.state.error) + '</p>' +
        '<button type="button" class="pnrx-mem__btn" data-action="retry">' +
        'Try Again</button>' +
        '</div>';
    } else if (this.state.membership) {
      body = this.renderMemberCard();
    } else {
      body = this.renderUpsell();
    }
    return '<div class="pnrx-mem">' + body + '</div>';
  }

  // The perk list, shared by the member card and the upsell.
  renderPerks() {
    const perks = this.state.perks || [];
    if (perks.length === 0) return '';
    const items = perks
      .map(function (p) {
        return (
          '<li class="pnrx-mem__perk">' +
          '<span class="pnrx-mem__perk-label">' +
          escapeHtml(p.label) + '</span>' +
          '<span class="pnrx-mem__perk-desc">' +
          escapeHtml(p.description || '') + '</span>' +
          '</li>'
        );
      })
      .join('');
    return '<ul class="pnrx-mem__perks">' + items + '</ul>';
  }

  // Price line: "$19.99 Per Month".
  priceLine() {
    const cents = this.state.pricing.membershipPriceCents;
    if (typeof cents !== 'number') return 'PepNationRX Plus';
    return money(cents) + ' Per Month';
  }

  renderUpsell() {
    const discount = this.state.pricing.planDiscountPct;
    const discountLine =
      typeof discount === 'number'
        ? 'Members Save ' + discount + ' Percent On Every Plan, On Every ' +
          'Renewal.'
        : '';
    return (
      '<header class="pnrx-mem__head">' +
      '<h2 class="pnrx-mem__title">Become A PepNationRX Plus Member</h2>' +
      '<p class="pnrx-mem__sub">' + escapeHtml(discountLine) + '</p>' +
      '</header>' +
      '<section class="pnrx-mem__card">' +
      '<div class="pnrx-mem__price">' +
      escapeHtml(this.priceLine()) +
      '</div>' +
      this.renderPerks() +
      '<button type="button" class="pnrx-mem__btn" data-action="enroll"' +
      (this.state.busy ? ' disabled' : '') +
      '>Join PepNationRX Plus</button>' +
      '<p class="pnrx-mem__fineprint">Your Membership Renews Monthly. You ' +
      'Can Cancel Anytime.</p>' +
      '</section>'
    );
  }

  renderMemberCard() {
    const m = this.state.membership;
    return (
      '<header class="pnrx-mem__head">' +
      '<h2 class="pnrx-mem__title">You Are A PepNationRX Plus Member</h2>' +
      '<p class="pnrx-mem__sub">Your Member Pricing Is Applied ' +
      'Automatically At Checkout.</p>' +
      '</header>' +
      '<section class="pnrx-mem__card">' +
      '<div class="pnrx-mem__status-row">' +
      '<span class="pnrx-mem__pill pnrx-mem__pill--good">Active</span>' +
      '<span class="pnrx-mem__renews">Renews ' +
      escapeHtml(formatDate(m.renewsAt, 'Soon')) + '</span>' +
      '</div>' +
      '<div class="pnrx-mem__price">' +
      escapeHtml(money(m.priceCents) + ' Per Month') +
      '</div>' +
      this.renderPerks() +
      '<button type="button" ' +
      'class="pnrx-mem__btn pnrx-mem__btn--danger" data-action="cancel"' +
      (this.state.busy ? ' disabled' : '') +
      '>Cancel Membership</button>' +
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

    if (this.getAttribute('mode') === 'demo') return;

    const enroll = this.$('[data-action="enroll"]');
    if (enroll) {
      enroll.addEventListener('click', async function () {
        if (self.state.busy) return;
        self.setState({ busy: true });
        try {
          await api.post('/api/patient/membership');
          await self.load();
        } catch (err) {
          self.fail(err, 'Your Membership Could Not Be Started.');
        }
      });
    }

    const cancel = this.$('[data-action="cancel"]');
    if (cancel) {
      cancel.addEventListener('click', async function () {
        if (self.state.busy) return;
        if (
          !window.confirm(
            'Cancel Your PepNationRX Plus Membership? You Will Lose Member ' +
              'Pricing And Perks.'
          )
        ) {
          return;
        }
        self.setState({ busy: true });
        try {
          await api.del('/api/patient/membership');
          await self.load();
        } catch (err) {
          self.fail(err, 'Your Membership Could Not Be Canceled.');
        }
      });
    }
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
if (!customElements.get('pnrx-membership')) {
  customElements.define('pnrx-membership', PnrxMembership);
}
