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
// Called by session.js — session.js is the source of truth for the token.
export function setAccessToken(token) {
  accessToken = token || null;
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
  let parsed = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      // A non-JSON body - a proxy error page, a gateway timeout - must still
      // surface as a typed ApiError, never a raw SyntaxError, so callers can
      // handle it uniformly.
      throw new ApiError(
        response.status || 0,
        'invalid_response',
        'The server returned an unexpected response.'
      );
    }
  }

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
  patch: function (path, body) {
    return request('PATCH', path, body);
  },
  del: function (path) {
    return request('DELETE', path);
  },
};
