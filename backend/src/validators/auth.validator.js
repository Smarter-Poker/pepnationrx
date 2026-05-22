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
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed) && parsed < Date.now();
  }, 'Date of birth must be a valid past date.')
  .optional();

const registerSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  dateOfBirth: dateOfBirthSchema,
  sexAtBirth: z.enum(['male', 'female', 'intersex']).optional(),
  // Two-letter US state of residence. Optional at the API layer so older
  // clients still register; the sign-up form collects it so a telehealth
  // encounter can be routed to the correct visit modality.
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'State must be a two-letter code.')
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
