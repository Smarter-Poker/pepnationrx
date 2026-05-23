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
      if (typeof value !== 'number' || Number.isNaN(value)) return false;
      // Enforce the schema's declared bounds: a value outside [min, max] is
      // not an acceptable answer, so it must not advance the flow.
      if (typeof question.min === 'number' && value < question.min) return false;
      if (typeof question.max === 'number' && value > question.max) return false;
      return true;
    }
    if (question.type === 'boolean') {
      return value === true || value === false;
    }
    return value !== undefined && value !== null && value !== '';
  }

  // Validation message for a number question whose current answer falls
  // outside its declared [min, max] bounds. Returns '' when the value is
  // acceptable or not yet entered, so an empty string means "no error".
  numberRangeError(question) {
    if (!question || question.type !== 'number') return '';
    const value = this.state.answers[question.id];
    if (typeof value !== 'number' || Number.isNaN(value)) return '';
    const unit = question.unit ? ' ' + question.unit : '';
    if (typeof question.min === 'number' && value < question.min) {
      return 'Please Enter A Value Of ' + question.min + unit + ' Or More.';
    }
    if (typeof question.max === 'number' && value > question.max) {
      return 'Please Enter A Value Of ' + question.max + unit + ' Or Less.';
    }
    return '';
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
    // Emit only answers for questions still visible under the final
    // branching. Changing an earlier answer can hide a later question;
    // without this, that question's now-irrelevant answer would leak into
    // the intake payload even though evaluateTriage already ignores it.
    const answers = this.state.answers;
    const visibleAnswers = {};
    this.visibleQuestions().forEach(function (question) {
      if (Object.prototype.hasOwnProperty.call(answers, question.id)) {
        visibleAnswers[question.id] = answers[question.id];
      }
    });
    this.emit('triage:submit', {
      protocolId: protocol.id,
      protocolCategory: protocol.category,
      answers: visibleAnswers,
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
      '<div class="pnrx-triage-page">' +
      '<div class="pnrx-triage">' +
      body +
      '<p class="pnrx-triage__legal">This Questionnaire Is A Clinical Screening ' +
      'Tool, Not A Diagnosis. Every Response Is Reviewed By An Independent, ' +
      'Licensed Clinician Before Any Treatment Is Offered.</p>' +
      '</div>' +
      '</div>'
    );
  }

  renderProtocolScreen() {
    // Clinical SVG icons — NO emojis. Simple line-art at 24x24 viewBox.
    const ICONS = {
      trt: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
      weight_management: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 0v3m0 0H6.5a2.5 2.5 0 0 0 0 5H12m0-5h5.5a2.5 2.5 0 0 1 0 5H12m0 0v9M4 21h16"/></svg>',
      peptide_therapy: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.5-7.5-2.1 2.1M7.6 16.4l-2.1 2.1m0-13.1 2.1 2.1m8.7 8.7 2.1 2.1"/></svg>',
      mens_optimization: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M4 20 20 4m0 0h-6m6 0v6"/><circle cx="9" cy="15" r="5"/></svg>',
      womens_wellness: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M12 15v6m-3-3h6"/></svg>',
      sexual_health: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      longevity: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    };

    const cards = PROTOCOLS.map(function (protocol) {
      const icon = ICONS[protocol.id] || '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>';
      return (
        '<button type="button" class="pnrx-triage__card" data-protocol="' +
        escapeHtml(protocol.id) +
        '">' +
        '<span class="pnrx-triage__card-icon" aria-hidden="true">' + icon + '</span>' +
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
      '<h2 class="pnrx-triage__title">Choose Your Program</h2>' +
      '<p class="pnrx-triage__sub">Select The Area You Would Like To Be ' +
      'Evaluated For. Your Responses Are Reviewed By A Licensed Clinician ' +
      'Before Any Treatment Is Recommended.</p>' +
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
        '</div>' +
        '<p class="pnrx-triage__error" data-number-error>' +
        escapeHtml(this.numberRangeError(question)) +
        '</p>'
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

  // Toggle the Continue button and refresh the inline number-range error
  // without a full re-render, so a number or free-text input keeps focus.
  refreshContinueState() {
    const question = this.currentQuestion();
    const next = this.$('[data-action="next"]');
    if (next) next.disabled = !this.isAnswered(question);
    const errorEl = this.$('[data-number-error]');
    if (errorEl) errorEl.textContent = this.numberRangeError(question);
  }
}

// Register the custom element once.
if (!customElements.get('pnrx-triage-form')) {
  customElements.define('pnrx-triage-form', PnrxTriageForm);
}
