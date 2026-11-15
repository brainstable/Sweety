import { Evented } from '../core/Evented.js';
import { toLatLng } from '../core/LatLng.js';
import { Popup } from './Popup.js';
import { Tooltip } from './Tooltip.js';
import { fallbackLatLng } from './DivOverlay.js';
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

  /* ----------------------------------------------------------------------- *
   * Popups
   * ----------------------------------------------------------------------- */

  /**
   * Bind a popup that opens when the layer is clicked.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindPopup(content, options = {}) {
    if (!this._popup) {
      this._popup = new Popup(options);
      this._popup._source = this;
      this._popupClickHandler = (event) => this.openPopup(event.latlng);
      this._popupMoveHandler = () => this._syncPopup();
      this._popupRemoveHandler = () => this._popup?.close();
      this.on('click', this._popupClickHandler);
      this.on('move', this._popupMoveHandler);
      this.on('remove', this._popupRemoveHandler);
    } else {
      extend(this._popup.options, options);
    }
    this._popup.setContent(content);
    return this;
  }

  /**
   * Update popup content without rebuilding the binding.
   * @param {string|HTMLElement|Function} content
   * @returns {this}
   */
  setPopupContent(content) {
    if (this._popup) this._popup.setContent(content);
    return this;
  }

  /**
   * Open the bound popup.
   * @param {import('../core/LatLng.js').LatLng|number[]} [latlng]
   * @returns {this}
   */
  openPopup(latlng) {
    if (!this._popup) return this;
    if (!this._map) {
      this.once('add', () => this.openPopup(latlng));
      return this;
    }
    const anchor = latlng ? toLatLng(latlng) : fallbackLatLng(this, this._map);
    this._popup.setLatLng(anchor);
    this._popup.openOn(this._map);
    return this;
  }

  /** Close the bound popup. @returns {this} */
  closePopup() {
    this._popup?.close();
    return this;
  }

  /** Toggle the bound popup. @returns {this} */
  togglePopup() {
    if (!this._popup) return this;
    if (this.isPopupOpen()) this.closePopup();
    else this.openPopup();
    return this;
  }

  /** @returns {boolean} */
  isPopupOpen() {
    return Boolean(this._popup && this._popup.isOpen());
  }

  /** Remove the popup binding. @returns {this} */
  unbindPopup() {
    if (!this._popup) return this;
    this._popup.close();
    this.off('click', this._popupClickHandler);
    this.off('move', this._popupMoveHandler);
    this.off('remove', this._popupRemoveHandler);
    this._popup = null;
    return this;
  }

  /** @returns {Popup|null} */
  getPopup() {
    return this._popup || null;
  }

  /** @private */
  _syncPopup() {
    if (this._popup && this._popup.isOpen() && this._map) {
      this._popup.setLatLng(fallbackLatLng(this, this._map));
    }
  }

  /* ----------------------------------------------------------------------- *
   * Tooltips
   * ----------------------------------------------------------------------- */

  /**
   * Bind a tooltip that opens on hover.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindTooltip(content, options = {}) {
    if (!this._tooltip) {
      this._tooltip = new Tooltip(options);
      this._tooltip._source = this;
      this._tooltipEnterHandler = () => this.openTooltip();
      this._tooltipLeaveHandler = () => {
        if (!this._tooltip.options.permanent) this.closeTooltip();
      };
      this._tooltipMoveHandler = () => this._syncTooltip();
      this._tooltipRemoveHandler = () => this._tooltip?.close();
      this._tooltipAddHandler = () => {
        if (this._tooltip.options.permanent) this.openTooltip();
      };
      this.on('mouseover', this._tooltipEnterHandler);
      this.on('mouseout', this._tooltipLeaveHandler);
      this.on('move', this._tooltipMoveHandler);
      this.on('remove', this._tooltipRemoveHandler);
      this.on('add', this._tooltipAddHandler);
    } else {
      extend(this._tooltip.options, options);
    }
    this._tooltip.setContent(content);
    if (this._tooltip.options.permanent && this._map) this.openTooltip();
    return this;
  }

  /**
   * Open the bound tooltip.
   * @param {import('../core/LatLng.js').LatLng|number[]} [latlng]
   * @returns {this}
   */
  openTooltip(latlng) {
    if (!this._tooltip) return this;
    if (!this._map) {
      this.once('add', () => this.openTooltip(latlng));
      return this;
    }
    const anchor = latlng ? toLatLng(latlng) : fallbackLatLng(this, this._map);
    this._tooltip.setLatLng(anchor);
    this._tooltip.openOn(this._map);
    return this;
  }

  /** Close the bound tooltip. @returns {this} */
  closeTooltip() {
    this._tooltip?.close();
    return this;
  }

  /** Toggle the bound tooltip. @returns {this} */
  toggleTooltip() {
    if (!this._tooltip) return this;
    if (this.isTooltipOpen()) this.closeTooltip();
    else this.openTooltip();
    return this;
  }

  /** @returns {boolean} */
  isTooltipOpen() {
    return Boolean(this._tooltip && this._tooltip.isOpen());
  }

  /** Remove the tooltip binding. @returns {this} */
  unbindTooltip() {
    if (!this._tooltip) return this;
    this._tooltip.close();
    this.off('mouseover', this._tooltipEnterHandler);
    this.off('mouseout', this._tooltipLeaveHandler);
    this.off('move', this._tooltipMoveHandler);
    this.off('remove', this._tooltipRemoveHandler);
    this.off('add', this._tooltipAddHandler);
    this._tooltip = null;
    return this;
  }

  /** @returns {Tooltip|null} */
  getTooltip() {
    return this._tooltip || null;
  }

  /** @private */
  _syncTooltip() {
    if (this._tooltip && this._tooltip.isOpen() && this._map) {
      this._tooltip.setLatLng(fallbackLatLng(this, this._map));
    }
  }
}
