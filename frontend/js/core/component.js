// ============================================================================
// PnrxComponent - base class for PepNationRX Web Components.
// ----------------------------------------------------------------------------
// A minimal, dependency-free base for custom elements. Components render into
// their own light DOM (so the global design tokens in css/variables.css and
// per-component stylesheets in css/components/ apply without duplication).
//
// Subclass contract:
//   - implement render() returning an HTML string
//   - optionally implement afterRender() to bind event listeners
//   - call setState(patch) to update and trigger a re-render
// ============================================================================

'use strict';

// Escape a string for safe interpolation into innerHTML. Every value that
// originates from user input or external data must pass through this.
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class PnrxComponent extends HTMLElement {
  constructor() {
    super();
    // Component state. Never mutate directly; route changes through setState.
    this.state = {};
    // Guards against re-entrant renders.
    this._rendering = false;
  }

  // Standard custom-element lifecycle: render once attached to the document.
  connectedCallback() {
    this._performRender();
  }

  // Merge a patch into state and re-render. Shallow merge is intentional;
  // components keep their state flat.
  setState(patch) {
    this.state = Object.assign({}, this.state, patch);
    this._performRender();
  }

  // Subclasses override this to return the component markup as a string.
  render() {
    return '';
  }

  // Subclasses override this to bind listeners after each render.
  afterRender() {}

  // Internal: write markup and run the post-render hook.
  _performRender() {
    if (this._rendering) return;
    this._rendering = true;
    try {
      this.innerHTML = this.render();
      this.afterRender();
    } finally {
      this._rendering = false;
    }
  }

  // Scoped query helpers so subclasses never reach outside their own subtree.
  $(selector) {
    return this.querySelector(selector);
  }

  $$(selector) {
    return Array.prototype.slice.call(this.querySelectorAll(selector));
  }

  // Dispatch a CustomEvent that bubbles and crosses shadow boundaries, so a
  // host application can listen for it on any ancestor.
  emit(name, detail) {
    this.dispatchEvent(
      new CustomEvent(name, {
        detail: detail || {},
        bubbles: true,
        composed: true,
      })
    );
  }
}
