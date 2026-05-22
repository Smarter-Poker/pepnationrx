// ============================================================================
// format.js - shared display formatting helpers for PepNationRX components.
// ----------------------------------------------------------------------------
// One source of truth for the formatting every component needs: cent amounts
// as dollars, timestamps as readable dates, and snake_case enum values as
// Title Case labels. Keeping these here prevents each component from carrying
// its own slightly different copy.
// ============================================================================

'use strict';

// Format an integer cent amount as a US dollar string, for example 19900 to
// "$199.00". A non-numeric input is treated as zero.
export function money(cents) {
  const value = Number(cents);
  const safe = Number.isFinite(value) ? value : 0;
  return '$' + (safe / 100).toFixed(2);
}

// Format an ISO date or timestamp as a short readable date, for example
// "May 22, 2026". Returns the fallback when the value is missing or invalid.
export function formatDate(value, fallback) {
  const miss = fallback || 'Not Available';
  if (!value) return miss;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return miss;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format an ISO timestamp as a readable date and time, for example
// "May 22, 2026, 3:04 PM". Returns the fallback when missing or invalid.
export function formatStamp(value, fallback) {
  const miss = fallback || 'Not Available';
  if (!value) return miss;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return miss;
  return parsed.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Convert a snake_case enum value into a Title Case label, for example
// "pending_clinical_review" to "Pending Clinical Review".
export function humanize(value) {
  if (!value) return '';
  return String(value)
    .split('_')
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
