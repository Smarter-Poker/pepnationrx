// ============================================================================
// Triage protocol catalog and branching question schema.
// ----------------------------------------------------------------------------
// This module is pure data plus small helper functions. It defines every
// clinical triage question, the branching rules that decide which questions
// apply, and the per-answer risk and disqualification contributions.
//
// The component in components/pnrx-triage-form.js walks this schema; it
// contains no medical content of its own.
//
// QUESTION SHAPE
//   id        string   unique key within a triage session
//   type      string   'single' | 'multi' | 'boolean' | 'number' | 'text'
//   prompt    string   the question text (Title Case)
//   help      string   optional supporting guidance
//   unit      string   optional, for number questions
//   min,max   number   optional bounds for number questions
//   optional  boolean   defaults to false (the question is required)
//   when      function  optional (answers) => boolean branching predicate;
//                        when it returns false the question is skipped
//   options   array     for 'single' and 'multi' types
//   evaluate  function  optional (value, answers) => contribution, used by
//                        'boolean' / 'number' / 'text' questions
//
// OPTION SHAPE
//   value     string
//   label     string   Title Case
//   flag      string   optional triage flag key set when chosen
//   risk      string   optional 'moderate' | 'high' | 'disqualify'
//   reason    string   optional message shown on disqualification
//
// CONTRIBUTION SHAPE (returned by evaluate, or assembled from an option)
//   { risk?: string, flags?: string[], disqualify?: boolean, reason?: string }
// ============================================================================

'use strict';

// Ordered clinical risk levels. Mirrors the clinical_risk_level enum in
// database/schema.sql. Index doubles as severity rank.
export const RISK_LEVELS = ['low', 'moderate', 'high', 'disqualified'];

// Return the severity rank of a risk level; unknown values rank lowest.
export function riskRank(level) {
  const index = RISK_LEVELS.indexOf(level);
  return index === -1 ? 0 : index;
}

// ----------------------------------------------------------------------------
// Shared intake: asked at the start of every protocol, before the
// protocol-specific questions.
// ----------------------------------------------------------------------------
export const SHARED_INTAKE = [
  {
    id: 'biological_sex',
    type: 'single',
    prompt: 'What Is Your Biological Sex At Birth?',
    help: 'This Determines Which Clinical Screening Questions Apply.',
    options: [
      { value: 'male', label: 'Male' },
      { value: 'female', label: 'Female' },
      { value: 'intersex', label: 'Intersex' },
    ],
  },
  {
    id: 'age',
    type: 'number',
    prompt: 'How Old Are You?',
    help: 'Enter Your Age In Years.',
    unit: 'Years',
    min: 0,
    max: 120,
    evaluate: function (value) {
      if (value < 18) {
        return {
          disqualify: true,
          reason: 'Patients Must Be At Least 18 Years Old To Use This Platform.',
        };
      }
      if (value >= 70) {
        return { risk: 'high', flags: ['advanced_age'] };
      }
      if (value >= 60) {
        return { risk: 'moderate', flags: ['age_review'] };
      }
      return null;
    },
  },
  {
    id: 'height_in',
    type: 'number',
    prompt: 'What Is Your Height?',
    help: 'Enter Your Height In Total Inches. For Example, Five Feet Ten Inches Is 70.',
    unit: 'Inches',
    min: 36,
    max: 96,
  },
  {
    id: 'weight_lb',
    type: 'number',
    prompt: 'What Is Your Current Weight?',
    help: 'Enter Your Weight In Pounds.',
    unit: 'Pounds',
    min: 70,
    max: 800,
  },
  {
    id: 'pregnant_or_nursing',
    type: 'boolean',
    prompt: 'Are You Currently Pregnant, Trying To Become Pregnant, Or Nursing?',
    when: function (answers) {
      return answers.biological_sex === 'female';
    },
    evaluate: function (value) {
      if (value === true) {
        return {
          disqualify: true,
          reason:
            'Treatment Is Not Available During Pregnancy Or While Nursing. ' +
            'Please Consult Your Own Physician.',
        };
      }
      return null;
    },
  },
  {
    id: 'cardiac_history',
    type: 'single',
    prompt: 'Which Best Describes Your Heart Health History?',
    options: [
      { value: 'none', label: 'No Known Heart Conditions' },
      {
        value: 'managed',
        label: 'A Managed, Stable Condition',
        risk: 'high',
        flag: 'cardiac_managed',
      },
      {
        value: 'recent_event',
        label: 'A Heart Attack Or Stroke In The Last 12 Months',
        risk: 'disqualify',
        reason:
          'A Recent Cardiac Event Requires In-Person Care. This Platform ' +
          'Cannot Safely Provide Treatment At This Time.',
      },
    ],
  },
  {
    id: 'cancer_history',
    type: 'single',
    prompt: 'Do You Have Any History Of Cancer?',
    options: [
      { value: 'none', label: 'No History Of Cancer' },
      {
        value: 'remission',
        label: 'In Remission',
        risk: 'moderate',
        flag: 'oncology_review',
      },
      {
        value: 'active',
        label: 'Currently In Active Treatment',
        risk: 'disqualify',
        reason:
          'Active Cancer Treatment Requires Coordinated In-Person Oncology Care.',
      },
    ],
  },
  {
    id: 'current_medications',
    type: 'text',
    prompt: 'List Any Medications You Currently Take.',
    help: 'Include Prescription And Over-The-Counter Medications. Enter None If Not Applicable.',
    optional: true,
  },
  {
    id: 'known_allergies',
    type: 'text',
    prompt: 'List Any Known Drug Allergies.',
    help: 'Enter None If Not Applicable.',
    optional: true,
  },
];

// ----------------------------------------------------------------------------
// Protocol-specific question sets.
// ----------------------------------------------------------------------------
const TRT_QUESTIONS = [
  {
    id: 'low_t_symptoms',
    type: 'multi',
    prompt: 'Which Of These Symptoms Are You Experiencing?',
    help: 'Select All That Apply.',
    options: [
      { value: 'fatigue', label: 'Persistent Fatigue' },
      { value: 'low_libido', label: 'Low Libido' },
      { value: 'mood', label: 'Low Mood Or Irritability' },
      { value: 'muscle_loss', label: 'Loss Of Muscle Or Strength' },
      { value: 'brain_fog', label: 'Difficulty Concentrating' },
      { value: 'none', label: 'None Of These' },
    ],
  },
  {
    id: 'prior_trt',
    type: 'boolean',
    prompt: 'Have You Used Testosterone Therapy Before?',
  },
  {
    id: 'prostate_concern',
    type: 'single',
    prompt: 'Which Best Describes Your Prostate Health?',
    when: function (answers) {
      return answers.biological_sex !== 'female';
    },
    options: [
      { value: 'none', label: 'No Known Prostate Concerns' },
      {
        value: 'bph',
        label: 'Diagnosed With An Enlarged Prostate',
        risk: 'moderate',
        flag: 'bph_review',
      },
      {
        value: 'elevated_psa',
        label: 'A Recent Elevated PSA Result',
        risk: 'high',
        flag: 'psa_review',
      },
      {
        value: 'prostate_cancer',
        label: 'A History Of Prostate Cancer',
        risk: 'disqualify',
        reason:
          'A Prostate Cancer History Requires Specialist Review Before Any ' +
          'Hormone Therapy Can Be Considered.',
      },
    ],
  },
  {
    id: 'fertility_intent',
    type: 'boolean',
    prompt: 'Are You Currently Trying To Conceive?',
    evaluate: function (value) {
      if (value === true) {
        return { risk: 'moderate', flags: ['fertility_counsel'] };
      }
      return null;
    },
  },
  {
    id: 'recent_labs',
    type: 'single',
    prompt: 'When Did You Last Have Bloodwork Done?',
    options: [
      { value: 'within_6mo', label: 'Within The Last 6 Months' },
      {
        value: 'older',
        label: 'More Than 6 Months Ago',
        flag: 'labs_recommended',
      },
      {
        value: 'none',
        label: 'I Have Never Had Hormone Bloodwork',
        risk: 'moderate',
        flag: 'labs_required',
      },
    ],
  },
];

const WEIGHT_QUESTIONS = [
  {
    id: 'weight_goal',
    type: 'single',
    prompt: 'What Is Your Primary Weight Goal?',
    options: [
      { value: 'lose_10_25', label: 'Lose 10 To 25 Pounds' },
      { value: 'lose_25_50', label: 'Lose 25 To 50 Pounds' },
      { value: 'lose_50_plus', label: 'Lose More Than 50 Pounds' },
      { value: 'recomp', label: 'Improve Body Composition' },
    ],
  },
  {
    id: 'prior_glp1',
    type: 'boolean',
    prompt: 'Have You Used A GLP-1 Medication Before?',
    help: 'Examples Include Semaglutide And Tirzepatide.',
  },
  {
    id: 'thyroid_history',
    type: 'single',
    prompt: 'Which Best Describes Your Thyroid History?',
    options: [
      { value: 'none', label: 'No Thyroid Conditions' },
      {
        value: 'hypothyroid',
        label: 'Managed Hypothyroidism',
        flag: 'thyroid_managed',
      },
      {
        value: 'mtc',
        label: 'Medullary Thyroid Cancer, Personal Or Family',
        risk: 'disqualify',
        reason:
          'A History Of Medullary Thyroid Cancer Is A Contraindication For ' +
          'GLP-1 Based Therapy.',
      },
      {
        value: 'men2',
        label: 'Multiple Endocrine Neoplasia Type 2',
        risk: 'disqualify',
        reason:
          'Multiple Endocrine Neoplasia Type 2 Is A Contraindication For ' +
          'GLP-1 Based Therapy.',
      },
    ],
  },
  {
    id: 'pancreatitis_history',
    type: 'boolean',
    prompt: 'Have You Ever Been Diagnosed With Pancreatitis?',
    evaluate: function (value) {
      if (value === true) {
        return {
          disqualify: true,
          reason:
            'A History Of Pancreatitis Requires In-Person Evaluation Before ' +
            'This Therapy Can Be Considered.',
        };
      }
      return null;
    },
  },
  {
    id: 'eating_disorder_history',
    type: 'boolean',
    prompt: 'Do You Have A History Of An Eating Disorder?',
    evaluate: function (value) {
      if (value === true) {
        return { risk: 'high', flags: ['eating_disorder_review'] };
      }
      return null;
    },
  },
];

const PEPTIDE_QUESTIONS = [
  {
    id: 'peptide_goals',
    type: 'multi',
    prompt: 'What Are You Hoping Peptide Therapy Will Support?',
    help: 'Select All That Apply.',
    options: [
      { value: 'recovery', label: 'Faster Recovery From Training' },
      { value: 'joint_repair', label: 'Joint And Tendon Repair' },
      { value: 'sleep', label: 'Sleep Quality' },
      { value: 'immune', label: 'Immune Support' },
      { value: 'skin', label: 'Skin And Tissue Health' },
    ],
  },
  {
    id: 'prior_peptide_use',
    type: 'boolean',
    prompt: 'Have You Used Peptide Therapy Before?',
  },
  {
    id: 'active_injury',
    type: 'text',
    prompt: 'Describe Any Current Injury You Are Recovering From.',
    help: 'Enter None If Not Applicable.',
    optional: true,
  },
];

const MENS_QUESTIONS = [
  {
    id: 'mens_focus',
    type: 'multi',
    prompt: 'Which Areas Would You Like To Focus On?',
    help: 'Select All That Apply.',
    options: [
      { value: 'energy', label: 'Energy And Vitality' },
      { value: 'body_composition', label: 'Body Composition' },
      { value: 'libido', label: 'Libido' },
      { value: 'hair', label: 'Hair Health' },
      { value: 'skin', label: 'Skin Health' },
    ],
  },
  {
    id: 'mens_prior_treatment',
    type: 'boolean',
    prompt: 'Have You Used Any Hormone Or Optimization Therapy Before?',
  },
];

const WOMENS_QUESTIONS = [
  {
    id: 'womens_focus',
    type: 'multi',
    prompt: 'Which Areas Would You Like To Focus On?',
    help: 'Select All That Apply.',
    options: [
      { value: 'hormone_balance', label: 'Hormone Balance' },
      { value: 'energy', label: 'Energy And Vitality' },
      { value: 'libido', label: 'Libido' },
      { value: 'skin', label: 'Skin Health' },
      { value: 'weight', label: 'Weight Management' },
    ],
  },
  {
    id: 'menopause_stage',
    type: 'single',
    prompt: 'Which Stage Best Describes You?',
    when: function (answers) {
      return answers.biological_sex === 'female';
    },
    options: [
      { value: 'pre', label: 'Pre-Menopausal' },
      { value: 'peri', label: 'Peri-Menopausal', flag: 'perimenopause' },
      { value: 'post', label: 'Post-Menopausal', flag: 'postmenopause' },
    ],
  },
  {
    id: 'current_hormone_therapy',
    type: 'boolean',
    prompt: 'Are You Currently Using Any Hormone Therapy?',
    evaluate: function (value) {
      if (value === true) {
        return { risk: 'moderate', flags: ['concurrent_hormone_therapy'] };
      }
      return null;
    },
  },
];

const SEXUAL_HEALTH_QUESTIONS = [
  {
    id: 'sexual_concern',
    type: 'single',
    prompt: 'What Would You Like To Address?',
    options: [
      { value: 'ed', label: 'Erectile Function' },
      { value: 'low_libido', label: 'Low Libido' },
      { value: 'performance', label: 'Performance And Confidence' },
      { value: 'other', label: 'Another Concern' },
    ],
  },
  {
    id: 'nitrate_use',
    type: 'boolean',
    prompt: 'Do You Take Any Nitrate Medication, For Example Nitroglycerin?',
    evaluate: function (value) {
      if (value === true) {
        return {
          disqualify: true,
          reason:
            'Therapies In This Category Cannot Be Combined With Nitrate ' +
            'Medication. Please Consult Your Cardiologist.',
        };
      }
      return null;
    },
  },
  {
    id: 'cardiac_clearance',
    type: 'boolean',
    prompt: 'Has A Clinician Confirmed You Are Healthy Enough For Sexual Activity?',
    evaluate: function (value) {
      if (value === false) {
        return { risk: 'moderate', flags: ['cardiac_clearance_needed'] };
      }
      return null;
    },
  },
];

const LONGEVITY_QUESTIONS = [
  {
    id: 'longevity_goals',
    type: 'multi',
    prompt: 'Which Longevity Outcomes Matter Most To You?',
    help: 'Select All That Apply.',
    options: [
      { value: 'healthspan', label: 'Overall Healthspan' },
      { value: 'cognition', label: 'Cognitive Performance' },
      { value: 'metabolic', label: 'Metabolic Health' },
      { value: 'inflammation', label: 'Inflammation And Recovery' },
    ],
  },
  {
    id: 'biomarker_tracking',
    type: 'boolean',
    prompt: 'Do You Currently Track Bloodwork Or Biomarkers?',
    evaluate: function (value) {
      if (value === false) {
        return { flags: ['baseline_panel_recommended'] };
      }
      return null;
    },
  },
  {
    id: 'supplement_stack',
    type: 'text',
    prompt: 'List Any Supplements You Take Regularly.',
    help: 'Enter None If Not Applicable.',
    optional: true,
  },
];

// ----------------------------------------------------------------------------
// Protocol catalog. The category field matches the protocol_category enum in
// database/schema.sql so a submission maps cleanly onto intake_submissions.
// ----------------------------------------------------------------------------
export const PROTOCOLS = [
  {
    id: 'trt',
    category: 'trt',
    label: 'Testosterone Optimization',
    blurb: 'Hormone Therapy For Energy, Strength, And Vitality.',
    questions: TRT_QUESTIONS,
  },
  {
    id: 'weight_management',
    category: 'weight_management',
    label: 'Weight Management',
    blurb: 'Medically Supervised Programs Built Around GLP-1 Therapy.',
    questions: WEIGHT_QUESTIONS,
  },
  {
    id: 'peptide_therapy',
    category: 'peptide_therapy',
    label: 'Peptide Therapy',
    blurb: 'Targeted Peptides For Recovery, Repair, And Resilience.',
    questions: PEPTIDE_QUESTIONS,
  },
  {
    id: 'mens_optimization',
    category: 'mens_optimization',
    label: 'Mens Optimization',
    blurb: 'A Broad Program For Energy, Composition, And Performance.',
    questions: MENS_QUESTIONS,
  },
  {
    id: 'womens_wellness',
    category: 'womens_wellness',
    label: 'Womens Wellness',
    blurb: 'Hormone And Vitality Support Tailored For Women.',
    questions: WOMENS_QUESTIONS,
  },
  {
    id: 'sexual_health',
    category: 'sexual_health',
    label: 'Sexual Health',
    blurb: 'Discreet, Clinician-Reviewed Sexual Health Care.',
    questions: SEXUAL_HEALTH_QUESTIONS,
  },
  {
    id: 'longevity',
    category: 'longevity',
    label: 'Longevity',
    blurb: 'Proactive Protocols Focused On Long-Term Healthspan.',
    questions: LONGEVITY_QUESTIONS,
  },
];

// Look up a protocol by its id. Returns null when not found.
export function getProtocol(id) {
  for (let i = 0; i < PROTOCOLS.length; i += 1) {
    if (PROTOCOLS[i].id === id) return PROTOCOLS[i];
  }
  return null;
}

// Build the full ordered question list for a protocol: shared intake first,
// then the protocol-specific questions.
export function buildQuestionList(protocolId) {
  const protocol = getProtocol(protocolId);
  if (!protocol) return [];
  return SHARED_INTAKE.concat(protocol.questions);
}
