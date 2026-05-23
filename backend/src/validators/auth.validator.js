'use strict';

// ============================================================================
// Auth request schemas (Zod).
// These define the accepted shape of each authentication request body. The
// validate middleware applies them; controllers receive already-clean input.
// ============================================================================

const { z } = require('zod');

// Email: trimmed, lowercased, format-checked. Stored in a CITEXT column, so
// case is not significant, but normalizing keeps tokens and logs consistent.
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('A valid email address is required.')
  .max(254);

// Password policy for new accounts. The ceiling guards against bcrypt's
// 72-byte input truncation being relied upon by very long inputs.
const newPasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.');

// Optional ISO date string (YYYY-MM-DD) that must be a real past date.
const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format.')
  .refine((value) => {
    // Date parsing rolls impossible dates over (2021-02-30 becomes Mar 2), so
    // a real date must format back to exactly the input string.
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed.toISOString().slice(0, 10) !== value) return false;
    return parsed.getTime() < Date.now();
  }, 'Date of birth must be a valid past date.')
  .optional();

// The 50 US states plus the District of Columbia, by USPS code. A telehealth
// encounter is routed by the patient's state, so an unrecognized two-letter
// code must not pass validation.
const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  dateOfBirth: dateOfBirthSchema,
  sexAtBirth: z.enum(['male', 'female', 'intersex']).optional(),
  // US state of residence, validated against the real USPS codes. Optional at
  // the API layer so older clients still register; the sign-up form collects
  // it so a telehealth encounter can be routed to the correct visit modality.
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => US_STATE_CODES.includes(v), 'A valid US state code is required.')
    .optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  // Login does not re-apply the strength policy; it only checks presence.
  password: z.string().min(1, 'Password is required.').max(128),
});

// Refresh and logout accept the token either in the body or, preferably, in
// an httpOnly cookie. The body field is therefore optional here.
const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

module.exports = {
  registerSchema: registerSchema,
  loginSchema: loginSchema,
  refreshSchema: refreshSchema,
};
