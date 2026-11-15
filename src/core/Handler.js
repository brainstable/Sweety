/**
 * Базовый класс обработчиков взаимодействия с картой. Обработчик включается и
 * выключается целиком и сам отвечает за очистку своих DOM-слушателей.
 */
export class Handler {
  /** @param {import('./Map.js').Map} map */
  constructor(map) {
    this._map = map;
    this._enabled = false;
  }

  /** Включает обработчик. Идемпотентно. @returns {this} */
  enable() {
    if (this._enabled) return this;
    this._enabled = true;
    this._enable();
    return this;
  }

  /** Выключает обработчик. Идемпотентно. @returns {this} */
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
