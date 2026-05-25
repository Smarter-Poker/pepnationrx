// ============================================================================
// pnrx-message-thread - the patient secure care-team messaging view.
// ----------------------------------------------------------------------------
// Loads the patient's care-team conversation from GET /api/patient/messages
// and the open thread's history from GET /api/patient/messages/:threadId, and
// lets the patient post a new message. Opening the view marks every clinician
// message as read on the server.
//
// In demo mode (the `mode="demo"` attribute) the component does not call the
// API; a host page supplies data with renderData(payload).
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import { api } from '../services/api.js';

// Friendly label for each sender role.
const ROLE_LABEL = {
  patient: 'You',
  provider: 'Your Provider',
  support: 'Care Support',
};

// Format an ISO timestamp as a short, readable local date and time. Falls
// back to an empty string when the value is missing or unparseable.
function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export class PnrxMessageThread extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      status: 'loading',
      error: null,
      thread: null,
      messages: [],
      sending: false,
    };
  }

  connectedCallback() {
    this._performRender();
    if (this.getAttribute('mode') !== 'demo') {
      this.load();
    }
  }

  // Fetch the care-team thread and its messages.
  async load() {
    this.setState({ status: 'loading', error: null });
    try {
      const list = await api.get('/api/patient/messages');
      const threads = (list && list.threads) || [];
      // The active conversation is the open thread, if one exists yet.
      const open = threads.filter(function (t) {
        return t.status === 'open';
      })[0] || null;

      let messages = [];
      if (open) {
        const detail = await api.get('/api/patient/messages/' + open.id);
        messages = (detail && detail.messages) || [];
      }
      this.setState({ status: 'ready', thread: open, messages: messages });
    } catch (err) {
      this.setState({
        status: 'error',
        error:
          err && err.message
            ? err.message
            : 'Your Messages Could Not Be Loaded.',
      });
    }
  }

  // Render a payload directly, bypassing the API. Used by the demo page.
  renderData(data) {
    this.setState({
      status: 'ready',
      thread: (data && data.thread) || null,
      messages: (data && data.messages) || [],
    });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.status === 'loading') {
      body = '<p class="pnrx-msg__notice">Loading Your Messages...</p>';
    } else if (this.state.status === 'error') {
      body = this.renderError();
    } else {
      body = this.renderThread();
    }
    return '<div class="pnrx-msg">' + body + '</div>';
  }

  renderError() {
    return (
      '<div class="pnrx-msg__state pnrx-msg__state--error">' +
      '<p class="pnrx-msg__notice">' +
      escapeHtml(this.state.error) +
      '</p>' +
      '<button type="button" class="pnrx-msg__btn" data-action="retry">' +
      'Try Again</button>' +
      '</div>'
    );
  }

  renderThread() {
    return (
      '<header class="pnrx-msg__head">' +
      '<h2 class="pnrx-msg__title">Your Care Team</h2>' +
      '<p class="pnrx-msg__sub">Send A Secure Message To Your Clinical Team. ' +
      'A Licensed Provider Typically Replies Within One Business Day.</p>' +
      '</header>' +
      '<div class="pnrx-msg__list">' +
      this.renderMessages() +
      '</div>' +
      this.renderComposer()
    );
  }

  renderMessages() {
    const messages = this.state.messages || [];
    if (messages.length === 0) {
      return (
        '<p class="pnrx-msg__empty">No Messages Yet. Start The Conversation ' +
        'Below And Your Care Team Will Respond.</p>'
      );
    }
    return messages
      .map(function (m) {
        const mine = m.senderRole === 'patient';
        const side = mine ? 'pnrx-msg__bubble--mine' : 'pnrx-msg__bubble--them';
        const label = ROLE_LABEL[m.senderRole] || 'Care Team';
        return (
          '<div class="pnrx-msg__bubble ' + side + '">' +
          '<div class="pnrx-msg__meta">' +
          '<span class="pnrx-msg__sender">' + escapeHtml(label) + '</span>' +
          '<span class="pnrx-msg__when">' +
          escapeHtml(formatWhen(m.createdAt)) +
          '</span>' +
          '</div>' +
          '<p class="pnrx-msg__body">' + escapeHtml(m.body || '') + '</p>' +
          '</div>'
        );
      })
      .join('');
  }

  renderComposer() {
    const sending = this.state.sending === true;
    const disabled = sending ? ' disabled' : '';
    const buttonLabel = sending ? 'Sending...' : 'Send Message';
    return (
      '<form class="pnrx-msg__composer" data-action="send-form">' +
      '<label class="pnrx-msg__label" for="pnrx-msg-body">' +
      'Write A Message</label>' +
      '<textarea id="pnrx-msg-body" class="pnrx-msg__textarea" ' +
      'data-field="body" rows="3" maxlength="5000" ' +
      'placeholder="Type Your Message To Your Care Team..."' +
      disabled + '></textarea>' +
      '<button type="submit" class="pnrx-msg__btn"' + disabled + '>' +
      escapeHtml(buttonLabel) +
      '</button>' +
      '</form>'
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

    // Posting is skipped in demo mode, which has no authenticated session.
    const form = this.$('[data-action="send-form"]');
    if (form && this.getAttribute('mode') !== 'demo') {
      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (self.state.sending) return;
        const textarea = self.$('[data-field="body"]');
        const text = textarea ? textarea.value.trim() : '';
        if (text === '') return;

        self.setState({ sending: true });
        try {
          await api.post('/api/patient/messages', { body: text });
          // load() re-renders with a fresh, empty composer.
          await self.load();
          // Explicitly clear the sending flag - load() does not touch it.
          self.setState({ sending: false });
        } catch (err) {
          self.setState({
            status: 'error',
            sending: false,
            error:
              err && err.message
                ? err.message
                : 'Your Message Could Not Be Sent.',
          });
        }
      });
    }
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-message-thread')) {
  customElements.define('pnrx-message-thread', PnrxMessageThread);
}
