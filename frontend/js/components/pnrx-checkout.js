// ============================================================================
// pnrx-checkout - the PepNationRX checkout screen.
// ----------------------------------------------------------------------------
// The final step of the storefront flow. It receives a plan selection (set by
// the host with configure()), collects a shipping address, and presents the
// checkout layer of the mandatory consent gate: the MSO billing-agent
// disclosure and the telehealth informed-consent. Both must be accepted before
// the order can be placed.
//
// Placing the order calls POST /api/checkout via checkout.service and emits a
// "checkout:complete" CustomEvent on success, or "checkout:error" on failure.
// No card data is handled here: payment settles out of band per the platform
// payment rules.
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { ApiError } from '../services/api.js';
import { placeCheckout, CHECKOUT_CONSENT_VERSION } from '../services/checkout.service.js';

// The MSO billing-agent disclosure. Kept identical to the text in the backend
// constants module and ARCHITECTURE.md Section V.
const MSO_DISCLOSURE =
  'PepNationRX is a technology platform and management services organization. ' +
  'We do not provide medical advice or care. All clinical services are ' +
  'provided by independent, licensed medical practitioners. All compounded ' +
  'medications are fulfilled by licensed, independent 503A compounding ' +
  'pharmacies. By proceeding, you acknowledge that PepNationRX acts solely ' +
  'as the designated billing agent.';

// The telehealth informed-consent summary shown at checkout.
const TELEHEALTH_CONSENT =
  'I consent to receive care through telehealth. I understand that an ' +
  'independent, licensed provider will review my intake, that a treatment ' +
  'plan is issued only when clinically appropriate, and that I may decline ' +
  'or discontinue treatment at any time.';

// Format an integer cent amount as a US dollar string.
function formatPrice(cents) {
  return '$' + (Math.round(cents) / 100).toFixed(2);
}

export class PnrxCheckout extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      // Plan selection supplied by the host via configure().
      config: null,
      // Shipping address form fields.
      line1: '',
      line2: '',
      city: '',
      addrState: '',
      postalCode: '',
      // Optional referral.
      affiliateCode: '',
      // Consent checkbox states.
      consentMso: false,
      consentTelehealth: false,
      // Flow state.
      submitting: false,
      error: null,
      result: null,
    };
  }

  // Host entry point: hand the component the chosen plan. config carries
  // protocolCategory, planName, treatmentName, treatmentSlug, cadenceMonths,
  // pricePerMonthCents, and an optional affiliateCode.
  configure(config) {
    this.setState({
      config: config || null,
      affiliateCode: (config && config.affiliateCode) || '',
      error: null,
      result: null,
    });
  }

  // -- Derived values --------------------------------------------------------

  grossCents() {
    const c = this.state.config;
    if (!c) return 0;
    return c.pricePerMonthCents * c.cadenceMonths;
  }

  addressComplete() {
    const s = this.state;
    return (
      s.line1.trim() !== '' &&
      s.city.trim() !== '' &&
      s.addrState.trim().length === 2 &&
      s.postalCode.trim() !== ''
    );
  }

  canSubmit() {
    return (
      Boolean(this.state.config) &&
      this.addressComplete() &&
      this.state.consentMso &&
      this.state.consentTelehealth &&
      !this.state.submitting
    );
  }

  // -- Submission ------------------------------------------------------------

  async submit() {
    if (!this.canSubmit()) return;
    const s = this.state;
    const c = s.config;
    this.setState({ submitting: true, error: null });

    const order = {
      protocolCategory: c.protocolCategory,
      planName: c.planName,
      cadenceMonths: c.cadenceMonths,
      pricePerMonthCents: c.pricePerMonthCents,
      treatmentSlug: c.treatmentSlug || undefined,
      affiliateCode: s.affiliateCode.trim() || undefined,
      shippingAddress: {
        line1: s.line1.trim(),
        line2: s.line2.trim() || undefined,
        city: s.city.trim(),
        state: s.addrState.trim().toUpperCase(),
        postalCode: s.postalCode.trim(),
        country: 'US',
      },
      consents: [
        {
          consentType: 'mso_billing_agent',
          documentVersion: CHECKOUT_CONSENT_VERSION,
          accepted: true,
        },
        {
          consentType: 'telehealth_informed_consent',
          documentVersion: CHECKOUT_CONSENT_VERSION,
          accepted: true,
        },
      ],
    };

    try {
      const result = await placeCheckout(order);
      this.setState({ submitting: false, result: result });
      this.emit('checkout:complete', result);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Checkout Could Not Be Completed. Please Try Again.';
      this.setState({ submitting: false, error: message });
      this.emit('checkout:error', { message: message });
    }
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    if (!this.state.config) {
      return (
        '<div class="pnrx-checkout">' +
        '<p class="pnrx-checkout__empty">No Plan Selected. Choose A ' +
        'Treatment Plan To Continue.</p>' +
        '</div>'
      );
    }
    if (this.state.result) {
      return '<div class="pnrx-checkout">' + this.renderSuccess() + '</div>';
    }
    return (
      '<div class="pnrx-checkout">' +
      '<h2 class="pnrx-checkout__title">Review And Confirm Your Order</h2>' +
      '<div class="pnrx-checkout__layout">' +
      '<div class="pnrx-checkout__main">' +
      this.renderAddressForm() +
      this.renderConsents() +
      '</div>' +
      this.renderSummary() +
      '</div>' +
      '</div>'
    );
  }

  renderSummary() {
    const c = this.state.config;
    const gross = this.grossCents();
    const cadenceNote =
      c.cadenceMonths > 1
        ? formatPrice(gross) + ' Billed Every ' + c.cadenceMonths + ' Months'
        : formatPrice(gross) + ' Billed Monthly';
    const error = this.state.error
      ? '<p class="pnrx-checkout__error" role="alert">' +
        escapeHtml(this.state.error) +
        '</p>'
      : '';
    const buttonLabel = this.state.submitting
      ? 'Placing Order'
      : 'Place Order';
    return (
      '<aside class="pnrx-checkout__summary">' +
      '<h3 class="pnrx-checkout__subhead">Order Summary</h3>' +
      '<div class="pnrx-checkout__line">' +
      '<span>Treatment</span>' +
      '<strong>' +
      escapeHtml(c.treatmentName || c.planName) +
      '</strong>' +
      '</div>' +
      '<div class="pnrx-checkout__line">' +
      '<span>Plan</span>' +
      '<strong>' +
      escapeHtml(c.planName) +
      '</strong>' +
      '</div>' +
      '<div class="pnrx-checkout__line">' +
      '<span>Per Month</span>' +
      '<strong>' +
      formatPrice(c.pricePerMonthCents) +
      '</strong>' +
      '</div>' +
      '<div class="pnrx-checkout__line pnrx-checkout__line--total">' +
      '<span>Total Today</span>' +
      '<strong>' +
      formatPrice(gross) +
      '</strong>' +
      '</div>' +
      '<p class="pnrx-checkout__note">' +
      escapeHtml(cadenceNote) +
      '. A Licensed Provider Reviews Your Intake Before Any Charge Settles.' +
      '</p>' +
      error +
      '<button type="button" class="pnrx-checkout__cta" data-action="submit"' +
      (this.canSubmit() ? '' : ' disabled') +
      '>' +
      buttonLabel +
      '</button>' +
      '<p class="pnrx-checkout__legal">No Card Is Charged On This Screen. ' +
      'Payment Is Arranged Separately. PepNationRX Acts Solely As The ' +
      'Designated Billing Agent.</p>' +
      '</aside>'
    );
  }

  renderAddressForm() {
    const s = this.state;
    return (
      '<section class="pnrx-checkout__section">' +
      '<h3 class="pnrx-checkout__subhead">Shipping Address</h3>' +
      '<p class="pnrx-checkout__hint">Compounded Medications Ship Cold-Chain. ' +
      'Provide An Address Where Someone Can Receive The Delivery.</p>' +
      '<div class="pnrx-checkout__field">' +
      '<label for="pnrx-line1">Street Address</label>' +
      '<input id="pnrx-line1" type="text" data-field="line1" ' +
      'value="' + escapeHtml(s.line1) + '" autocomplete="address-line1" />' +
      '</div>' +
      '<div class="pnrx-checkout__field">' +
      '<label for="pnrx-line2">Apartment Or Unit (Optional)</label>' +
      '<input id="pnrx-line2" type="text" data-field="line2" ' +
      'value="' + escapeHtml(s.line2) + '" autocomplete="address-line2" />' +
      '</div>' +
      '<div class="pnrx-checkout__row">' +
      '<div class="pnrx-checkout__field">' +
      '<label for="pnrx-city">City</label>' +
      '<input id="pnrx-city" type="text" data-field="city" ' +
      'value="' + escapeHtml(s.city) + '" autocomplete="address-level2" />' +
      '</div>' +
      '<div class="pnrx-checkout__field pnrx-checkout__field--state">' +
      '<label for="pnrx-state">State</label>' +
      '<input id="pnrx-state" type="text" data-field="addrState" maxlength="2" ' +
      'value="' + escapeHtml(s.addrState) + '" autocomplete="address-level1" />' +
      '</div>' +
      '<div class="pnrx-checkout__field pnrx-checkout__field--zip">' +
      '<label for="pnrx-zip">Postal Code</label>' +
      '<input id="pnrx-zip" type="text" data-field="postalCode" ' +
      'value="' + escapeHtml(s.postalCode) + '" autocomplete="postal-code" />' +
      '</div>' +
      '</div>' +
      '<div class="pnrx-checkout__field">' +
      '<label for="pnrx-affiliate">Referral Code (Optional)</label>' +
      '<input id="pnrx-affiliate" type="text" data-field="affiliateCode" ' +
      'value="' + escapeHtml(s.affiliateCode) + '" />' +
      '</div>' +
      '</section>'
    );
  }

  renderConsents() {
    const s = this.state;
    return (
      '<section class="pnrx-checkout__section">' +
      '<h3 class="pnrx-checkout__subhead">Required Acknowledgements</h3>' +
      '<label class="pnrx-checkout__consent">' +
      '<input type="checkbox" data-consent="mso"' +
      (s.consentMso ? ' checked' : '') +
      ' />' +
      '<span>' +
      escapeHtml(MSO_DISCLOSURE) +
      '</span>' +
      '</label>' +
      '<label class="pnrx-checkout__consent">' +
      '<input type="checkbox" data-consent="telehealth"' +
      (s.consentTelehealth ? ' checked' : '') +
      ' />' +
      '<span>' +
      escapeHtml(TELEHEALTH_CONSENT) +
      '</span>' +
      '</label>' +
      '</section>'
    );
  }

  renderSuccess() {
    const r = this.state.result;
    const subId = r && r.subscription ? r.subscription.id : '';
    return (
      '<div class="pnrx-checkout__success" role="status">' +
      '<h2 class="pnrx-checkout__title">Order Received</h2>' +
      '<p>Your Order Is In. An Independent, Licensed Provider Will Review ' +
      'Your Intake Before Any Charge Settles. You Will Be Notified When Your ' +
      'Treatment Plan Is Approved.</p>' +
      (subId
        ? '<p class="pnrx-checkout__ref">Reference: ' +
          escapeHtml(subId) +
          '</p>'
        : '') +
      '</div>'
    );
  }

  // -- Event binding ---------------------------------------------------------

  afterRender() {
    const self = this;

    this.$$('[data-field]').forEach(function (input) {
      input.addEventListener('input', function () {
        const patch = {};
        patch[input.getAttribute('data-field')] = input.value;
        self.setState(patch);
      });
    });

    const mso = this.$('[data-consent="mso"]');
    if (mso) {
      mso.addEventListener('change', function () {
        self.setState({ consentMso: mso.checked });
      });
    }

    const telehealth = this.$('[data-consent="telehealth"]');
    if (telehealth) {
      telehealth.addEventListener('change', function () {
        self.setState({ consentTelehealth: telehealth.checked });
      });
    }

    const submit = this.$('[data-action="submit"]');
    if (submit) {
      submit.addEventListener('click', function () {
        self.submit();
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-checkout')) {
  customElements.define('pnrx-checkout', PnrxCheckout);
}
