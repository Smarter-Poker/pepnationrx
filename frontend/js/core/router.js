// ============================================================================
// router.js - a minimal hash-based client router for PepNationRX.
// ----------------------------------------------------------------------------
// Dependency-free. Routes are static paths keyed off the URL hash, for example
// "#/catalog". Each route handler returns an HTMLElement; the router clears the
// outlet and mounts it. A hash with no matching route falls back to a default.
//
// Hash routing is intentional: the frontend is a static bundle with no server
// rewrite rules, so every deep link resolves to the same document.
// ============================================================================

'use strict';

// Create a router. options:
//   outlet   - the element route content is mounted into
//   routes   - a map of path -> handler(); handler returns an HTMLElement
//   fallback - the path to use when the hash matches no route
//   onChange - optional callback(path) run after each successful navigation
export function createRouter(options) {
  const outlet = options.outlet;
  const routes = options.routes || {};
  const fallback = options.fallback || '/';
  const onChange = typeof options.onChange === 'function' ? options.onChange : null;

  // Read the current route path from the URL hash, defaulting to the fallback.
  function currentPath() {
    const raw = window.location.hash.replace(/^#/, '');
    return raw === '' ? fallback : raw;
  }

  // Resolve and mount the route for the current hash.
  function resolve() {
    let path = currentPath();
    let handler = routes[path];
    if (!handler) {
      path = fallback;
      handler = routes[fallback];
    }
    if (!handler) return;

    const view = handler();
    outlet.innerHTML = '';
    if (view instanceof Node) {
      outlet.appendChild(view);
    } else if (typeof view === 'string') {
      outlet.innerHTML = view;
    }
    if (onChange) onChange(path);
  }

  // Navigate to a path. Updates the hash, which triggers resolve() via the
  // hashchange listener; if the hash is unchanged, resolve() is run directly.
  function navigate(path) {
    const target = '#' + path;
    if (window.location.hash === target) {
      resolve();
    } else {
      window.location.hash = target;
    }
  }

  // Begin listening for hash changes and resolve the initial route.
  function start() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  // Stop listening. Used when the host component is disconnected.
  function stop() {
    window.removeEventListener('hashchange', resolve);
  }

  return {
    start: start,
    stop: stop,
    navigate: navigate,
    resolve: resolve,
    currentPath: currentPath,
  };
}
