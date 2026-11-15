import { Layer } from './Layer.js';
import { stamp } from '../util/index.js';

/**
 * A collection of layers that behaves as one logical layer.
 *
 * Children are registered with the map so they render and update independently,
 * while events are also propagated through the group.
 */
export class LayerGroup extends Layer {
  /**
   * @param {Layer[]} [layers]
   * @param {object} [options]
   */
  constructor(layers = [], options = {}) {
    super(options);
    /** @type {Record<string, Layer>} */
    this._layers = Object.create(null);
    for (const layer of layers) this.addLayer(layer);
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this.eachLayer((layer) => map.addLayer(layer));
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    this.eachLayer((layer) => {
      layer.removeEventParent(this);
      map.removeLayer(layer);
    });
  }

  /**
   * Add a child layer.
   * @param {Layer} layer
   * @returns {this}
   */
  addLayer(layer) {
    if (!layer) throw new TypeError('LayerGroup.addLayer expects a layer');
    const id = stamp(layer);
    if (this._layers[id]) return this;
    this._layers[id] = layer;
    layer.addEventParent(this);
    if (this._map) this._map.addLayer(layer);
    this.fire('layeradd', { layer });
    return this;
  }

  /**
   * Remove a child layer.
   * @param {Layer} layer
   * @returns {this}
   */
  removeLayer(layer) {
    if (!layer) return this;
    const id = layer._sweetyId;
    if (!this._layers[id]) return this;
    delete this._layers[id];
    layer.removeEventParent(this);
    if (this._map) this._map.removeLayer(layer);
    this.fire('layerremove', { layer });
    return this;
  }

  /**
   * Remove every child layer.
   * @returns {this}
   */
  clearLayers() {
    this.eachLayer((layer) => this.removeLayer(layer));
    return this;
  }

  /** @returns {boolean} */
  hasLayer(layer) {
    return Boolean(layer && this._layers[layer._sweetyId]);
  }

  /**
   * Iterate child layers.
   * @param {Function} callback
   * @param {object} [context]
   * @returns {this}
   */
  eachLayer(callback, context = this) {
    for (const layer of Object.values(this._layers)) callback.call(context, layer);
    return this;
  }

  /** @returns {Layer[]} */
  getLayers() {
    return Object.values(this._layers);
  }

  /**
   * Call a method on every child layer.
   * @param {string} method
   * @param {...*} args
   * @returns {this}
   */
  invoke(method, ...args) {
    this.eachLayer((layer) => {
      if (typeof layer[method] === 'function') layer[method](...args);
    });
    return this;
  }

  /**
   * Assign a z-index to every child layer.
   * @param {number} zIndex
   * @returns {this}
   */
  setZIndex(zIndex) {
    this.options.zIndex = zIndex;
    return this.invoke('setZIndex', zIndex);
  }

  /** @returns {string[]} */
  getAttributions() {
    const values = [];
    this.eachLayer((layer) => {
      const attribution =
        typeof layer.getAttribution === 'function' ? layer.getAttribution() : null;
      if (attribution) values.push(attribution);
    });
    return values;
  }

  /** @returns {string|null} */
  getAttribution() {
    return this.getAttributions().join(' | ') || null;
  }
}

/**
 * LayerGroup with shared popup/tooltip/style behaviour. FeatureGroup is what
 * GeoJSONLayer uses so all generated features can be styled as a unit.
 */
export class FeatureGroup extends LayerGroup {
  /** @param {Layer} layer */
  addLayer(layer) {
    super.addLayer(layer);
    if (this._popupContent !== undefined && typeof layer.bindPopup === 'function') {
      layer.bindPopup(this._popupContent, this._popupOptions);
    }
    if (this._tooltipContent !== undefined && typeof layer.bindTooltip === 'function') {
      layer.bindTooltip(this._tooltipContent, this._tooltipOptions);
    }
    return this;
  }

  /**
   * Bind the same popup to every child.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindPopup(content, options) {
    this._popupContent = content;
    this._popupOptions = options;
    return this.invoke('bindPopup', content, options);
  }

  /** @returns {this} */
  unbindPopup() {
    this._popupContent = undefined;
    return this.invoke('unbindPopup');
  }

  /** @returns {this} */
  openPopup() {
    return this.invoke('openPopup');
  }

  /** @returns {this} */
  closePopup() {
    return this.invoke('closePopup');
  }

  /** @returns {this} */
  togglePopup() {
    return this.invoke('togglePopup');
  }

  /**
   * Bind the same tooltip to every child.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindTooltip(content, options) {
    this._tooltipContent = content;
    this._tooltipOptions = options;
    return this.invoke('bindTooltip', content, options);
  }

  /** @returns {this} */
  unbindTooltip() {
    this._tooltipContent = undefined;
    return this.invoke('unbindTooltip');
  }

  /** @returns {this} */
  openTooltip() {
    return this.invoke('openTooltip');
  }

  /** @returns {this} */
  closeTooltip() {
    return this.invoke('closeTooltip');
  }

  /** @returns {this} */
  toggleTooltip() {
    return this.invoke('toggleTooltip');
  }

  /**
   * Apply a path style to every vector child.
   * @param {object} style
   * @returns {this}
   */
  setStyle(style) {
    return this.invoke('setStyle', style);
  }

  /** @returns {this} */
  bringToFront() {
    return this.invoke('bringToFront');
  }

  /** @returns {this} */
  bringToBack() {
    return this.invoke('bringToBack');
  }
}
