import { Layer } from '../Layer.js';
import { Bounds } from '../../core/Bounds.js';
import { toLatLng } from '../../core/LatLng.js';
import { Point } from '../../core/Point.js';
import { extend } from '../../util/index.js';

/** Shared vector styling defaults. */
export const PATH_DEFAULTS = {
  stroke: true,
  color: '#2f6fed',
  weight: 3,
  opacity: 1,
  lineCap: 'round',
  lineJoin: 'round',
  dashArray: null,
  dashOffset: null,
  fill: false,
  fillColor: null,
  fillOpacity: 0.2,
  fillRule: 'evenodd',
  interactive: true,
  bubblingMouseEvents: false,
  className: '',
  pane: 'overlay',
};

/**
 * Abstract vector path. Subclasses provide `_latlngs` or override
 * {@link _project}; the renderer owns the actual SVG/Canvas node.
 */
export class Path extends Layer {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    super(extend({}, PATH_DEFAULTS, options));
    /** @type {import('./Renderer.js').Renderer|null} */
    this._renderer = null;
    /** @type {Point[][]} */
    this._parts = [];
    this._closed = false;
    this._path = null;
  }

  /** @param {import('../../core/Map.js').Map} map */
  onAdd(map) {
    this._renderer = map._getRenderer(this);
    this._renderer._initPath(this);
    this._renderer._addPath(this);
    this._renderer._updatePath(this);
  }

  /** */
  onRemove() {
    if (this._renderer) {
      this._renderer._removePath(this);
      this._renderer = null;
    }
  }

  /**
   * Recompute screen geometry.
   * @private
   */
  _update() {
    if (!this._map || !this._renderer || !this._path) return;
    this._parts = this._project();
    this._renderer._updatePath(this);
  }

  /**
   * Project every ring to layer pixels.
   * @returns {Point[][]}
   * @protected
   */
  _project() {
    if (!this._map || !this._latlngs) return [];
    return this._latlngs.map((ring) => ring.map((latlng) => this._map.latLngToLayerPoint(latlng)));
  }

  /**
   * Update the SVG path data and style.
   * @protected
   */
  _updateSVGPath() {
    if (!this._path) return;
    const d = this._parts
      .filter((part) => part.length)
      .map((part) => {
        let segment = `M${part[0].x.toFixed(1)} ${part[0].y.toFixed(1)}`;
        for (let i = 1; i < part.length; i += 1) {
          segment += `L${part[i].x.toFixed(1)} ${part[i].y.toFixed(1)}`;
        }
        return this._closed ? `${segment}Z` : segment;
      })
      .join('');
    this._path.setAttribute('d', d);
    this._updateStyle();
  }

  /** @protected */
  _updateStyle() {
    if (!this._path) return;
    const options = this.options;
    if (options.stroke) {
      this._path.setAttribute('stroke', options.color || '#2f6fed');
      this._path.setAttribute('stroke-width', String(options.weight ?? 3));
      this._path.setAttribute('stroke-opacity', String(options.opacity ?? 1));
      this._path.setAttribute('stroke-linecap', options.lineCap || 'round');
      this._path.setAttribute('stroke-linejoin', options.lineJoin || 'round');
      if (options.dashArray) {
        this._path.setAttribute('stroke-dasharray', options.dashArray);
      } else {
        this._path.removeAttribute('stroke-dasharray');
      }
      if (options.dashOffset !== null && options.dashOffset !== undefined) {
        this._path.setAttribute('stroke-dashoffset', String(options.dashOffset));
      } else {
        this._path.removeAttribute('stroke-dashoffset');
      }
    } else {
      this._path.setAttribute('stroke', 'none');
    }

    if (options.fill) {
      this._path.setAttribute('fill', options.fillColor || options.color || '#2f6fed');
      this._path.setAttribute('fill-opacity', String(options.fillOpacity ?? 0.2));
      this._path.setAttribute('fill-rule', options.fillRule || 'evenodd');
    } else {
      this._path.setAttribute('fill', 'none');
    }
    this._path.style.pointerEvents = options.interactive === false ? 'none' : 'auto';
  }

  /**
   * Merge new style values.
   * @param {object} style
   * @returns {this}
   */
  setStyle(style) {
    extend(this.options, style);
    if (this._path && this.options.className) {
      this._path.classList.add(...String(this.options.className).split(/\s+/).filter(Boolean));
    }
    this.redraw();
    return this;
  }

  /** @returns {object} */
  getStyle() {
    return { ...this.options };
  }

  /** @returns {this} */
  redraw() {
    this._update();
    return this;
  }

  /**
   * Bounds of the path.
   * @returns {Bounds}
   */
  getBounds() {
    const bounds = new Bounds();
    if (this._latlngs) {
      for (const ring of this._latlngs) {
        for (const latlng of ring) bounds.extend(latlng);
      }
    }
    return bounds;
  }

  /** @returns {this} */
  bringToFront() {
    if (this._path && this._path.parentNode) this._path.parentNode.appendChild(this._path);
    return this;
  }

  /** @returns {this} */
  bringToBack() {
    if (this._path && this._path.parentNode) {
      const parent = this._path.parentNode;
      parent.insertBefore(this._path, parent.firstChild);
    }
    return this;
  }

  /**
   * Raise a path click event on the map and feature group.
   * @param {MouseEvent} event
   * @returns {this}
   */
  fireDOMEvent(event) {
    if (!this._map) return this;
    const containerPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    const latlng = this._map.mouseEventToLatLng(event);
    this.fire(event.type, {
      originalEvent: event,
      latlng,
      layerPoint: this._map.latLngToLayerPoint(latlng),
      containerPoint,
    });
    return this;
  }

  /**
   * @param {{lat?:number,lng?:number}|number[]} latlng
   * @returns {LatLng}
   * @protected
   */
  _coerceLatLng(latlng) {
    return toLatLng(latlng);
  }
}

export { Point };
