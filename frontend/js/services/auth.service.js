// ============================================================================
// auth.service.js - the PepNationRX authentication API client.
// ----------------------------------------------------------------------------
// Wraps the /api/auth endpoints and keeps the session store in sync. Register
// and login open a session; logout closes it; restoreSession rotates the
// httpOnly refresh-token cookie at page load so a returning visitor stays
// signed in without re-entering credentials.
// ============================================================================

'use strict';

import { api } from './api.js';
import { setSession, clearSession } from '../store/session.js';

// Create a patient account and open a session. `data` matches the backend
// register schema: email, password, and optional profile fields.
export async function register(data) {
  const result = await api.post('/api/auth/register', data);
  setSession(result.user, result.accessToken);
  return result;
}

// Verify credentials and open a session.
export async function login(credentials) {
  const result = await api.post('/api/auth/login', credentials);
  setSession(result.user, result.accessToken);
  return result;
}

// Revoke the refresh token and clear the local session. The local session is
// cleared even if the network call fails, so sign-out always takes effect.
export async function logout() {
  try {
    await api.post('/api/auth/logout', {});
  } finally {
    clearSession();
  }
}

// Restore a session at page load by rotating the refresh-token cookie. Resolves
// true when a session was restored, false when there is no valid cookie.
export async function restoreSession() {
  try {
    const result = await api.post('/api/auth/refresh', {});
    setSession(result.user, result.accessToken);
    return true;
  } catch (err) {
    clearSession();
    return false;
  }
}

// Read the authenticated user's profile.
export async function fetchProfile() {
  const result = await api.get('/api/auth/me');
  return result.user;
}
