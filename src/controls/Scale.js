import { Control } from './Control.js';
import { create, empty } from '../util/dom.js';

/**
 * Scale bar showing a rounded metric and/or imperial distance.
 */
export class ScaleControl extends Control {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({
      position: 'bottomleft',
      maxWidth: 100,
      metric: true,
      imperial: true,
      ...options,
    });
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._container = this._initLayout('sweety-control-scale');
    this._updateHandler = () => this._update();
    map.on('moveend zoomend resize', this._updateHandler);
    this._update();
    return this._container;
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    map.off('moveend zoomend resize', this._updateHandler);
    super.onRemove(map);
  }

  /** @private */
  _update() {
    if (!this._container || !this._map) return;
    const size = this._map.getSize();
    if (!size.x || !size.y) return;
    empty(this._container);

    const y = size.y / 2;
    const maxWidth = Math.min(Number(this.options.maxWidth) || 100, size.x - 20);
    const left = this._map.containerPointToLatLng({ x: 0, y });
    const right = this._map.containerPointToLatLng({ x: maxWidth, y });
    const maxMeters = left.distanceTo(right);

    if (this.options.metric) {
      const meters = niceDistance(maxMeters);
      const width = Math.max(1, Math.round((meters / maxMeters) * maxWidth));
      this._addRow(width, formatMetric(meters));
    }
    if (this.options.imperial) {
      const feet = niceDistance(maxMeters * 3.280839895);
      const width = Math.max(1, Math.round((feet / (maxMeters * 3.280839895)) * maxWidth));
      this._addRow(width, formatImperial(feet));
    }
  }

  /** @private */
  _addRow(width, label) {
    const row = create('div', 'sweety-control-scale-line', this._container);
    row.style.width = `${width}px`;
    row.textContent = label;
  }
}

/** @private */
function niceDistance(meters) {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(meters));
  const normalised = meters / power;
  let nice;
  if (normalised >= 5) nice = 5;
  else if (normalised >= 2) nice = 2;
  else nice = 1;
  return nice * power;
}

/** @private */
function formatMetric(meters) {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** @private */
function formatImperial(feet) {
  if (feet >= 5280) {
    const miles = feet / 5280;
    return `${Number.isInteger(miles) ? miles : miles.toFixed(1)} mi`;
  }
  return `${Math.round(feet)} ft`;
}
