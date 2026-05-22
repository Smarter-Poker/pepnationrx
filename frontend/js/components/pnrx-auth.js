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
      (s.submitting ? 'Signing In' : 'Sign In') +
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
      this.renderField('pnrx-state', 'State Of Residence', 'text', 'usState', s.usState) +
      '<p class="pnrx-auth__hint">Enter Your Two-Letter State Code, For ' +
      'Example TX.</p>' +
      '<div class="pnrx-auth__acks">' +
      '<h3 class="pnrx-auth__acks-title">Required Acknowledgements</h3>' +
      acks +
      '</div>' +
      '<button type="button" class="pnrx-auth__cta" data-action="submit"' +
      (this.canSubmit() ? '' : ' disabled') + '>' +
      (s.submitting ? 'Creating Account' : 'Create Account') +
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
