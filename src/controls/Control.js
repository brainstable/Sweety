import { Evented } from '../core/Evented.js';
import { create, on, stopPropagation } from '../util/dom.js';
import { extend } from '../util/index.js';

/** Supported control corner names. */
export const POSITIONS = ['topleft', 'topright', 'bottomleft', 'bottomright'];

/**
 * Base class for controls placed in a map corner. Controls are interactive
 * widgets, so pointer events are stopped before they reach map handlers.
 */
export class Control extends Evented {
  /** @param {object} [options] */
  constructor(options = {}) {
    super();
    this.options = extend({ position: 'topright' }, options);
    this._map = null;
    this._container = null;
  }

  /** @returns {string} */
  getPosition() {
    return this.options.position;
  }

  /**
   * Move the control to a new corner.
   * @param {string} position
   * @returns {this}
   */
  setPosition(position) {
    if (!POSITIONS.includes(position)) throw new Error(`Unknown control position: ${position}`);
    this.options.position = position;
    if (this._map) this._map._repositionControl(this);
    return this;
  }

  /** @returns {HTMLElement|null} */
  getContainer() {
    return this._container;
  }

  /**
   * Add to a map.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  addTo(map) {
    map.addControl(this);
    return this;
  }

  /** @returns {this} */
  remove() {
    if (this._map) this._map.removeControl(this);
    return this;
  }

  /**
   * Called by the map. Must return the control container.
   * @param {import('../core/Map.js').Map} _map
   * @returns {HTMLElement}
   */
  onAdd(_map) {
    throw new Error('Control.onAdd must be implemented');
  }

  /** @param {import('../core/Map.js').Map} _map */
  onRemove(_map) {
    this._container?.remove();
    this._container = null;
  }

  /**
   * Create the control container and stop map interactions inside it.
   * @param {string} className
   * @returns {HTMLElement}
   * @protected
   */
  _initLayout(className) {
    this._container = create('div', `sweety-control ${className}`.trim());
    on(this._container, 'mousedown dblclick contextmenu wheel', stopPropagation);
    this._container.addEventListener('click', (event) => event.stopPropagation());
    return this._container;
  }
}
