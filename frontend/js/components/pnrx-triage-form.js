// ============================================================================
// pnrx-triage-form - multi-step branching clinical intake questionnaire.
// ----------------------------------------------------------------------------
// Walks the schema in data/triage-protocols.js: the patient picks a protocol,
// answers a branching set of questions, and the component derives a clinical
// risk level and a set of triage flags. On submit it emits a "triage:submit"
// CustomEvent whose detail maps onto the intake_submissions table.
//
// A disqualifying answer halts the flow immediately and shows a clear,
// supportive message rather than routing the patient to treatment.
//
// This component performs screening only. It is not a diagnosis; every
// submission is reviewed by an independent, licensed clinician.
// ============================================================================

'use strict';

import { PnrxComponent, escapeHtml } from '../core/component.js';
import {
  PROTOCOLS,
  buildQuestionList,
  getProtocol,
  riskRank,
} from '../data/triage-protocols.js';

// ----------------------------------------------------------------------------
// Triage engine helpers (pure functions, no DOM).
// ----------------------------------------------------------------------------

// Convert a single/multi option into a normalized contribution object.
function normalizeOption(option) {
  const contribution = { risk: null, flags: [], disqualify: false, reason: null };
  if (option.flag) {
    contribution.flags.push(option.flag);
  }
  if (option.risk === 'disqualify') {
    contribution.disqualify = true;
    contribution.reason = option.reason || null;
  } else if (option.risk) {
    contribution.risk = option.risk;
  }
  return contribution;
}

// Merge contribution `source` into `target` in place.
function mergeContribution(target, source) {
  if (!source) return target;
  if (source.flags) {
    source.flags.forEach(function (flag) {
      if (target.flags.indexOf(flag) === -1) target.flags.push(flag);
    });
  }
  if (source.disqualify) {
    target.disqualify = true;
    target.reason = target.reason || source.reason || null;
  }
  if (source.risk && riskRank(source.risk) > riskRank(target.risk)) {
    target.risk = source.risk;
  }
  return target;
}

// Compute the contribution of one answered question.
function contributionOf(question, value, answers) {
  if (value === undefined || value === null || value === '') return null;

  if (question.type === 'single') {
    const option = (question.options || []).filter(function (o) {
      return o.value === value;
    })[0];
    return option ? normalizeOption(option) : null;
  }

  if (question.type === 'multi') {
    const merged = { risk: null, flags: [], disqualify: false, reason: null };
    (value || []).forEach(function (chosen) {
      const option = (question.options || []).filter(function (o) {
        return o.value === chosen;
      })[0];
      if (option) mergeContribution(merged, normalizeOption(option));
    });
    return merged;
  }

  if (typeof question.evaluate === 'function') {
    return question.evaluate(value, answers);
  }
  return null;
}

// ----------------------------------------------------------------------------
// Component.
// ----------------------------------------------------------------------------
export class PnrxTriageForm extends PnrxComponent {
  constructor() {
    super();
    this.state = {
      screen: 'protocol', // protocol | question | review | disqualified | submitted
      protocolId: null,
      answers: {},
      stepIndex: 0,
      disqualifyReason: null,
    };
  }

  // The ordered list of questions currently visible, given the answers so far.
  visibleQuestions() {
    if (!this.state.protocolId) return [];
    const answers = this.state.answers;
    return buildQuestionList(this.state.protocolId).filter(function (question) {
      return typeof question.when !== 'function' || question.when(answers);
    });
  }

  // The question at the current step, or null.
  currentQuestion() {
    return this.visibleQuestions()[this.state.stepIndex] || null;
  }

  // True when the current question has an acceptable answer.
  isAnswered(question) {
    if (!question) return false;
    const value = this.state.answers[question.id];
    if (question.type === 'text') {
      return question.optional === true || (typeof value === 'string' && value.trim() !== '');
    }
    if (question.type === 'multi') {
      return Array.isArray(value) && value.length > 0;
    }
    if (question.type === 'number') {
      return typeof value === 'number' && !Number.isNaN(value);
    }
    if (question.type === 'boolean') {
      return value === true || value === false;
    }
    return value !== undefined && value !== null && value !== '';
  }

  // Walk every visible answered question and reduce to a triage result.
  evaluateTriage() {
    const answers = this.state.answers;
    let topRisk = 'low';
    const flags = {};
    let disqualified = false;
    let reason = null;

    this.visibleQuestions().forEach(function (question) {
      const contribution = contributionOf(question, answers[question.id], answers);
      if (!contribution) return;
      (contribution.flags || []).forEach(function (flag) {
        flags[flag] = true;
      });
      if (contribution.disqualify) {
        disqualified = true;
        reason = reason || contribution.reason;
      }
      if (contribution.risk && riskRank(contribution.risk) > riskRank(topRisk)) {
        topRisk = contribution.risk;
      }
    });

    return {
      riskLevel: disqualified ? 'disqualified' : topRisk,
      flags: flags,
      disqualified: disqualified,
      reason: reason,
    };
  }

  // -- State transitions -----------------------------------------------------

  selectProtocol(protocolId) {
    this.setState({
      screen: 'question',
      protocolId: protocolId,
      answers: {},
      stepIndex: 0,
      disqualifyReason: null,
    });
  }

  setAnswer(questionId, value) {
    const answers = Object.assign({}, this.state.answers);
    answers[questionId] = value;
    this.setState({ answers: answers });
  }

  // Write a value without a re-render. Used by free-text and number inputs so
  // the field does not lose focus on every keystroke.
  setAnswerQuiet(questionId, value) {
    this.state.answers[questionId] = value;
  }

  toggleMulti(questionId, optionValue) {
    const current = (this.state.answers[questionId] || []).slice();
    let next;
    if (optionValue === 'none') {
      next = current.indexOf('none') !== -1 ? [] : ['none'];
    } else {
      next = current.filter(function (v) {
        return v !== 'none';
      });
      const index = next.indexOf(optionValue);
      if (index === -1) {
        next.push(optionValue);
      } else {
        next.splice(index, 1);
      }
    }
    this.setAnswer(questionId, next);
  }

  goNext() {
    const question = this.currentQuestion();
    if (!this.isAnswered(question)) return;

    const contribution = contributionOf(
      question,
      this.state.answers[question.id],
      this.state.answers
    );
    if (contribution && contribution.disqualify) {
      this.setState({ screen: 'disqualified', disqualifyReason: contribution.reason });
      return;
    }

    const visible = this.visibleQuestions();
    if (this.state.stepIndex >= visible.length - 1) {
      this.setState({ screen: 'review' });
    } else {
      this.setState({ stepIndex: this.state.stepIndex + 1 });
    }
  }

  goBack() {
    if (this.state.stepIndex <= 0) {
      this.setState({ screen: 'protocol', protocolId: null, stepIndex: 0 });
    } else {
      this.setState({ stepIndex: this.state.stepIndex - 1 });
    }
  }

  reset() {
    this.setState({
      screen: 'protocol',
      protocolId: null,
      answers: {},
      stepIndex: 0,
      disqualifyReason: null,
    });
  }

  submit() {
    const protocol = getProtocol(this.state.protocolId);
    // Defensive: submit is only reachable from the review screen, but if the
    // protocol id is ever missing, return to the protocol picker rather than
    // dereferencing a null protocol.
    if (!protocol) {
      this.setState({ screen: 'protocol', protocolId: null });
      return;
    }
    const result = this.evaluateTriage();
    // A disqualified result should never reach submit, but guard anyway.
    if (result.disqualified) {
      this.setState({ screen: 'disqualified', disqualifyReason: result.reason });
      return;
    }
    this.emit('triage:submit', {
      protocolId: protocol.id,
      protocolCategory: protocol.category,
      answers: Object.assign({}, this.state.answers),
      triageFlags: result.flags,
      riskLevel: result.riskLevel,
      status: 'submitted',
    });
    this.setState({ screen: 'submitted' });
  }

  // -- Rendering -------------------------------------------------------------

  render() {
    let body;
    if (this.state.screen === 'protocol') {
      body = this.renderProtocolScreen();
    } else if (this.state.screen === 'question') {
      body = this.renderQuestionScreen();
    } else if (this.state.screen === 'review') {
      body = this.renderReviewScreen();
    } else if (this.state.screen === 'disqualified') {
      body = this.renderDisqualifiedScreen();
    } else {
      body = this.renderSubmittedScreen();
    }

    return (
      '<div class="pnrx-triage">' +
      body +
      '<p class="pnrx-triage__legal">This Questionnaire Is A Clinical Screening ' +
      'Tool, Not A Diagnosis. Every Response Is Reviewed By An Independent, ' +
      'Licensed Clinician Before Any Treatment Is Offered.</p>' +
      '</div>'
    );
  }

  renderProtocolScreen() {
    const cards = PROTOCOLS.map(function (protocol) {
      return (
        '<button type="button" class="pnrx-triage__card" data-protocol="' +
        escapeHtml(protocol.id) +
        '">' +
        '<span class="pnrx-triage__card-title">' +
        escapeHtml(protocol.label) +
        '</span>' +
        '<span class="pnrx-triage__card-blurb">' +
        escapeHtml(protocol.blurb) +
        '</span>' +
        '</button>'
      );
    }).join('');

    return (
      '<header class="pnrx-triage__head">' +
      '<h2 class="pnrx-triage__title">Begin Your Clinical Intake</h2>' +
      '<p class="pnrx-triage__sub">Select The Program You Would Like To Be ' +
      'Evaluated For. You Can Change This At Any Time.</p>' +
      '</header>' +
      '<div class="pnrx-triage__grid">' +
      cards +
      '</div>'
    );
  }

  renderQuestionScreen() {
    const visible = this.visibleQuestions();
    const question = visible[this.state.stepIndex];
    if (!question) {
      return this.renderReviewScreen();
    }

    const total = visible.length;
    const stepNumber = this.state.stepIndex + 1;
    const percent = Math.round((this.state.stepIndex / total) * 100);
    const answered = this.isAnswered(question);
    const optionalNote =
      question.optional === true
        ? '<span class="pnrx-triage__optional">Optional</span>'
        : '';
    const help = question.help
      ? '<p class="pnrx-triage__help">' + escapeHtml(question.help) + '</p>'
      : '';

    return (
      '<header class="pnrx-triage__head">' +
      '<div class="pnrx-triage__progress" role="progressbar" ' +
      'aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      percent +
      '">' +
      '<span class="pnrx-triage__progress-fill" style="width:' +
      percent +
      '%"></span>' +
      '</div>' +
      '<p class="pnrx-triage__step">Step ' +
      stepNumber +
      ' Of ' +
      total +
      '</p>' +
      '</header>' +
      '<div class="pnrx-triage__question">' +
      '<h2 class="pnrx-triage__prompt">' +
      escapeHtml(question.prompt) +
      optionalNote +
      '</h2>' +
      help +
      this.renderInput(question) +
      '</div>' +
      '<footer class="pnrx-triage__foot">' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--ghost" ' +
      'data-action="back">Back</button>' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--primary" ' +
      'data-action="next"' +
      (answered ? '' : ' disabled') +
      '>Continue</button>' +
      '</footer>'
    );
  }

  renderInput(question) {
    const value = this.state.answers[question.id];

    if (question.type === 'single') {
      const options = (question.options || []).map(function (option) {
        const selected = value === option.value ? ' is-selected' : '';
        return (
          '<button type="button" class="pnrx-triage__option' +
          selected +
          '" data-option="' +
          escapeHtml(option.value) +
          '">' +
          escapeHtml(option.label) +
          '</button>'
        );
      });
      return '<div class="pnrx-triage__options">' + options.join('') + '</div>';
    }

    if (question.type === 'multi') {
      const chosen = Array.isArray(value) ? value : [];
      const options = (question.options || []).map(function (option) {
        const selected = chosen.indexOf(option.value) !== -1 ? ' is-selected' : '';
        return (
          '<button type="button" class="pnrx-triage__option pnrx-triage__option--multi' +
          selected +
          '" data-option="' +
          escapeHtml(option.value) +
          '">' +
          escapeHtml(option.label) +
          '</button>'
        );
      });
      return '<div class="pnrx-triage__options">' + options.join('') + '</div>';
    }

    if (question.type === 'boolean') {
      const yes = value === true ? ' is-selected' : '';
      const no = value === false ? ' is-selected' : '';
      return (
        '<div class="pnrx-triage__options pnrx-triage__options--row">' +
        '<button type="button" class="pnrx-triage__option' +
        yes +
        '" data-bool="yes">Yes</button>' +
        '<button type="button" class="pnrx-triage__option' +
        no +
        '" data-bool="no">No</button>' +
        '</div>'
      );
    }

    if (question.type === 'number') {
      const numValue = typeof value === 'number' ? String(value) : '';
      const unit = question.unit
        ? '<span class="pnrx-triage__unit">' + escapeHtml(question.unit) + '</span>'
        : '';
      return (
        '<div class="pnrx-triage__field">' +
        '<input type="number" class="pnrx-triage__number" data-input="number" ' +
        'inputmode="numeric" value="' +
        escapeHtml(numValue) +
        '"' +
        (typeof question.min === 'number' ? ' min="' + question.min + '"' : '') +
        (typeof question.max === 'number' ? ' max="' + question.max + '"' : '') +
        ' />' +
        unit +
        '</div>'
      );
    }

    // text
    const textValue = typeof value === 'string' ? value : '';
    return (
      '<div class="pnrx-triage__field">' +
      '<textarea class="pnrx-triage__text" data-input="text" rows="3">' +
      escapeHtml(textValue) +
      '</textarea>' +
      '</div>'
    );
  }

  renderReviewScreen() {
    const self = this;
    const result = this.evaluateTriage();
    const protocol = getProtocol(this.state.protocolId);

    const rows = this.visibleQuestions()
      .map(function (question) {
        const display = self.displayAnswer(question);
        if (display === null) return '';
        return (
          '<div class="pnrx-triage__review-row">' +
          '<span class="pnrx-triage__review-q">' +
          escapeHtml(question.prompt) +
          '</span>' +
          '<span class="pnrx-triage__review-a">' +
          escapeHtml(display) +
          '</span>' +
          '</div>'
        );
      })
      .join('');

    const flagKeys = Object.keys(result.flags);
    const flagList = flagKeys.length
      ? '<ul class="pnrx-triage__flags">' +
        flagKeys
          .map(function (flag) {
            return '<li>' + escapeHtml(self.humanizeFlag(flag)) + '</li>';
          })
          .join('') +
        '</ul>'
      : '<p class="pnrx-triage__sub">No Additional Review Items Were Flagged.</p>';

    return (
      '<header class="pnrx-triage__head">' +
      '<h2 class="pnrx-triage__title">Review Your Answers</h2>' +
      '<p class="pnrx-triage__sub">Confirm The Details Below Before Submitting ' +
      'Your Intake For ' +
      escapeHtml(protocol ? protocol.label : '') +
      '.</p>' +
      '</header>' +
      '<div class="pnrx-triage__riskcard pnrx-triage__riskcard--' +
      escapeHtml(result.riskLevel) +
      '">' +
      '<span class="pnrx-triage__risk-label">Preliminary Screening Tier</span>' +
      '<span class="pnrx-triage__risk-value">' +
      escapeHtml(this.humanizeRisk(result.riskLevel)) +
      '</span>' +
      '</div>' +
      '<div class="pnrx-triage__review">' +
      rows +
      '</div>' +
      '<h3 class="pnrx-triage__subhead">Clinician Review Notes</h3>' +
      flagList +
      '<footer class="pnrx-triage__foot">' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--ghost" ' +
      'data-action="edit">Back</button>' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--primary" ' +
      'data-action="submit">Submit Intake</button>' +
      '</footer>'
    );
  }

  renderDisqualifiedScreen() {
    const reason =
      this.state.disqualifyReason ||
      'Based On Your Answers, This Platform Is Not The Right Fit For Care At ' +
      'This Time.';
    return (
      '<div class="pnrx-triage__end pnrx-triage__end--stop">' +
      '<h2 class="pnrx-triage__title">We Cannot Continue This Intake</h2>' +
      '<p class="pnrx-triage__sub">' +
      escapeHtml(reason) +
      '</p>' +
      '<p class="pnrx-triage__sub">Your Safety Comes First. Please Speak With ' +
      'Your Own Physician About The Care That Is Right For You.</p>' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--ghost" ' +
      'data-action="reset">Start Over</button>' +
      '</div>'
    );
  }

  renderSubmittedScreen() {
    return (
      '<div class="pnrx-triage__end pnrx-triage__end--done">' +
      '<h2 class="pnrx-triage__title">Your Intake Has Been Submitted</h2>' +
      '<p class="pnrx-triage__sub">An Independent, Licensed Clinician Will ' +
      'Review Your Responses. You Will Be Notified Once The Review Is ' +
      'Complete.</p>' +
      '<button type="button" class="pnrx-triage__btn pnrx-triage__btn--ghost" ' +
      'data-action="reset">Start A New Intake</button>' +
      '</div>'
    );
  }

  // -- Display helpers -------------------------------------------------------

  // Human-readable answer for the review screen, or null to hide the row.
  displayAnswer(question) {
    const value = this.state.answers[question.id];
    if (value === undefined || value === null || value === '') {
      return question.optional ? 'Not Provided' : null;
    }
    if (question.type === 'boolean') {
      return value === true ? 'Yes' : 'No';
    }
    if (question.type === 'number') {
      return String(value) + (question.unit ? ' ' + question.unit : '');
    }
    if (question.type === 'text') {
      return value;
    }
    if (question.type === 'single') {
      const option = (question.options || []).filter(function (o) {
        return o.value === value;
      })[0];
      return option ? option.label : String(value);
    }
    if (question.type === 'multi') {
      const labels = (value || []).map(function (chosen) {
        const option = (question.options || []).filter(function (o) {
          return o.value === chosen;
        })[0];
        return option ? option.label : chosen;
      });
      return labels.length ? labels.join(', ') : 'None Selected';
    }
    return String(value);
  }

  humanizeRisk(level) {
    if (level === 'low') return 'Standard Review';
    if (level === 'moderate') return 'Enhanced Review';
    if (level === 'high') return 'Priority Clinical Review';
    if (level === 'disqualified') return 'Not Eligible';
    return level;
  }

  humanizeFlag(flag) {
    return flag
      .split('_')
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  // -- Event binding ---------------------------------------------------------

  afterRender() {
    const self = this;

    this.$$('[data-protocol]').forEach(function (button) {
      button.addEventListener('click', function () {
        self.selectProtocol(button.getAttribute('data-protocol'));
      });
    });

    const question = this.currentQuestion();

    this.$$('[data-option]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!question) return;
        const optionValue = button.getAttribute('data-option');
        if (question.type === 'multi') {
          self.toggleMulti(question.id, optionValue);
        } else {
          self.setAnswer(question.id, optionValue);
        }
      });
    });

    this.$$('[data-bool]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!question) return;
        self.setAnswer(question.id, button.getAttribute('data-bool') === 'yes');
      });
    });

    const numberInput = this.$('[data-input="number"]');
    if (numberInput && question) {
      numberInput.addEventListener('input', function () {
        const raw = numberInput.value.trim();
        const parsed = raw === '' ? null : Number(raw);
        self.setAnswerQuiet(
          question.id,
          parsed === null || Number.isNaN(parsed) ? null : parsed
        );
        self.refreshContinueState();
      });
    }

    const textInput = this.$('[data-input="text"]');
    if (textInput && question) {
      textInput.addEventListener('input', function () {
        self.setAnswerQuiet(question.id, textInput.value);
        self.refreshContinueState();
      });
    }

    const back = this.$('[data-action="back"]');
    if (back) back.addEventListener('click', function () { self.goBack(); });

    const next = this.$('[data-action="next"]');
    if (next) next.addEventListener('click', function () { self.goNext(); });

    const edit = this.$('[data-action="edit"]');
    if (edit) {
      edit.addEventListener('click', function () {
        const visible = self.visibleQuestions();
        self.setState({
          screen: 'question',
          stepIndex: Math.max(0, visible.length - 1),
        });
      });
    }

    const submitBtn = this.$('[data-action="submit"]');
    if (submitBtn) submitBtn.addEventListener('click', function () { self.submit(); });

    const resetBtn = this.$('[data-action="reset"]');
    if (resetBtn) resetBtn.addEventListener('click', function () { self.reset(); });
  }

  // Toggle the Continue button without a full re-render (keeps input focus).
  refreshContinueState() {
    const next = this.$('[data-action="next"]');
    if (!next) return;
    next.disabled = !this.isAnswered(this.currentQuestion());
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-triage-form')) {
  customElements.define('pnrx-triage-form', PnrxTriageForm);
}
