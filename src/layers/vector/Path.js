import { Layer } from '../Layer.js';
import { Bounds } from '../../core/Bounds.js';
import { toLatLng } from '../../core/LatLng.js';
import { Point } from '../../core/Point.js';
import { extend } from '../../util/index.js';

/** Общие стилевые значения по умолчанию для векторных слоёв. */
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
 * Абстрактный векторный path. Подклассы задают `_latlngs` или переопределяют
 * {@link _project}; сам узел SVG/Canvas принадлежит рендереру.
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
   * Пересчитывает экранную геометрию.
   * @private
   */
  _update() {
    if (!this._map || !this._renderer) return;
    this._parts = this._project();
    this._renderer._updatePath(this);
  }

  /**
   * Проецирует каждое кольцо в пиксели слоя.
   * @returns {Point[][]}
   * @protected
   */
  _project() {
    if (!this._map || !this._latlngs) return [];
    return this._latlngs.map((ring) => ring.map((latlng) => this._map.latLngToLayerPoint(latlng)));
  }

  /**
   * Обновляет данные path в SVG и его стиль.
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
   * Объединяет текущие стили с новыми значениями.
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
   * Границы path.
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
   * Проверяет, попадает ли точка в координатах контейнера в отрисованный path. Замкнутые
   * фигуры с заливкой проверяют внутреннюю область (even-odd); все фигуры проверяют
   * расстояние до обводки.
   * @param {Point|{x:number,y:number}} point
   * @returns {boolean}
   */
  _containsPoint(point) {
    if (!this._parts || !this._parts.length) return false;
    const target = point instanceof Point ? point : new Point(point);
    const tolerance = (Number(this.options.weight) || 0) / 2 + 3;
    let inside = false;

    for (const ring of this._parts) {
      if (ring.length === 1 && target.distanceTo(ring[0]) <= tolerance) return true;
      for (let i = 0; i < ring.length - 1; i += 1) {
        if (distanceToSegment(target, ring[i], ring[i + 1]) <= tolerance) return true;
      }
      if (this._closed && ring.length > 2) {
        if (distanceToSegment(target, ring[ring.length - 1], ring[0]) <= tolerance) return true;
        if (pointInRing(target, ring)) inside = !inside;
      }
    }
    return Boolean(this._closed && this.options.fill && inside);
  }

  /**
   * Порождает событие клика по path на карте и в группе объектов.
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

/** @private */
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].x;
    const yi = ring[i].y;
    const xj = ring[j].x;
    const yj = ring[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** @private */
function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return point.distanceTo(start);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  const x = start.x + t * dx;
  const y = start.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}
