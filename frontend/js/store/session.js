// ============================================================================
// session.js - the PepNationRX client session store.
// ----------------------------------------------------------------------------
// Holds the authenticated user and access token for the lifetime of the page.
// The access token is kept in memory only, never in localStorage, so it cannot
// be read by injected script; the refresh token lives in an httpOnly cookie
// the browser manages. Components subscribe() to react to sign-in / sign-out.
// ============================================================================

'use strict';

import { setAccessToken } from '../services/api.js';

// Module-level session state.
let currentUser = null;
let currentToken = null;
const listeners = [];

// Notify every subscriber that the session changed.
function notify() {
  const snapshot = { user: currentUser, authenticated: currentUser !== null };
  for (let i = 0; i < listeners.length; i += 1) {
    listeners[i](snapshot);
  }
}

// Establish a session: store the user and token and hand the token to the api
// client so subsequent requests are authenticated.
export function setSession(user, accessToken) {
  currentUser = user || null;
  currentToken = accessToken || null;
  setAccessToken(currentToken);
  notify();
}

// Clear the session on sign-out or an unrecoverable auth failure.
export function clearSession() {
  currentUser = null;
  currentToken = null;
  setAccessToken(null);
  notify();
}

// The authenticated user, or null.
export function getUser() {
  return currentUser;
}

// The in-memory access token, or null.
export function getAccessToken() {
  return currentToken;
}

// True when a user is signed in.
export function isAuthenticated() {
  return currentUser !== null;
}

// Subscribe to session changes. Returns an unsubscribe function.
export function subscribe(listener) {
  listeners.push(listener);
  return function unsubscribe() {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}
