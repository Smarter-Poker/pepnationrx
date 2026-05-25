// ============================================================================
// pnrx-app-shell - the PepNationRX application shell.
// ----------------------------------------------------------------------------
// The single-page application frame. It owns the persistent header and footer,
// the hash router, and the route outlet, and it wires the cross-component
// flow: a catalog selection opens the triage intake, a completed intake opens
// checkout, and a completed checkout opens the patient dashboard.
//
// The footer carries a compact legal attribution line and links to the Terms Of
// Service, Privacy Policy, and Legal Notices routes defined in buildRoutes().
// The full MSO billing-agent consent disclosure is in pnrx-checkout.js where
// the patient actively acknowledges it before placing an order.
// ============================================================================

'use strict';

import { createRouter } from '../core/router.js';
import { isAuthenticated, getUser, subscribe } from '../store/session.js';
import { restoreSession, logout } from '../services/auth.service.js';
import { submitIntake } from '../services/intake.service.js';
import { showToast } from '../utils/toast.js';
import { configureApi } from '../services/api.js';

// Note: The full MSO billing-agent disclosure lives in pnrx-checkout.js
// where the patient actively acknowledges it before placing an order.
// The footer carries only the minimal required attribution line.

// Importing the feature components registers their custom elements so the
// router can create them by tag name.
import './pnrx-catalog.js';
import './pnrx-triage-form.js';
import './pnrx-checkout.js';
import './pnrx-patient-dashboard.js';
import './pnrx-message-thread.js';
import './pnrx-insurance-checker.js';
import './pnrx-membership.js';
import './pnrx-affiliate-dashboard.js';
import './pnrx-admin-dashboard.js';
import './pnrx-auth.js';

// Roles permitted to reach the admin dashboard.
const STAFF_ROLES = ['admin', 'support'];

// Path to the Pep Nation Rx logo (background removed, transparent PNG).
const PNRX_LOGO_SRC = 'assets/images/logo.png';


export class PnrxAppShell extends HTMLElement {
  constructor() {
    super();
    // The plan a visitor chose in the catalog, carried through intake to
    // checkout. Null until a catalog selection is made.
    this.pendingSelection = null;
    this.router = null;
    this.unsubscribe = null;
  }

  connectedCallback() {
    // Configure the API client. Vercel proxies /api/* to the Hetzner backend
    // so same-origin fetch works in production. For non-Vercel deployments,
    // set a `data-api-base` attribute on the <pnrx-app-shell> element or a
    // <meta name="api-base"> tag to override the base URL.
    const metaBase = document.querySelector('meta[name="api-base"]');
    const attrBase = this.getAttribute('data-api-base');
    const apiBase = attrBase || (metaBase && metaBase.getAttribute('content')) || '';
    configureApi({ baseUrl: apiBase });
    this.innerHTML =
      '<div class="pnrx-shell">' +
      '<header class="pnrx-shell__header">' +
      '<a class="pnrx-shell__brand" href="#/catalog" aria-label="PepNationRX">' +
      '<img class="pnrx-shell__logo" ' +
      'src="' + PNRX_LOGO_SRC + '" ' +
      'alt="PepNationRX" />' +
      '</a>' +
      '<button class="pnrx-shell__hamburger" aria-label="Menu" aria-expanded="false">' +
      '<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24">' +
      '<line x1="3" y1="6" x2="21" y2="6"/>' +
      '<line x1="3" y1="12" x2="21" y2="12"/>' +
      '<line x1="3" y1="18" x2="21" y2="18"/>' +
      '</svg>' +
      '</button>' +
      '<nav class="pnrx-shell__nav" id="pnrx-shell-nav"></nav>' +
      '</header>' +
      '<main class="pnrx-shell__outlet" id="pnrx-shell-outlet"></main>' +
      '<footer class="pnrx-shell__footer">' +
      '<p class="pnrx-shell__legal">' +
      '&copy; ' + new Date().getFullYear() + ' PepNationRX &mdash; ' +
      'Telehealth Services Provided By Independent Licensed Practitioners. ' +
      'Not A Medical Provider. Not Insurance. Not Available In All States. ' +
      'Not For Emergencies &mdash; Call 911.' +
      '</p>' +
      '<p class="pnrx-shell__legal pnrx-shell__legal--links">' +
      '<a class="pnrx-shell__legal-link" href="#/terms">Terms Of Service</a>' +
      ' &middot; ' +
      '<a class="pnrx-shell__legal-link" href="#/privacy">Privacy Policy</a>' +
      ' &middot; ' +
      '<a class="pnrx-shell__legal-link" href="#/legal">Legal Notices</a>' +
      '</p>' +
      '</footer>' +
      '</div>';

    this.outlet = this.querySelector('#pnrx-shell-outlet');
    this.navEl = this.querySelector('#pnrx-shell-nav');

    // Mobile hamburger toggle
    var hamburger = this.querySelector('.pnrx-shell__hamburger');
    var nav = this.querySelector('#pnrx-shell-nav');
    if (hamburger) {
      hamburger.addEventListener('click', function () {
        var expanded = hamburger.getAttribute('aria-expanded') === 'true';
        hamburger.setAttribute('aria-expanded', String(!expanded));
        nav.classList.toggle('is-open');
      });
    }

    this.router = createRouter({
      outlet: this.outlet,
      fallback: '/catalog',
      routes: this.buildRoutes(),
      onChange: this.renderNav.bind(this),
    });

    // Re-render the nav whenever the session changes.
    this.unsubscribe = subscribe(this.renderNav.bind(this));

    this.bindFlowEvents();
    this.renderNav();

    // Restore a session from the refresh-token cookie, then start routing.
    restoreSession().finally(
      function () {
        this.router.start();
      }.bind(this)
    );
  }

  disconnectedCallback() {
    if (this.router) this.router.stop();
    if (this.unsubscribe) this.unsubscribe();
  }

  // -- Routing ---------------------------------------------------------------

  buildRoutes() {
    const self = this;
    return {
      '/catalog': function () {
        return document.createElement('pnrx-catalog');
      },
      '/intake': function () {
        return document.createElement('pnrx-triage-form');
      },
      '/checkout': function () {
        const el = document.createElement('pnrx-checkout');
        if (self.pendingSelection) {
          el.configure(self.pendingSelection);
        }
        return el;
      },
      '/dashboard': function () {
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        return document.createElement('pnrx-patient-dashboard');
      },
      '/messages': function () {
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        return document.createElement('pnrx-message-thread');
      },
      '/insurance': function () {
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        return document.createElement('pnrx-insurance-checker');
      },
      '/membership': function () {
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        return document.createElement('pnrx-membership');
      },
      '/affiliate': function () {
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        return document.createElement('pnrx-affiliate-dashboard');
      },
      '/admin': function () {
        const user = getUser();
        if (!isAuthenticated()) {
          self.router.navigate('/login');
          return self.requireSignInNotice();
        }
        if (!user || STAFF_ROLES.indexOf(user.role) === -1) {
          const div = document.createElement('div');
          div.className = 'pnrx-shell__notice';
          div.textContent = 'This Area Is Restricted To Staff Accounts.';
          return div;
        }
        return document.createElement('pnrx-admin-dashboard');
      },
      '/login': function () {
        const el = document.createElement('pnrx-auth');
        el.setAttribute('mode', 'login');
        return el;
      },
      '/register': function () {
        const el = document.createElement('pnrx-auth');
        el.setAttribute('mode', 'register');
        return el;
      },
      '/terms': function () {
        return self.renderLegalPage(
          'Terms Of Service',
          'Our full Terms Of Service govern your use of this platform. ' +
          'This page will contain the complete text when the platform launches. ' +
          'Key terms: PepNationRX is a technology platform, not a medical provider. ' +
          'Clinical services are provided by independent, licensed practitioners. ' +
          'A prescription is not guaranteed and is at the sole discretion of the clinician.'
        );
      },
      '/privacy': function () {
        return self.renderLegalPage(
          'Privacy Policy',
          'Our full Privacy Policy details how we handle your information. ' +
          'This page will contain the complete text when the platform launches. ' +
          'We do not share your health data with advertisers. We maintain a Business ' +
          'Associate Agreement with all vendors who access protected health information.'
        );
      },
      '/legal': function () {
        return self.renderLegalPage(
          'Legal Notices',
          'Legal notices, MSO disclosure, and regulatory information. ' +
          'PepNationRX is a technology platform and management services organization. ' +
          'We do not provide medical advice or care. All clinical services are provided ' +
          'by independent, licensed medical practitioners. All compounded medications are ' +
          'fulfilled by licensed, independent 503A compounding pharmacies. ' +
          'PepNationRX acts solely as the designated billing agent. ' +
          'Compounded medications are not FDA-approved.'
        );
      },
    };
  }

  // A placeholder shown for a heartbeat while an unauthenticated visitor is
  // redirected to the sign-in screen.
  requireSignInNotice() {
    const div = document.createElement('div');
    div.className = 'pnrx-shell__notice';
    div.textContent = 'Please Sign In To Continue.';
    return div;
  }

  // A simple static page for legal routes (/terms, /privacy, /legal).
  // Renders a titled card with placeholder text until the full legal copy is
  // authored. Returns a DOM node so the router can mount it directly.
  renderLegalPage(title, body) {
    const div = document.createElement('div');
    div.className = 'pnrx-shell__legal-page';
    div.innerHTML =
      '<h2 class="pnrx-shell__legal-page-title">' +
      title +
      '</h2>' +
      '<p class="pnrx-shell__legal-page-body">' +
      body +
      '</p>';
    return div;
  }

  // -- Cross-component flow --------------------------------------------------

  bindFlowEvents() {
    const self = this;

    // A catalog selection carries a plan into the intake then checkout.
    this.addEventListener('catalog:select', function (event) {
      const d = event.detail || {};
      const months = d.planCadenceMonths || 1;
      self.pendingSelection = {
        protocolCategory: d.protocolCategory || null,
        planName: months === 1 ? 'Monthly' : months + '-Month Plan',
        treatmentName: d.treatmentName || '',
        treatmentSlug: d.treatmentSlug || '',
        cadenceMonths: months,
        pricePerMonthCents: d.planPriceCents || 0,
      };
      self.router.navigate('/intake');
    });

    // A completed intake is persisted to the backend so a provider can review
    // it, then advances to checkout when a plan was selected. The intake is
    // saved only for a signed-in patient; an anonymous visitor is routed
    // onward and will create an account before checkout. A save failure
    // blocks navigation to checkout because the backend requires an
    // intakeSubmissionId to link the order to the patient's clinical record.
    this.addEventListener('triage:submit', function (event) {
      const detail = event.detail || {};
      const proceed = function () {
        self.router.navigate(self.pendingSelection ? '/checkout' : '/dashboard');
      };
      if (!isAuthenticated()) {
        // Store the raw intake detail so we can submit it AFTER the patient
        // signs in. Without this, the intakeSubmissionId would be missing and
        // the clinical audit trail (intake → subscription) would be broken.
        if (self.pendingSelection) {
          self.pendingSelection._pendingIntakeDetail = detail;
        }
        self.router.navigate('/register');
        return;
      }
      submitIntake(detail)
        .then(function (result) {
          if (self.pendingSelection && result && result.submission) {
            self.pendingSelection.intakeSubmissionId = result.submission.id;
          }
          // Intake saved successfully — safe to proceed to checkout.
          proceed();
        })
        .catch(function () {
          // Intake save failed. Surface the error and keep the patient on
          // the current screen so they can retry. Do not navigate to checkout
          // without a valid intakeSubmissionId.
          showToast(
            'Your Intake Could Not Be Saved. Please Check Your Connection And Try Again.',
            'error'
          );
        });
    });

    // A completed checkout returns the patient to their dashboard.
    this.addEventListener('checkout:complete', function () {
      self.pendingSelection = null;
      showToast(
        'Order Received. A Provider Will Review Your Intake Shortly.',
        'success'
      );
      self.router.navigate('/dashboard');
    });

    // A checkout error surfaces as a toast in addition to the inline message.
    this.addEventListener('checkout:error', function (event) {
      const detail = event.detail || {};
      showToast(detail.message || 'Checkout Could Not Be Completed.', 'error');
    });

    // A successful sign-in or registration: if the patient was mid-flow (they
    // chose a treatment and went through intake before signing in), submit any
    // deferred intake then resume at checkout so the order can be completed.
    // Otherwise open the dashboard.
    this.addEventListener('auth:success', function () {
      showToast('You Are Signed In.', 'success');
      if (self.pendingSelection) {
        const deferredIntake = self.pendingSelection._pendingIntakeDetail;
        if (deferredIntake) {
          // The patient completed intake while anonymous — save it now that
          // we have an authenticated session so the intakeSubmissionId is
          // available for checkout.
          delete self.pendingSelection._pendingIntakeDetail;
          submitIntake(deferredIntake)
            .then(function (result) {
              if (result && result.submission) {
                self.pendingSelection.intakeSubmissionId = result.submission.id;
              }
              self.router.navigate('/checkout');
            })
            .catch(function () {
              // Intake save failed even after sign-in. Let the patient proceed
              // to checkout — the backend allows a null intakeSubmissionId for
              // edge-case recovery, but surface a warning.
              showToast(
                'Your Intake Could Not Be Saved. Your Order Will Still Be Placed.',
                'error'
              );
              self.router.navigate('/checkout');
            });
        } else {
          self.router.navigate('/checkout');
        }
      } else {
        self.router.navigate('/dashboard');
      }
    });
  }

  // -- Header navigation -----------------------------------------------------

  renderNav() {
    const links = [
      '<a class="pnrx-shell__link" href="#/catalog">Browse Treatments</a>',
      '<a class="pnrx-shell__link" href="#/intake">Start Intake</a>',
    ];
    if (isAuthenticated()) {
      const user = getUser();
      const label =
        user && user.first_name ? 'Hello, ' + user.first_name : 'My Dashboard';
      links.push('<a class="pnrx-shell__link" href="#/dashboard">' + label + '</a>');
      // Secure messaging is a patient-facing surface; staff use the provider
      // tools, not this nav link.
      if (!user || STAFF_ROLES.indexOf(user.role) === -1) {
        links.push(
          '<a class="pnrx-shell__link" href="#/messages">Messages</a>'
        );
        links.push(
          '<a class="pnrx-shell__link" href="#/insurance">Insurance</a>'
        );
        links.push(
          '<a class="pnrx-shell__link" href="#/membership">PepNationRX Plus</a>'
        );
      }
      if (user && STAFF_ROLES.indexOf(user.role) !== -1) {
        links.push(
          '<a class="pnrx-shell__link" href="#/admin">Admin Console</a>'
        );
      }
      links.push(
        '<button type="button" class="pnrx-shell__signout" ' +
          'data-action="signout">Sign Out</button>'
      );
    } else {
      links.push('<a class="pnrx-shell__link" href="#/login">Sign In</a>');
    }
    this.navEl.innerHTML = links.join('');

    const signout = this.navEl.querySelector('[data-action="signout"]');
    if (signout) {
      const self = this;
      signout.addEventListener('click', function () {
        logout().finally(function () {
          self.router.navigate('/catalog');
        });
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-app-shell')) {
  customElements.define('pnrx-app-shell', PnrxAppShell);
}
