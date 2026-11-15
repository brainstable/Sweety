import { Evented } from '../core/Evented.js';
import { extend } from '../util/index.js';

/**
 * Abstract base class for all map layers.
 *
 * A layer is any object that can be added to a map and manages a DOM node or
 * renderer. Subclasses implement {@link onAdd} and {@link onRemove}; the map
 * takes care of lifecycle bookkeeping and event bubbling.
 */
export class Layer extends Evented {
  /**
   * @param {object} [options]
   * @param {string} [options.pane] map pane used by the layer
   * @param {string} [options.attribution] attribution HTML
   */
  constructor(options = {}) {
    super();
    /** @type {object} */
    this.options = extend({}, options);
    /** @type {import('../core/Map.js').Map|null} */
    this._map = null;
    /** @type {HTMLElement|SVGElement|null} */
    this._container = null;
  }

  /**
   * Add the layer to a map.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  addTo(map) {
    if (!map) throw new TypeError('Layer.addTo expects a map');
    map.addLayer(this);
    return this;
  }

  /**
   * Remove the layer from its current map.
   * @returns {this}
   */
  remove() {
    if (this._map) this._map.removeLayer(this);
    return this;
  }

  /**
   * Remove the layer from a specific map.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  removeFrom(map) {
    if (map) map.removeLayer(this);
    return this;
  }

  /**
   * Called by the map when the layer is added. Subclasses create their DOM.
   * @param {import('../core/Map.js').Map} map
   */
  onAdd(_map) {}

  /**
   * Called by the map when the layer is removed. Subclasses clean up.
   * @param {import('../core/Map.js').Map} map
   */
  onRemove(_map) {}

  /**
   * Resolve a pane, falling back to the layer's configured pane and then the
   * overlay pane.
   * @param {string} [name]
   * @returns {HTMLElement|undefined}
   */
  getPane(name) {
    if (!this._map) return undefined;
    return this._map.getPane(name || this.options.pane || 'overlay');
  }

  /**
   * Attribution text associated with this layer.
   * @returns {string|null}
   */
  getAttribution() {
    const value = this.options.attribution;
    return typeof value === 'function' ? value.call(this) : value || null;
  }

  /**
   * Set the z-index of the layer container.
   * @param {number} zIndex
   * @returns {this}
   */
  setZIndex(zIndex) {
    this.options.zIndex = zIndex;
    if (this._container) this._container.style.zIndex = String(zIndex);
    return this;
  }

  /**
   * Bring the layer container to the front of its pane.
   * @returns {this}
   */
  bringToFront() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.appendChild(this._container);
    }
    return this;
  }

  /**
   * Send the layer container to the back of its pane.
   * @returns {this}
   */
  bringToBack() {
    if (this._container && this._container.parentNode) {
      const parent = this._container.parentNode;
      parent.insertBefore(this._container, parent.firstChild);
    }
    return this;
  }
}
