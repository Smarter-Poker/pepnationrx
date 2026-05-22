// ============================================================================
// toast.js - a shared transient notification primitive for PepNationRX.
// ----------------------------------------------------------------------------
// showToast(message, kind) drops a brief, self-dismissing message into a fixed
// stack in the corner of the viewport. It is dependency-free and host-agnostic:
// any component can call it without wiring up its own notification surface.
// kind is one of 'info', 'success', or 'error' and only changes the styling.
// ============================================================================

'use strict';

// How long a toast stays on screen before it dismisses itself.
const DEFAULT_DURATION_MS = 5000;

// The id of the singleton container appended to document.body.
const ROOT_ID = 'pnrx-toast-root';

// Find the toast container, creating it on first use.
function toastRoot() {
  let root = document.getElementById(ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'pnrx-toast-root';
    document.body.appendChild(root);
  }
  return root;
}

// Remove a toast, letting its exit transition play first.
function dismiss(toast) {
  if (!toast || toast.dataset.dismissing === 'true') return;
  toast.dataset.dismissing = 'true';
  toast.classList.remove('is-visible');
  window.setTimeout(function () {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 220);
}

// Show a toast. kind defaults to 'info'; durationMs defaults to 5 seconds.
// Returns a function that dismisses the toast early.
export function showToast(message, kind, durationMs) {
  const root = toastRoot();
  const variant = kind === 'success' || kind === 'error' ? kind : 'info';

  const toast = document.createElement('div');
  toast.className = 'pnrx-toast pnrx-toast--' + variant;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.textContent = String(message == null ? '' : message);
  toast.addEventListener('click', function () {
    dismiss(toast);
  });
  root.appendChild(toast);

  // Trigger the entrance transition on the next frame.
  window.requestAnimationFrame(function () {
    toast.classList.add('is-visible');
  });

  const life =
    Number.isFinite(durationMs) && durationMs > 0
      ? durationMs
      : DEFAULT_DURATION_MS;
  window.setTimeout(function () {
    dismiss(toast);
  }, life);

  return function () {
    dismiss(toast);
  };
}
