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
import {
  placeCheckout,
  validateCoupon,
  CHECKOUT_CONSENT_VERSION,
} from '../services/checkout.service.js';

// The MSO billing-agent disclosure. Kept identical to the text in the backend
// constants module and ARCHITECTURE.md Section V.
const MSO_DISCLOSURE =
  'PepNationRX Is A Technology Platform And Management Services Organization. ' +
  'We Do Not Provide Medical Advice Or Care. All Clinical Services Are ' +
  'Provided By Independent, Licensed Medical Practitioners. All Compounded ' +
  'Medications Are Fulfilled By Licensed, Independent 503A Compounding ' +
  'Pharmacies. By Proceeding, You Acknowledge That PepNationRX Acts Solely ' +
  'As The Designated Billing Agent.';

// The telehealth informed-consent summary shown at checkout.
const TELEHEALTH_CONSENT =
  'I Consent To Receive Care Through Telehealth. I Understand That An ' +
  'Independent, Licensed Provider Will Review My Intake, That A Treatment ' +
  'Plan Is Issued Only When Clinically Appropriate, And That I May Decline ' +
  'Or Discontinue Treatment At Any Time.';

// Format an integer cent amount as a US dollar string.
function formatPrice(cents) {
  return '$' + (Math.round(cents) / 100).toFixed(2);
}

// All 50 US states plus DC for the shipping-state dropdown.
const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District Of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

// 5-digit US zip code (with optional +4).
const ZIP_RE = /^\d{5}(-\d{4})?$/;

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
      // Coupon code entry. couponStatus is idle | checking | applied | error;
      // appliedCoupon holds the validated coupon terms once a code is applied.
      couponInput: '',
      couponStatus: 'idle',
      couponMessage: '',
      appliedCoupon: null,
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
      couponInput: '',
      couponStatus: 'idle',
      couponMessage: '',
      appliedCoupon: null,
      error: null,
      result: null,
    });
  }

  // -- Derived values --------------------------------------------------------

  grossCents() {
    const c = this.state.config;
    if (!c) return 0;
    // Guard against null/undefined fields that would produce NaN in the UI.
    return (c.pricePerMonthCents || 0) * (c.cadenceMonths || 1);
  }

  // The previewed discount for the applied coupon, in cents. This mirrors the
  // backend coupon math for display; the authoritative discount is recomputed
  // server-side at checkout and returned in the result pricing block.
  discountCents() {
    const c = this.state.appliedCoupon;
    if (!c || this.state.couponStatus !== 'applied') return 0;
    const gross = this.grossCents();
    if (gross <= 0) return 0;
    let d;
    if (c.type === 'percent') {
      d = Math.round((gross * Number(c.value)) / 100);
    } else {
      d = Math.round(Number(c.value) || 0);
    }
    if (!Number.isFinite(d) || d <= 0) return 0;
    return Math.min(d, gross);
  }

  // The amount due today: the gross less any previewed coupon discount.
  totalCents() {
    return Math.max(0, this.grossCents() - this.discountCents());
  }

  addressComplete() {
    const s = this.state;
    return (
      s.line1.trim() !== '' &&
      s.city.trim() !== '' &&
      s.addrState.length === 2 &&
      ZIP_RE.test(s.postalCode.trim())
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
      treatmentSlug: c.treatmentSlug || undefined,
      cadenceMonths: c.cadenceMonths,
      affiliateCode: s.affiliateCode.trim() || undefined,
      couponCode:
        s.appliedCoupon && s.couponStatus === 'applied'
          ? s.appliedCoupon.code
          : undefined,
      shippingAddress: {
        line1: s.line1.trim(),
        line2: s.line2.trim() || undefined,
        city: s.city.trim(),
        state: s.addrState.toUpperCase(),
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
    // Forward the intake submission id so the backend can link this order
    // to the patient's clinical intake record.
    if (c.intakeSubmissionId) order.intakeSubmissionId = c.intakeSubmissionId;

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

  // -- Coupon ----------------------------------------------------------------

  // Validate the entered coupon code against the backend. On success the
  // discount terms are stored and previewed in the order summary; on failure
  // the reason the code cannot be used is shown.
  async applyCoupon() {
    const code = this.state.couponInput.trim();
    if (code === '' || this.state.couponStatus === 'checking') return;
    this.setState({ couponStatus: 'checking', couponMessage: '' });
    try {
      const res = await validateCoupon(code);
      const coupon = res && res.coupon ? res.coupon : null;
      if (!coupon) {
        this.setState({
          couponStatus: 'error',
          couponMessage: 'That Coupon Code Could Not Be Applied.',
          appliedCoupon: null,
        });
        return;
      }
      this.setState({
        couponStatus: 'applied',
        couponMessage: '',
        appliedCoupon: coupon,
      });
    } catch (err) {
      this.setState({
        couponStatus: 'error',
        couponMessage:
          err instanceof ApiError
            ? err.message
            : 'That Coupon Code Could Not Be Applied.',
        appliedCoupon: null,
      });
    }
  }

  // Clear the applied coupon and return to the empty code field.
  removeCoupon() {
    this.setState({
      couponInput: '',
      couponStatus: 'idle',
      couponMessage: '',
      appliedCoupon: null,
    });
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
      '<div class="pnrx-checkout__line">' +
      '<span>Subtotal</span>' +
      '<strong>' +
      formatPrice(gross) +
      '</strong>' +
      '</div>' +
      this.renderCoupon() +
      '<div class="pnrx-checkout__line pnrx-checkout__line--total">' +
      '<span>Total Today</span>' +
      '<strong>' +
      formatPrice(this.totalCents()) +
      '</strong>' +
      '</div>' +
      '<p class="pnrx-checkout__note">' +
      escapeHtml(cadenceNote) +
      '. A Licensed Provider Reviews Your Intake Before Any Charge Settles.' +
      '</p>' +
      error +
      '<div class="pnrx-checkout__trust">' +
      '<div class="pnrx-checkout__trust-item">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<span>HIPAA Compliant</span>' +
      '</div>' +
      '<div class="pnrx-checkout__trust-item">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>SSL Encrypted</span>' +
      '</div>' +
      '<div class="pnrx-checkout__trust-item">' +
      '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
      '<span>Discreet Shipping</span>' +
      '</div>' +
      '</div>' +
      '<button type="button" class="pnrx-checkout__cta" data-action="submit"' +
      (this.canSubmit() ? '' : ' disabled') +
      '>' +
      (this.state.submitting
        ? '<span class="pnrx-spinner pnrx-spinner--sm"></span> '
        : '') +
      buttonLabel +
      '</button>' +
      '<p class="pnrx-checkout__legal">No Card Is Charged On This Screen. ' +
      'Payment Is Arranged Separately. PepNationRX Acts Solely As The ' +
      'Designated Billing Agent.</p>' +
      '</aside>'
    );
  }

  // The coupon row inside the order summary: an applied-coupon discount line
  // with a remove control, or the code-entry field when none is applied.
  renderCoupon() {
    const s = this.state;
    if (s.appliedCoupon && s.couponStatus === 'applied') {
      return (
        '<div class="pnrx-checkout__line pnrx-checkout__line--discount">' +
        '<span>Coupon ' +
        escapeHtml(s.appliedCoupon.code) +
        '</span>' +
        '<strong>-' +
        formatPrice(this.discountCents()) +
        '</strong>' +
        '</div>' +
        '<button type="button" class="pnrx-checkout__coupon-remove" ' +
        'data-action="remove-coupon">Remove Coupon</button>'
      );
    }
    const checking = s.couponStatus === 'checking';
    const message =
      s.couponMessage !== ''
        ? '<p class="pnrx-checkout__coupon-msg" role="alert">' +
          escapeHtml(s.couponMessage) +
          '</p>'
        : '';
    return (
      '<div class="pnrx-checkout__coupon">' +
      '<label class="pnrx-checkout__coupon-label" for="pnrx-coupon">' +
      'Have A Coupon Code?</label>' +
      '<div class="pnrx-checkout__coupon-row">' +
      '<input id="pnrx-coupon" type="text" data-field="couponInput" ' +
      'placeholder="Enter Code" value="' +
      escapeHtml(s.couponInput) +
      '" />' +
      '<button type="button" class="pnrx-checkout__coupon-apply" ' +
      'data-action="apply-coupon"' +
      (checking ? ' disabled' : '') +
      '>' +
      (checking ? 'Checking' : 'Apply') +
      '</button>' +
      '</div>' +
      message +
      '</div>'
    );
  }

  renderAddressForm() {
    const s = this.state;
    const stateOptions =
      '<option value=""' + (s.addrState === '' ? ' selected' : '') + ' disabled>Select State</option>' +
      US_STATES.map(function (st) {
        return '<option value="' + st.value + '"' +
          (s.addrState === st.value ? ' selected' : '') + '>' +
          st.label + '</option>';
      }).join('');
    const zipError = s.postalCode.trim() !== '' && !ZIP_RE.test(s.postalCode.trim())
      ? '<p class="pnrx-checkout__field-error">Please Enter A Valid 5-Digit ZIP Code.</p>'
      : '';
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
      '<select id="pnrx-state" class="pnrx-checkout__select" data-select="addrState" autocomplete="address-level1">' +
      stateOptions +
      '</select>' +
      '</div>' +
      '<div class="pnrx-checkout__field pnrx-checkout__field--zip">' +
      '<label for="pnrx-zip">ZIP Code</label>' +
      '<input id="pnrx-zip" type="text" data-field="postalCode" ' +
      'value="' + escapeHtml(s.postalCode) + '" autocomplete="postal-code" ' +
      'maxlength="10" inputmode="numeric" />' +
      zipError +
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

    // Text inputs: mutate state directly without re-rendering on every
    // keystroke. Re-rendering on each input event replaces innerHTML and
    // destroys focus, making all form fields unusable (only one character
    // could be typed before focus was lost). We only need to refresh the
    // submit button's disabled state after each change.
    this.$$('[data-field]').forEach(function (input) {
      input.addEventListener('input', function () {
        // Direct mutation: safe here because we are immediately syncing
        // the DOM value back to state without triggering a render cycle.
        self.state[input.getAttribute('data-field')] = input.value;
        // Refresh the submit button enabled state without a full re-render.
        var btn = self.$('[data-action="submit"]');
        if (btn) {
          if (self.canSubmit()) {
            btn.removeAttribute('disabled');
          } else {
            btn.setAttribute('disabled', '');
          }
        }
      });
    });

    // State dropdown — uses data-select instead of data-field to avoid the
    // generic input handler attempting to bind to a <select>.
    const stateSelect = this.$('[data-select="addrState"]');
    if (stateSelect) {
      stateSelect.addEventListener('change', function () {
        self.setState({ addrState: stateSelect.value });
      });
    }

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

    const applyCoupon = this.$('[data-action="apply-coupon"]');
    if (applyCoupon) {
      applyCoupon.addEventListener('click', function () {
        self.applyCoupon();
      });
    }

    const removeCoupon = this.$('[data-action="remove-coupon"]');
    if (removeCoupon) {
      removeCoupon.addEventListener('click', function () {
        self.removeCoupon();
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-checkout')) {
  customElements.define('pnrx-checkout', PnrxCheckout);
}
