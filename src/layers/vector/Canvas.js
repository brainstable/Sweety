import { Renderer } from './Renderer.js';
import { create, getMousePosition, off, on, preventDefault } from '../../util/dom.js';
import { cancelAnimFrame, devicePixelRatio, requestAnimFrame } from '../../util/index.js';

/**
 * Рендерер Canvas для большого числа векторных объектов. Все path используют один
 * canvas; перерисовки объединяются в один кадр анимации, а проверка попадания
 * выполняется по спроецированной геометрии.
 */
export class Canvas extends Renderer {
  constructor(options = {}) {
    super(options);
    this._canvas = null;
    this._ctx = null;
    this._redrawFrame = null;
    this._hovered = null;
    this._onCanvasEvent = (event) => this._handleEvent(event);
  }

  /** @private */
  _initContainer() {
    this._canvas = create('canvas', 'sweety-layer sweety-canvas-layer');
    this._canvas.style.position = 'absolute';
    this._canvas.style.left = '0';
    this._canvas.style.top = '0';
    this._canvas.style.pointerEvents = 'auto';
    this._container = this._canvas;
    this._ctx = this._canvas.getContext('2d');
    for (const type of ['click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'mousemove']) {
      on(this._canvas, type, this._onCanvasEvent);
    }
    this._resize();
  }

  /** */
  onRemove() {
    if (this._redrawFrame) cancelAnimFrame(this._redrawFrame);
    this._redrawFrame = null;
    for (const type of ['click', 'dblclick', 'contextmenu', 'mousedown', 'mouseup', 'mousemove']) {
      if (this._canvas) off(this._canvas, type, this._onCanvasEvent);
    }
    this._canvas = null;
    this._ctx = null;
    this._hovered = null;
    super.onRemove();
  }

  /** @private */
  _update() {
    if (!this._map || !this._canvas) return;
    this._resize();
    this._scheduleRedraw();
  }

  /** @private */
  _resize() {
    if (!this._map || !this._canvas) return;
    const size = this._map.getSize();
    const ratio = devicePixelRatio();
    const width = Math.max(1, Math.round(size.x * ratio));
    const height = Math.max(1, Math.round(size.y * ratio));
    if (this._canvas.width !== width) this._canvas.width = width;
    if (this._canvas.height !== height) this._canvas.height = height;
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    if (this._ctx) this._ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /** @private */
  _initPath(layer) {
    super._initPath(layer);
    this._scheduleRedraw();
  }

  /** @private */
  _updatePath(_layer) {
    this._scheduleRedraw();
  }

  /** @private */
  _removePath(layer) {
    super._removePath(layer);
    this._scheduleRedraw();
  }

  /** @private */
  _scheduleRedraw() {
    if (!this._map || this._redrawFrame) return;
    this._redrawFrame = requestAnimFrame(() => {
      this._redrawFrame = null;
      this._redraw();
    });
  }

  /** Очищает и перерисовывает все path. @private */
  _redraw() {
    if (!this._ctx || !this._canvas) return;
    const ratio = devicePixelRatio();
    const size = this._map ? this._map.getSize() : { x: 0, y: 0 };
    this._ctx.save();
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    this._ctx.restore();
    this._ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this._ctx.lineJoin = 'round';

    for (const layer of Object.values(this._layers)) {
      if (!layer._parts || !layer._parts.length) continue;
      this._drawPath(layer, size);
    }
  }

  /** @private */
  _drawPath(layer, size) {
    const ctx = this._ctx;
    const options = layer.options;
    const parts = layer._parts;
    if (!ctx || !parts.length) return;

    ctx.save();
    ctx.beginPath();
    for (const part of parts) {
      if (!part.length) continue;
      ctx.moveTo(part[0].x, part[0].y);
      for (let i = 1; i < part.length; i += 1) ctx.lineTo(part[i].x, part[i].y);
      if (layer._closed) ctx.closePath();
    }

    if (options.fill && layer._closed) {
      ctx.globalAlpha = options.fillOpacity ?? 0.2;
      ctx.fillStyle = options.fillColor || options.color || '#2f6fed';
      try {
        ctx.fill('evenodd');
      } catch {
        ctx.fill();
      }
    }

    if (options.stroke) {
      ctx.globalAlpha = options.opacity ?? 1;
      ctx.strokeStyle = options.color || '#2f6fed';
      ctx.lineWidth = options.weight ?? 3;
      ctx.lineCap = options.lineCap || 'round';
      ctx.lineJoin = options.lineJoin || 'round';
      ctx.setLineDash(parseDash(options.dashArray));
      ctx.stroke();
    }
    ctx.restore();

    // Ограничиваем canvas размерами вьюпорта, даже если path очень велик.
    if (size.x === 0 || size.y === 0) return;
  }

  /** @private */
  _handleEvent(event) {
    if (!this._map || !this._canvas) return;
    if (this._map._animatingZoom) return;
    const containerPoint = getMousePosition(event, this._map.getContainer());
    const layer = this._getInteractiveLayer(containerPoint);

    if (event.type === 'mousemove') {
      if (layer !== this._hovered) {
        if (this._hovered) this._fireLayerEvent(this._hovered, 'mouseout', event, containerPoint);
        if (layer) this._fireLayerEvent(layer, 'mouseover', event, containerPoint);
        this._hovered = layer;
      }
      if (layer) event.stopPropagation();
      return;
    }

    if (!layer) return;
    if (event.type === 'contextmenu') preventDefault(event);
    this._fireLayerEvent(layer, event.type, event, containerPoint);
    event.stopPropagation();
  }

  /** @private */
  _fireLayerEvent(layer, type, event, containerPoint) {
    const layerPoint = this._map.containerPointToLayerPoint(containerPoint);
    layer.fire(type, {
      originalEvent: event,
      latlng: this._map.layerPointToLatLng(layerPoint),
      layerPoint,
      containerPoint,
    });
  }

  /**
   * Находит самый верхний интерактивный path под точкой контейнера.
   * @param {{x:number,y:number}} point
   * @returns {import('./Path.js').Path|null}
   */
  _getInteractiveLayer(point) {
    const layers = Object.values(this._layers);
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const layer = layers[i];
      if (layer.options.interactive === false) continue;
      if (layer._containsPoint(point)) return layer;
    }
    return null;
  }
}

/** @private */
function parseDash(dash) {
  if (!dash) return [];
  if (Array.isArray(dash)) return dash.map(Number).filter((value) => Number.isFinite(value));
  return String(dash)
    .split(/[ ,]+/)
    .map(Number)
    .filter((value) => Number.isFinite(value));
}
