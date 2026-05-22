// ============================================================================
// api.js - the PepNationRX frontend API client.
// ----------------------------------------------------------------------------
// A small fetch wrapper. It attaches the JWT access token, sends and parses
// JSON, and normalizes error responses into a typed ApiError. The access
// token is held in memory only; persistence is the host application's job.
// ============================================================================

'use strict';

// A failed API response. status is the HTTP status; code and message come
// from the server's { error: { code, message } } envelope when present.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message || 'Request failed.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'request_failed';
  }
}

// Module-level client state.
let baseUrl = '';
let accessToken = null;

// Point the client at an API origin (for example 'https://api.pepnationrx.com').
// An empty base means same-origin relative requests.
export function configureApi(options) {
  if (options && typeof options.baseUrl === 'string') {
    baseUrl = options.baseUrl.replace(/\/$/, '');
  }
}

// Set or clear the bearer access token used for authenticated requests.
export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

// Issue a JSON request. Resolves with the parsed body, or rejects with an
// ApiError on a non-2xx response or a network failure.
async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (accessToken) {
    headers.Authorization = 'Bearer ' + accessToken;
  }
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(baseUrl + path, {
      method: method,
      headers: headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch (networkError) {
    throw new ApiError(0, 'network_error', 'Unable to reach the server.');
  }

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = parsed && parsed.error ? parsed.error : {};
    throw new ApiError(response.status, error.code, error.message);
  }
  return parsed;
}

export const api = {
  get: function (path) {
    return request('GET', path);
  },
  post: function (path, body) {
    return request('POST', path, body);
  },
  put: function (path, body) {
    return request('PUT', path, body);
  },
  del: function (path) {
    return request('DELETE', path);
  },
};
