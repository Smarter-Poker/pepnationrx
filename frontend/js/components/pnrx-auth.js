// ============================================================================
// pnrx-auth - the PepNationRX sign-in and registration screen.
// ----------------------------------------------------------------------------
// One component, two modes. Login verifies credentials. Registration creates a
// patient account and presents the registration layer of the mandatory consent
// gate: three acknowledgements the visitor must check before the account can
// be created. Both modes open a session via auth.service and emit an
// "auth:success" CustomEvent the application shell listens for.
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { ApiError } from '../services/api.js';
import { login, register } from '../services/auth.service.js';

// The three registration acknowledgements. Each must be checked to proceed.
const REGISTRATION_ACKS = [
  'I Am At Least 18 Years Old And The Information I Provide Is Accurate And ' +
    'Complete.',
  'I Understand PepNationRX Is A Technology Platform And Management Services ' +
    'Organization, Not A Medical Provider Or Pharmacy, And Acts Solely As The ' +
    'Designated Billing Agent.',
  'I Agree To The Terms Of Service And The Privacy Policy, And I Consent To ' +
    'Receive Care Through Telehealth.',
];

// All 50 US states plus DC for the state-of-residence dropdown.
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

export class PnrxAuth extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      mode: 'login', // login | register
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      usState: '', // two-letter US state of residence
      acks: [false, false, false],
      submitting: false,
      error: null,
    };
  }

  // Standard lifecycle: honor a mode attribute when the host sets one.
  connectedCallback() {
    const attr = this.getAttribute('mode');
    if (attr === 'register' || attr === 'login') {
      this.state.mode = attr;
    }
    super.connectedCallback();
  }

  // Switch between login and registration, clearing transient state.
  setMode(mode) {
    this.setState({
      mode: mode,
      error: null,
      password: '',
      acks: [false, false, false],
    });
  }

  // -- Derived values --------------------------------------------------------

  allAcksChecked() {
    return this.state.acks.every(function (checked) {
      return checked === true;
    });
  }

  canSubmit() {
    const s = this.state;
    const credentialsReady =
      s.email.trim() !== '' && s.password.trim() !== '' && !s.submitting;
    if (s.mode === 'register') {
      // Registration also requires the two-letter state of residence so the
      // patient's telehealth encounter can be routed correctly.
      return (
        credentialsReady &&
        s.usState.trim().length === 2 &&
        this.allAcksChecked()
      );
    }
    return credentialsReady;
  }

  // -- Submission ------------------------------------------------------------

  async submit() {
    if (!this.canSubmit()) return;
    const s = this.state;
    this.setState({ submitting: true, error: null });

    try {
      let result;
      if (s.mode === 'register') {
        const payload = { email: s.email.trim(), password: s.password };
        if (s.firstName.trim()) payload.firstName = s.firstName.trim();
        if (s.lastName.trim()) payload.lastName = s.lastName.trim();
        payload.state = s.usState.trim().toUpperCase();
        result = await register(payload);
      } else {
        result = await login({ email: s.email.trim(), password: s.password });
      }
      this.setState({ submitting: false });
      this.emit('auth:success', { user: result.user, mode: s.mode });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'We Could Not Complete Your Request. Please Try Again.';
      this.setState({ submitting: false, error: message });
    }
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    return (
      '<div class="pnrx-auth">' +
      '<div class="pnrx-auth__card">' +
      (this.state.mode === 'register'
        ? this.renderRegister()
        : this.renderLogin()) +
      '</div>' +
      '<div class="pnrx-auth__trust">' +
      '<div class="pnrx-auth__trust-item">' +
      '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
      '<span>HIPAA Compliant</span>' +
      '</div>' +
      '<div class="pnrx-auth__trust-item">' +
      '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>256-Bit Encrypted</span>' +
      '</div>' +
      '<div class="pnrx-auth__trust-item">' +
      '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>' +
      '<span>Board-Certified Providers</span>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
  }

  renderError() {
    if (!this.state.error) return '';
    return (
      '<p class="pnrx-auth__error" role="alert">' +
      escapeHtml(this.state.error) +
      '</p>'
    );
  }

  renderField(id, label, type, field, value) {
    return (
      '<div class="pnrx-auth__field">' +
      '<label for="' + id + '">' + escapeHtml(label) + '</label>' +
      '<input id="' + id + '" type="' + type + '" data-field="' + field + '" ' +
      'value="' + escapeHtml(value) + '" />' +
      '</div>'
    );
  }

  renderLogin() {
    const s = this.state;
    return (
      '<h2 class="pnrx-auth__title">Sign In To Your Account</h2>' +
      '<p class="pnrx-auth__sub">Welcome Back. Enter Your Credentials To ' +
      'Continue.</p>' +
      this.renderError() +
      this.renderField('pnrx-email', 'Email Address', 'email', 'email', s.email) +
      this.renderField('pnrx-password', 'Password', 'password', 'password', s.password) +
      '<button type="button" class="pnrx-auth__cta" data-action="submit"' +
      (this.canSubmit() ? '' : ' disabled') + '>' +
      (s.submitting
        ? '<span class="pnrx-spinner pnrx-spinner--sm"></span> Signing In...'
        : 'Sign In') +
      '</button>' +
      '<p class="pnrx-auth__switch">New To PepNationRX? ' +
      '<button type="button" class="pnrx-auth__link" data-mode="register">' +
      'Create An Account</button></p>'
    );
  }

  renderRegister() {
    const s = this.state;
    const acks = REGISTRATION_ACKS.map(function (text, index) {
      return (
        '<label class="pnrx-auth__ack">' +
        '<input type="checkbox" data-ack="' + index + '"' +
        (s.acks[index] ? ' checked' : '') + ' />' +
        '<span>' + escapeHtml(text) + '</span>' +
        '</label>'
      );
    }).join('');

    return (
      '<h2 class="pnrx-auth__title">Create Your Account</h2>' +
      '<p class="pnrx-auth__sub">Start Your Confidential Telehealth Intake. ' +
      'A Licensed Provider Reviews Every Request.</p>' +
      this.renderError() +
      '<div class="pnrx-auth__row">' +
      this.renderField('pnrx-first', 'First Name', 'text', 'firstName', s.firstName) +
      this.renderField('pnrx-last', 'Last Name', 'text', 'lastName', s.lastName) +
      '</div>' +
      this.renderField('pnrx-email', 'Email Address', 'email', 'email', s.email) +
      this.renderField('pnrx-password', 'Password', 'password', 'password', s.password) +
      '<p class="pnrx-auth__hint">Use At Least 10 Characters.</p>' +
      '<div class="pnrx-auth__field">' +
      '<label for="pnrx-state">State Of Residence</label>' +
      '<select id="pnrx-state" class="pnrx-auth__select">' +
      '<option value=""' + (s.usState === '' ? ' selected' : '') + ' disabled>Select Your State</option>' +
      US_STATES.map(function (st) {
        return '<option value="' + st.value + '"' +
          (s.usState === st.value ? ' selected' : '') + '>' +
          escapeHtml(st.label) + '</option>';
      }).join('') +
      '</select>' +
      '</div>' +
      '<div class="pnrx-auth__acks">' +
      '<h3 class="pnrx-auth__acks-title">Required Acknowledgements</h3>' +
      acks +
      '</div>' +
      '<button type="button" class="pnrx-auth__cta" data-action="submit"' +
      (this.canSubmit() ? '' : ' disabled') + '>' +
      (s.submitting
        ? '<span class="pnrx-spinner pnrx-spinner--sm"></span> Creating Account...'
        : 'Create Account') +
      '</button>' +
      '<p class="pnrx-auth__switch">Already Have An Account? ' +
      '<button type="button" class="pnrx-auth__link" data-mode="login">' +
      'Sign In</button></p>'
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

    this.$$('[data-ack]').forEach(function (box) {
      box.addEventListener('change', function () {
        const index = Number(box.getAttribute('data-ack'));
        const acks = self.state.acks.slice();
        acks[index] = box.checked;
        self.setState({ acks: acks });
      });
    });

    this.$$('[data-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.setMode(button.getAttribute('data-mode'));
      });
    });

    // State dropdown change handler
    var stateSelect = this.$('#pnrx-state');
    if (stateSelect && stateSelect.tagName === 'SELECT') {
      stateSelect.addEventListener('change', function () {
        self.setState({ usState: stateSelect.value });
      });
    }

    const submit = this.$('[data-action="submit"]');
    if (submit) {
      submit.addEventListener('click', function () {
        self.submit();
      });
    }

    // Submitting from the password field with Enter is a common expectation.
    const password = this.$('#pnrx-password');
    if (password) {
      password.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') self.submit();
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-auth')) {
  customElements.define('pnrx-auth', PnrxAuth);
}
