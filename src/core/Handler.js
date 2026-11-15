/**
 * Base class for map interaction handlers. A handler is enabled or disabled
 * as a unit and is responsible for cleaning up its own DOM listeners.
 */
export class Handler {
  /** @param {import('./Map.js').Map} map */
  constructor(map) {
    this._map = map;
    this._enabled = false;
  }

  /** Enable the handler. Idempotent. @returns {this} */
  enable() {
    if (this._enabled) return this;
    this._enabled = true;
    this._enable();
    return this;
  }

  /** Disable the handler. Idempotent. @returns {this} */
  disable() {
    if (!this._enabled) return this;
    this._enabled = false;
    this._disable();
    return this;
  }

  /** @returns {boolean} */
  enabled() {
    return this._enabled;
  }

  /** @protected */
  _enable() {}

  /** @protected */
  _disable() {}
}
