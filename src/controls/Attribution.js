import { Control } from './Control.js';

/**
 * Attribution control. It rebuilds its text from layer attributions whenever
 * a layer is added or removed, de-duplicating repeated credits.
 */
export class AttributionControl extends Control {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({
      position: 'bottomright',
      prefix:
        '<a href="https://github.com/brainstable/sweety" target="_blank" rel="noopener">Sweety</a>',
      ...options,
    });
    this._attributions = new Set();
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._container = this._initLayout('sweety-control-attribution');
    this._container.setAttribute('aria-label', 'Map attribution');
    this._updateHandler = () => this._update();
    map.on('layeradd layerremove', this._updateHandler);
    this._update();
    return this._container;
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    map.off('layeradd layerremove', this._updateHandler);
    super.onRemove(map);
  }

  /**
   * Add a persistent attribution string.
   * @param {string} text
   * @returns {this}
   */
  addAttribution(text) {
    if (text) this._attributions.add(text);
    this._update();
    return this;
  }

  /**
   * Remove a persistent attribution string.
   * @param {string} text
   * @returns {this}
   */
  removeAttribution(text) {
    this._attributions.delete(text);
    this._update();
    return this;
  }

  /**
   * Change the prefix HTML.
   * @param {string} prefix
   * @returns {this}
   */
  setPrefix(prefix) {
    this.options.prefix = prefix;
    this._update();
    return this;
  }

  /** @private */
  _update() {
    if (!this._container || !this._map) return;
    const attributions = new Set(this._attributions);
    for (const layer of this._map.getLayers()) {
      if (typeof layer.getAttribution !== 'function') continue;
      const value = layer.getAttribution();
      if (value) attributions.add(value);
    }
    const parts = [];
    if (this.options.prefix) parts.push(this.options.prefix);
    parts.push(...attributions);
    this._container.innerHTML = parts.join(' <span aria-hidden="true">|</span> ');
  }
}
