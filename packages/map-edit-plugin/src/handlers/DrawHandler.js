import {
  Bounds,
  Circle,
  DomUtil,
  Marker,
  Polygon,
  Polyline,
  Rectangle,
  Util,
  toLatLng,
} from 'sweety-map';
import { EditHandler } from './EditHandler.js';

const DRAW_TYPES = ['marker', 'polyline', 'polygon', 'circle', 'rectangle'];

/**
 * Приводит пользовательское имя инструмента к каноническому типу.
 * @param {string} type
 * @returns {'marker'|'polyline'|'polygon'|'circle'|'rectangle'}
 */
export function normalizeDrawType(type) {
  const value = String(type || '')
    .toLowerCase()
    .replace(/^draw:/, '');
  if (value === 'line' || value === 'linestring') return 'polyline';
  if (value === 'rect') return 'rectangle';
  if (value === 'point') return 'marker';
  if (!DRAW_TYPES.includes(value)) throw new RangeError(`Unknown draw type: ${String(type)}`);
  return /** @type {'marker'|'polyline'|'polygon'|'circle'|'rectangle'} */ (value);
}

/**
 * Конечный автомат рисования одного объекта. Не владеет UI: ghost-слой и
 * тулбар предоставляет плагин через колбэки.
 */
export class DrawHandler extends EditHandler {
  /**
   * @param {import('../EditPlugin.js').EditPlugin} plugin
   * @param {string} type
   * @param {{target?: any|null}} [options]
   */
  constructor(plugin, type, options = {}) {
    super(plugin);
    this.type = normalizeDrawType(type);
    this.target = options.target || plugin.options.target || null;
    /** @type {import('sweety-map').LatLng[]} */
    this.vertices = [];
    /** @type {import('sweety-map').LatLng|null} */
    this.cursor = null;
    /** @type {import('sweety-map').LatLng|null} */
    this.first = null;
    /** @type {import('sweety-map').LatLng|null} */
    this.second = null;
    this.active = false;
    this.finished = false;
    this._listeners = [];
    this._doubleClickZoomWasEnabled = false;
    this._onPointerMove = Util.rafThrottle((event) => this._handlePointerMove(event));
  }

  /** Начинает сессию рисования и подписывается на карту. */
  start() {
    if (this.active) return this;
    this.active = true;

    this._bind(this.map, 'dblclick', (event) => this._handleDoubleClick(event));
    this._bind(this.map, 'contextmenu', (event) => this._handleContextMenu(event));
    const container = this.map.getContainer();
    const onMove = (event) => this._onPointerMove(event);
    container.addEventListener('pointermove', onMove, { passive: true });
    this._listeners.push(() => {
      container.removeEventListener('pointermove', onMove);
      this._onPointerMove.cancel();
    });

    if (this.map.doubleClickZoom && this.map.doubleClickZoom.enabled()) {
      this._doubleClickZoomWasEnabled = true;
      this.map.doubleClickZoom.disable();
    }

    this.plugin.fire('draw:started', { type: this.type, target: this.target });
    this._updateGhost();
    this._updateToolbar();
    return this;
  }

  /** @private */
  _bind(target, type, handler) {
    target.on(type, handler, this);
    this._listeners.push(() => target.off(type, handler, this));
  }

  /**
   * Обрабатывает клик карты. Вызывается плагином до обычной логики выбора.
   * @param {any} event
   */
  handleClick(event) {
    if (!this.active || this.finished) return;
    let latlng;
    if (event.latlng) latlng = toLatLng(event.latlng);
    else if (event.containerPoint) latlng = this.map.containerPointToLatLng(event.containerPoint);
    else return;
    latlng = this.plugin._snapLatLng(latlng);
    this.cursor = latlng;

    if (this.type === 'marker') {
      this.vertices = [latlng];
      this.finish();
      return;
    }

    if (this.type === 'circle' || this.type === 'rectangle') {
      if (!this.first) {
        this.first = latlng;
        this.second = null;
        this._updateGhost();
        this._updateToolbar();
        return;
      }
      this.second = latlng;
      this.finish();
      return;
    }

    if (this.type === 'polygon' && this.vertices.length >= 3) {
      const first = this.map.latLngToContainerPoint(this.vertices[0]);
      const point = this.map.latLngToContainerPoint(latlng);
      if (first.distanceTo(point) <= 12) {
        this.finish();
        return;
      }
    }

    this.vertices.push(latlng);
    this.plugin.fire('draw:vertexadded', {
      type: this.type,
      latlng: latlng.clone(),
      index: this.vertices.length - 1,
      vertices: this.vertices.length,
    });
    this._updateGhost();
    this._updateToolbar();
  }

  /** @private */
  _handlePointerMove(event) {
    if (!this.active) return;
    const point = DomUtil.getMousePosition(event, this.map.getContainer());
    this.cursor = this.plugin._snapLatLng(this.map.containerPointToLatLng(point));
    this._updateGhost();
  }

  /** @private */
  _handleDoubleClick(event) {
    if (!this.active) return;
    if (this.type !== 'polyline' && this.type !== 'polygon') return;
    event.originalEvent?.preventDefault?.();
    // В браузере двум кликам dblclick предшествуют два click; убираем дубль.
    if (this.vertices.length >= 2) {
      const last = this.map.latLngToContainerPoint(this.vertices[this.vertices.length - 1]);
      const previous = this.map.latLngToContainerPoint(this.vertices[this.vertices.length - 2]);
      if (last.distanceTo(previous) <= 5) this.vertices.pop();
    }
    this.finish();
  }

  /** @private */
  _handleContextMenu(event) {
    if (!this.active) return;
    event.originalEvent?.preventDefault?.();
    if (this.type === 'polyline' || this.type === 'polygon') {
      this.vertices.pop();
      if (!this.vertices.length) {
        this.plugin._cancelDrawing(this, 'contextmenu');
        return;
      }
      this._updateGhost();
      this._updateToolbar();
      return;
    }
    this.plugin._cancelDrawing(this, 'contextmenu');
  }

  /**
   * Esc: снимает последнюю вершину, а если вершин нет — отменяет черновик.
   * @returns {boolean}
   */
  escape() {
    if (!this.active) return false;
    if (this.type === 'polyline' || this.type === 'polygon') {
      if (this.vertices.length) {
        this.vertices.pop();
        this._updateGhost();
        this._updateToolbar();
        return true;
      }
      this.plugin._cancelDrawing(this, 'escape');
      return true;
    }
    this.plugin._cancelDrawing(this, 'escape');
    return true;
  }

  /**
   * Завершает рисование.
   * @returns {boolean}
   */
  finish() {
    if (!this.active || this.finished) return false;
    if (!this.canFinish()) {
      this.plugin.fire('draw:invalid', { type: this.type, reason: 'min-vertices' });
      return false;
    }
    const layer = this._createLayer();
    this.finished = true;
    this.plugin._drawCompleted(this, layer);
    return true;
  }

  /** @returns {boolean} */
  canFinish() {
    if (this.type === 'marker') return this.vertices.length >= 1;
    if (this.type === 'polyline') return this.vertices.length >= 2;
    if (this.type === 'polygon') return this.vertices.length >= 3;
    if (this.type === 'circle') {
      if (!this.first || !this.second) return false;
      return this.map.distance(this.first, this.second) > 0.5;
    }
    if (this.type === 'rectangle') {
      if (!this.first || !this.second) return false;
      const bounds = new Bounds(this.first, this.second);
      return bounds.isValid() && !bounds.getSouthWest().equals(bounds.getNorthEast(), 1e-12);
    }
    return false;
  }

  /** @private */
  _createLayer() {
    const options = this.plugin.getDrawStyle(this.type);
    if (this.type === 'marker') return new Marker(this.vertices[0], options);
    if (this.type === 'polyline') return new Polyline(this.vertices, options);
    if (this.type === 'polygon') return new Polygon([this.vertices], options);
    if (this.type === 'circle') {
      const radius = this.map.distance(this.first, this.second);
      return new Circle(this.first, radius, options);
    }
    return new Rectangle(new Bounds(this.first, this.second), options);
  }

  /** @private */
  _updateGhost() {
    if (!this.plugin.ghostLayer) return;
    const ghost = this.plugin.ghostLayer;
    if (this.type === 'marker') {
      ghost.show({ type: 'marker', cursor: this.cursor });
      return;
    }
    if (this.type === 'circle') {
      ghost.show({ type: 'circle', center: this.first, edge: this.cursor });
      return;
    }
    if (this.type === 'rectangle') {
      ghost.show({
        type: 'rectangle',
        points: this.first ? [this.first] : [],
        cursor: this.cursor,
      });
      return;
    }
    ghost.show({
      type: this.type === 'polygon' ? 'polygon' : 'line',
      points: this.vertices,
      cursor: this.cursor,
    });
  }

  /** @private */
  _updateToolbar() {
    this.plugin._updateDrawToolbar(this);
  }

  /** Снимает подписки и возвращает обработчик двойного клика. */
  teardown() {
    if (!this.active) return;
    this.active = false;
    for (const unsubscribe of this._listeners.splice(0)) unsubscribe();
    if (this._doubleClickZoomWasEnabled) {
      this._doubleClickZoomWasEnabled = false;
      this.map.doubleClickZoom?.enable();
    }
  }
}
