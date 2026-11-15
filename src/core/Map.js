import { Bounds } from './Bounds.js';
import { Evented } from './Evented.js';
import { LatLng, toLatLng } from './LatLng.js';
import { Point } from './Point.js';
import { resolveCRS } from '../geo/CRS.js';
import { DragHandler } from '../handlers/DragHandler.js';
import { ScrollWheelZoom } from '../handlers/ScrollWheelZoom.js';
import { DoubleClickZoom } from '../handlers/DoubleClickZoom.js';
import { TouchZoom } from '../handlers/TouchZoom.js';
import { SVG } from '../layers/vector/SVG.js';
import { Canvas } from '../layers/vector/Canvas.js';
import { ZoomControl } from '../controls/Zoom.js';
import { AttributionControl } from '../controls/Attribution.js';
import {
  addClass,
  create,
  getMousePosition,
  off,
  on,
  preventDefault,
  remove,
  removeClass,
} from '../util/dom.js';
import {
  cancelAnimFrame,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  extend,
  isObject,
  rafThrottle,
  requestAnimFrame,
  stamp,
} from '../util/index.js';

/** @type {Function[]} */
const initHooks = [];

/**
 * @typedef {object} MapOptions
 * @property {LatLng|number[]} [center=[0,0]] Начальный географический центр
 * @property {number} [zoom=0] Начальный уровень масштабирования
 * @property {number} [minZoom=0] Минимальный уровень масштабирования
 * @property {number} [maxZoom=22] Максимальный уровень масштабирования
 * @property {number} [zoomSnap=1] Шаг привязки при программном масштабировании
 * @property {number} [zoomDelta=1] Величина изменения для zoomIn/zoomOut
 * @property {Bounds|number[][]} [maxBounds=null] Ограничивает область просмотра
 * @property {import('../geo/CRS.js').CRS} [crs=EPSG3857] Система координат
 * @property {boolean} [zoomAnimation=true] Анимировать переходы масштабирования
 * @property {boolean} [fadeAnimation=true] Плавно проявлять загруженные тайлы
 * @property {boolean} [trackResize=true] Отслеживать размер контейнера
 * @property {boolean} [preferCanvas=false] Использовать общий Canvas-рендерер для путей
 * @property {boolean} [closePopupOnClick=true] Закрывать попапы по клику на карте
 * @property {boolean} [zoomControl=true] Добавлять стандартный контрол масштаба
 * @property {boolean} [attributionControl=true] Добавлять стандартный контрол атрибуции
 * @property {number} [zoomAnimationThreshold=4] Максимальное число уровней масштабирования, анимируемых одновременно
 */

const DEFAULT_OPTIONS = {
  center: [0, 0],
  zoom: 0,
  minZoom: 0,
  maxZoom: 22,
  zoomSnap: 1,
  zoomDelta: 1,
  maxBounds: null,
  crs: null,
  zoomAnimation: true,
  fadeAnimation: true,
  trackResize: true,
  preferCanvas: false,
  closePopupOnClick: true,
  zoomControl: true,
  attributionControl: true,
  zoomAnimationThreshold: 4,
  worldCopyJump: false,
  dragging: true,
  scrollWheelZoom: true,
  doubleClickZoom: true,
  touchZoom: true,
  inertia: true,
  inertiaDeceleration: 3000,
  inertiaMaxSpeed: 1500,
  wheelDebounceTime: 40,
  wheelPxPerZoomLevel: 60,
  bounceAtZoomLimits: true,
};

/**
 * Центральный контроллер карты. Владеет DOM-контейнером, состоянием вида,
 * реестром слоёв, обработчиками взаимодействия, панелями и контролами.
 *
 * @example
 * const map = new Map('map', { center: [55.75, 37.61], zoom: 10 });
 * map.on('click', (event) => console.log(event.latlng));
 */
export class Map extends Evented {
  /**
   * Регистрирует функцию, вызываемую по завершении каждого создания Map.
   * Плагины используют этот хук, чтобы добавлять методы или контролы, не
   * вмешиваясь в конструктор.
   * @param {Function} hook
   * @returns {typeof Map}
   */
  static addInitHook(hook) {
    if (typeof hook !== 'function') throw new TypeError('Map.addInitHook expects a function');
    initHooks.push(hook);
    return this;
  }

  /**
   * @param {string|HTMLElement} containerId
   * @param {MapOptions} [options]
   */
  constructor(containerId, options = {}) {
    super();

    const container =
      typeof containerId === 'string' ? document.getElementById(containerId) : containerId;

    if (!container) {
      throw new Error(`Map container not found: ${String(containerId)}`);
    }
    if (!(container instanceof HTMLElement)) {
      throw new TypeError('Map container must be an HTMLElement or an element id');
    }
    if (container._sweetyMap) {
      throw new Error('Map container is already initialized');
    }

    /** @type {HTMLElement} */
    this._container = container;
    container._sweetyMap = this;

    /** @type {MapOptions} */
    this.options = extend({}, DEFAULT_OPTIONS, options);
    if (!this.options.crs) this.options.crs = resolveCRS('EPSG:3857');
    else this.options.crs = resolveCRS(this.options.crs);
    if (this.options.maxBounds && !(this.options.maxBounds instanceof Bounds)) {
      this.options.maxBounds = new Bounds(this.options.maxBounds);
    }

    /** @type {Record<string, import('../layers/Layer.js').Layer>} */
    this._layers = Object.create(null);
    /** @type {Record<string, import('./Handler.js').Handler>} */
    this._handlers = Object.create(null);
    /** @type {Record<string, HTMLElement>} */
    this._panes = Object.create(null);
    /** @type {import('../controls/Control.js').Control[]} */
    this._controls = [];
    /** @type {SVG|null} */
    this._svgRenderer = null;
    /** @type {Canvas|null} */
    this._canvasRenderer = null;

    this._loaded = false;
    this._size = new Point(0, 0);
    this._zoom = 0;
    this._center = new LatLng(0, 0);
    this._pixelOrigin = new Point(0, 0);
    this._lastCenter = null;
    this._lastZoom = null;
    this._zoomAnimated = false;
    this._resizeObserver = null;
    this._resizeListener = null;
    this._frame = null;
    this._dragging = false;
    this._pinching = false;
    this._inertiaActive = false;
    this._animatingZoom = false;
    this._zoomAnimated = false;
    this._zoomAnimTimer = null;
    this._zoomAnimFrame = null;
    this._panFrame = null;
    this._panEnd = null;
    this._flyFrame = null;

    this._initLayout();
    this._initEvents();
    this._initView();

    this._loaded = true;
    this._initHandlers();
    this._initControls();
    this.fire('load');
    this.fire('ready');

    for (const hook of initHooks) hook.call(this, this.options);
  }

  /* ----------------------------------------------------------------------- *
   * Вёрстка и жизненный цикл
   * ----------------------------------------------------------------------- */

  /** @private */
  _initLayout() {
    addClass(this._container, 'sweety-container');
    if (!this._container.style.position) this._container.style.position = 'relative';
    if (!this._container.hasAttribute('tabindex')) this._container.tabIndex = 0;

    this._mapPane = create('div', 'sweety-map-pane', this._container);
    this._createPane('tile', 'sweety-tile-pane');
    this._createPane('overlay', 'sweety-overlay-pane');
    this._createPane('shadow', 'sweety-shadow-pane');
    this._createPane('marker', 'sweety-marker-pane');
    this._createPane('tooltip', 'sweety-tooltip-pane');
    this._createPane('popup', 'sweety-popup-pane');

    this._controlCorners = Object.create(null);
    for (const position of ['topleft', 'topright', 'bottomleft', 'bottomright']) {
      this._controlCorners[position] = create(
        'div',
        `sweety-control-corner sweety-${position}`,
        this._container,
      );
    }

    this._size = this._getSize();
  }

  /** @private */
  _createPane(name, className) {
    const pane = create('div', `sweety-pane ${className}`, this._mapPane);
    pane.style.position = 'absolute';
    this._panes[name] = pane;
    return pane;
  }

  /** @private */
  _initView() {
    const initialZoom = this._limitZoom(Number(this.options.zoom));
    let initialCenter = new LatLng(this.options.center);
    initialCenter = this._limitCenter(initialCenter, initialZoom, this.options.maxBounds);

    this._zoom = initialZoom;
    this._center = initialCenter;
    this._pixelOrigin = this._getTopLeftPoint(initialCenter, initialZoom);
  }

  /** @private */
  _initEvents() {
    this._handleDOMEvent = (event) => this._handleDOMEventInternal(event);
    this._handleMouseMove = rafThrottle((event) => this._handleDOMEventInternal(event));
    this._onResize = () => this.invalidateSize();
    this._onWindowResize = () => this.invalidateSize({ debounce: true });

    on(
      this._container,
      'click dblclick contextmenu mousedown mouseup mouseover mouseout',
      this._handleDOMEvent,
    );
    on(this._container, 'mousemove', this._handleMouseMove);

    if (this.options.trackResize) {
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(this._onResize);
        this._resizeObserver.observe(this._container);
      }
      if (typeof window !== 'undefined') {
        this._resizeListener = this._onWindowResize;
        window.addEventListener('resize', this._resizeListener);
      }
    }
  }

  /** @private */
  _initHandlers() {
    this._addHandler('dragging', DragHandler, this.options.dragging);
    this._addHandler('scrollWheelZoom', ScrollWheelZoom, this.options.scrollWheelZoom);
    this._addHandler('doubleClickZoom', DoubleClickZoom, this.options.doubleClickZoom);
    this._addHandler('touchZoom', TouchZoom, this.options.touchZoom);
  }

  /** @private */
  _initControls() {
    if (this.options.zoomControl) this.addControl(new ZoomControl());
    if (this.options.attributionControl) {
      const options = {};
      if (this.options.attributionPrefix !== undefined) {
        options.prefix = this.options.attributionPrefix;
      }
      this.addControl(new AttributionControl(options));
    }
  }

  /**
   * Создаёт и публикует обработчик взаимодействия на карте.
   * @param {string} name
   * @param {new (map: Map) => import('./Handler.js').Handler} HandlerClass
   * @param {boolean} [enabled=true]
   * @returns {import('./Handler.js').Handler}
   */
  _addHandler(name, HandlerClass, enabled = true) {
    if (this._handlers[name]) return this._handlers[name];
    const handler = new HandlerClass(this);
    this._handlers[name] = handler;
    this[name] = handler;
    if (enabled) handler.enable();
    return handler;
  }

  /**
   * Применяет центр во время активного перетаскивания или инерционной анимации.
   * В отличие от {@link setView}, не начинает и не завершает транзакцию перемещения.
   * @param {LatLng|number[]} center
   * @returns {boolean} изменился ли центр на самом деле
   * @private
   */
  _moveDuringDrag(center) {
    const limited = this._limitCenter(
      center instanceof LatLng ? center : new LatLng(center),
      this._zoom,
      this.options.maxBounds,
    );
    const moved = !limited.equals(this._center, 1e-12);
    this._center = limited;
    this._pixelOrigin = this._getTopLeftPoint(limited, this._zoom);
    this._lastCenter = limited.clone();
    this._lastZoom = this._zoom;
    this._updateLayers();
    if (moved) {
      this.fire('move', { center: this._center, zoom: this._zoom }, false);
    }
    return moved;
  }

  /** @private */
  _handleDOMEventInternal(event) {
    if (!this._loaded) return;
    if (event._sweetyStopped) return;

    const target = event.target;
    if (
      target &&
      target.closest &&
      target.closest(
        '.sweety-control, .sweety-popup, .sweety-tooltip, .sweety-marker, .sweety-svg-layer',
      )
    ) {
      return;
    }

    if (event.type === 'contextmenu' && this.listens('contextmenu')) {
      preventDefault(event);
    }
    if (event.type === 'click' && this._suppressClickFlag) return;

    const containerPoint = getMousePosition(event, this._container);
    const layerPoint = this.containerPointToLayerPoint(containerPoint);
    const latlng = this.layerPointToLatLng(layerPoint);

    this.fire(
      event.type,
      {
        originalEvent: event,
        containerPoint,
        layerPoint,
        latlng,
      },
      false,
    );
  }

  /**
   * Текущий размер карты в CSS-пикселях.
   * @returns {Point}
   */
  getSize() {
    return this._size.clone();
  }

  /** @private */
  _getSize() {
    return new Point(
      Math.max(0, this._container.clientWidth || 0),
      Math.max(0, this._container.clientHeight || 0),
    );
  }

  /**
   * Повторно считывает размер контейнера. Полезно после показа ранее скрытой карты.
   * @param {object} [options]
   * @param {boolean} [options.pan=true] Сохранять центр при изменении размера
   * @param {boolean} [options.debounce=false] Объединять события изменения размера
   * @returns {this}
   */
  invalidateSize(options = {}) {
    if (options.debounce) {
      if (this._frame) return this;
      this._frame = requestAnimFrame(() => {
        this._frame = null;
        this.invalidateSize({ ...options, debounce: false });
      });
      return this;
    }

    const oldSize = this._size.clone();
    const newSize = this._getSize();
    if (newSize.x === 0 || newSize.y === 0) return this;
    if (oldSize.equals(newSize)) return this;

    this._size = newSize;

    if (options.pan === false && oldSize.x > 0 && oldSize.y > 0) {
      const centerPoint = this.project(this._center, this._zoom).add(
        oldSize.clone().subtract(newSize).divideBy(2),
      );
      this._center = this.unproject(centerPoint, this._zoom);
    }

    this._pixelOrigin = this._getTopLeftPoint(this._center, this._zoom);
    if (this.options.maxBounds) {
      this._center = this._limitCenter(this._center, this._zoom, this.options.maxBounds);
      this._pixelOrigin = this._getTopLeftPoint(this._center, this._zoom);
    }
    this._updateLayers();
    this.fire('resize', { oldSize, newSize });
    this.fire('move', { center: this._center, zoom: this._zoom, size: this._size });
    return this;
  }

  /**
   * Уничтожает карту, удаляет все слои и обработчики и отписывает слушателей.
   * @returns {this}
   */
  remove() {
    if (!this._loaded) return this;
    this.fire('unload');
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._resizeListener) {
      window.removeEventListener('resize', this._resizeListener);
      this._resizeListener = null;
    }
    if (this._frame) {
      cancelAnimFrame(this._frame);
      this._frame = null;
    }
    if (this._panFrame) {
      cancelAnimFrame(this._panFrame);
      this._panFrame = null;
    }
    if (this._flyFrame) {
      cancelAnimFrame(this._flyFrame);
      this._flyFrame = null;
    }
    if (this._zoomAnimTimer) {
      clearTimeout(this._zoomAnimTimer);
      this._zoomAnimTimer = null;
    }

    for (const id of Object.keys(this._layers)) this.removeLayer(this._layers[id]);
    for (const control of [...this._controls]) this.removeControl(control);
    for (const corner of Object.values(this._controlCorners)) remove(corner);
    this._controlCorners = Object.create(null);
    for (const handler of Object.values(this._handlers)) handler.disable();

    off(
      this._container,
      'click dblclick contextmenu mousedown mouseup mouseover mouseout',
      this._handleDOMEvent,
    );
    off(this._container, 'mousemove', this._handleMouseMove);
    this._handleMouseMove.cancel();
    removeClass(this._container, 'sweety-container');
    remove(this._mapPane);
    this._container._sweetyMap = null;
    this._loaded = false;
    this._svgRenderer = null;
    this._canvasRenderer = null;
    return this;
  }

  /**
   * Вызывает callback, когда карта готова. Если карта уже загружена, callback
   * выполняется асинхронно, чтобы порядок вызовов оставался предсказуемым.
   * @param {Function} callback
   * @param {object} [context=this]
   * @returns {this}
   */
  whenReady(callback, context = this) {
    if (this._loaded) {
      setTimeout(() => callback.call(context, { target: this }), 0);
    } else {
      this.once('load', callback, context);
    }
    return this;
  }

  /* ----------------------------------------------------------------------- *
   * Состояние вида
   * ----------------------------------------------------------------------- */

  /**
   * Задаёт центр и уровень масштабирования, генерируя стандартную последовательность событий вида.
   * @param {LatLng|number[]} center
   * @param {number} [zoom=this._zoom]
   * @param {object} [options]
   * @param {boolean} [options.animate=false] Анимировать переход
   * @param {boolean} [options.noMoveStart=false]
   * @returns {this}
   */
  setView(center, zoom = this._zoom, options = {}) {
    if (this._flyFrame) this._cancelFlyTo();
    if (this._animatingZoom) this._finishZoomAnimation();
    if (this._panFrame && !options.animate) this._cancelPanAnimation();

    const newCenter = toLatLng(center);
    const newZoom = this._limitZoom(Number(zoom));
    if (!Number.isFinite(newZoom)) throw new TypeError('setView requires a finite zoom');

    if (options.animate && this._loaded && this._size.x > 0 && this._size.y > 0) {
      if (newZoom !== this._zoom) {
        this._animatedZoom(newCenter, newZoom, options);
        return this;
      }
      if (!newCenter.equals(this._center)) {
        this._animatePan(newCenter, options);
        return this;
      }
    }

    const zoomChanged = this._zoom !== newZoom;
    if (this._loaded && !options.noMoveStart) this._moveStart(zoomChanged);
    this._resetView(newCenter, newZoom, { reset: true });
    if (this._loaded) this._moveEnd(zoomChanged);
    return this;
  }

  /** @private */
  _resetView(center, zoom, { reset = false } = {}) {
    const oldZoom = this._zoom;
    const limitedCenter = this._limitCenter(new LatLng(center), zoom, this.options.maxBounds);
    const zoomChanged = oldZoom !== zoom;

    this._center = limitedCenter;
    this._zoom = zoom;
    this._pixelOrigin = this._getTopLeftPoint(limitedCenter, zoom);
    this._lastCenter = limitedCenter.clone();
    this._lastZoom = zoom;

    if (reset) this.fire('viewreset', { center: this._center, zoom }, false);
    this._updateLayers();
    this.fire('move', { center: this._center, zoom, oldZoom }, false);
    if (zoomChanged) {
      this.fire('zoom', { center: this._center, zoom, oldZoom }, false);
    }
  }

  /** @private */
  _moveStart(zoomChanged) {
    this.fire('movestart', { center: this._center, zoom: this._zoom });
    if (zoomChanged) this.fire('zoomstart', { center: this._center, zoom: this._zoom });
  }

  /** @private */
  _moveEnd(zoomChanged) {
    this.fire('moveend', { center: this._center, zoom: this._zoom });
    if (zoomChanged) this.fire('zoomend', { center: this._center, zoom: this._zoom });
  }

  /**
   * Перерисовывает все слои для текущего вида. Вызывается после каждого
   * зафиксированного перемещения; слои сами решают, нужна ли загрузка или только смена позиции.
   * @private
   */
  _updateLayers() {
    for (const layer of Object.values(this._layers)) {
      if (layer && typeof layer._update === 'function') layer._update();
    }
    this.fire('_layerupdate', { center: this._center, zoom: this._zoom }, false);
  }

  /**
   * @param {number} zoom
   * @returns {number}
   */
  _limitZoom(zoom) {
    const min = this.getMinZoom();
    const max = this.getMaxZoom();
    const snap = Number(this.options.zoomSnap);
    const snapped = snap > 0 ? Math.round(zoom / snap) * snap : zoom;
    return clamp(snapped, min, max);
  }

  /**
   * Прижимает центр так, чтобы область просмотра оставалась внутри `maxBounds`.
   * @private
   */
  _limitCenter(center, zoom, maxBounds) {
    if (!maxBounds || !maxBounds.isValid() || this._size.x === 0 || this._size.y === 0) {
      return center;
    }

    const half = this._size.clone().divideBy(2);
    const nw = this.project(maxBounds.getNorthWest(), zoom);
    const se = this.project(maxBounds.getSouthEast(), zoom);
    const centerPoint = this.project(center, zoom);

    let minX = nw.x + half.x;
    let maxX = se.x - half.x;
    let minY = nw.y + half.y;
    let maxY = se.y - half.y;

    // Мир меньше области просмотра центрируется, а не прижимается.
    if (minX > maxX) minX = maxX = (nw.x + se.x) / 2;
    if (minY > maxY) minY = maxY = (nw.y + se.y) / 2;

    return this.unproject(
      new Point(clamp(centerPoint.x, minX, maxX), clamp(centerPoint.y, minY, maxY)),
      zoom,
    );
  }

  /** @returns {LatLng} защитная копия текущего центра */
  getCenter() {
    return this._center.clone();
  }

  /** @returns {number} */
  getZoom() {
    return this._zoom;
  }

  /** @returns {number} */
  getMinZoom() {
    return Number(this.options.minZoom ?? 0);
  }

  /** @returns {number} */
  getMaxZoom() {
    return Number(this.options.maxZoom ?? 22);
  }

  /**
   * @param {number} zoom
   * @returns {this}
   */
  setMinZoom(zoom) {
    this.options.minZoom = Number(zoom);
    if (this._zoom < this.options.minZoom) this.setZoom(this.options.minZoom);
    return this;
  }

  /**
   * @param {number} zoom
   * @returns {this}
   */
  setMaxZoom(zoom) {
    this.options.maxZoom = Number(zoom);
    if (this._zoom > this.options.maxZoom) this.setZoom(this.options.maxZoom);
    return this;
  }

  /**
   * Задаёт масштаб вокруг текущего центра (или переданного якоря).
   * @param {number} zoom
   * @param {object} [options]
   * @returns {this}
   */
  setZoom(zoom, options = {}) {
    return this.setView(this._center, zoom, options);
  }

  /**
   * Изменяет масштаб относительно текущего уровня.
   * @param {number} [delta=this.options.zoomDelta]
   * @param {object} [options]
   * @returns {this}
   */
  zoomIn(delta = this.options.zoomDelta, options = {}) {
    return this.setZoom(this._zoom + delta, options);
  }

  /**
   * @param {number} [delta=this.options.zoomDelta]
   * @param {object} [options]
   * @returns {this}
   */
  zoomOut(delta = this.options.zoomDelta, options = {}) {
    return this.setZoom(this._zoom - delta, options);
  }

  /**
   * Масштабирует, сохраняя географический или пиксельный якорь визуально неподвижным.
   * @param {LatLng|number[]|Point|{x:number,y:number}} anchor
   * @param {number} zoom
   * @param {object} [options]
   * @returns {this}
   */
  setZoomAround(anchor, zoom, options = {}) {
    const targetZoom = this._limitZoom(Number(zoom));
    const isPixelAnchor = anchor instanceof Point || (isObject(anchor) && 'x' in anchor);
    const anchorPoint = isPixelAnchor
      ? anchor instanceof Point
        ? anchor.clone()
        : new Point(anchor)
      : this.latLngToContainerPoint(anchor);
    const anchorLatLng = isPixelAnchor
      ? this.containerPointToLatLng(anchorPoint)
      : toLatLng(anchor);

    const worldPoint = this.project(anchorLatLng, targetZoom)
      .subtract(anchorPoint)
      .add(this._size.clone().divideBy(2));
    return this.setView(this.unproject(worldPoint, targetZoom), targetZoom, options);
  }

  /**
   * Масштабирует вокруг точки экрана; используется обработчиками колеса и пинч-жеста.
   * @param {Point} point
   * @param {number} zoom
   * @param {object} [options]
   * @returns {this}
   */
  setZoomAroundPoint(point, zoom, options = {}) {
    return this.setZoomAround(point, zoom, options);
  }

  /** @private */
  _getTopLeftPoint(center, zoom) {
    return this.project(center, zoom).subtract(this._size.clone().divideBy(2));
  }

  /** @returns {Point} мировое пиксельное начало области просмотра */
  getPixelOrigin() {
    return this._pixelOrigin.clone();
  }

  /**
   * Пиксельные границы области просмотра.
   * @param {LatLng|number[]} [center]
   * @param {number} [zoom]
   * @returns {Bounds}
   */
  getPixelBounds(center, zoom) {
    if (center !== undefined && zoom !== undefined) {
      const topLeft = this.project(center, zoom).subtract(this._size.clone().divideBy(2));
      return new Bounds(
        this.unproject(topLeft, zoom),
        this.unproject(topLeft.clone().add(this._size), zoom),
      );
    }
    return new Bounds(
      this.layerPointToLatLng(new Point(0, 0)),
      this.layerPointToLatLng(this._size),
    );
  }

  /** @returns {Bounds} географические границы области просмотра */
  getBounds() {
    return this.getPixelBounds();
  }

  /**
   * Ограничивает панорамирование географическими границами.
   * @param {Bounds|number[][]|null} bounds
   * @returns {this}
   */
  setMaxBounds(bounds) {
    this.options.maxBounds = bounds
      ? bounds instanceof Bounds
        ? bounds
        : new Bounds(bounds)
      : null;
    if (this.options.maxBounds) {
      const center = this._limitCenter(this._center, this._zoom, this.options.maxBounds);
      this.setView(center, this._zoom, { animate: false });
    }
    return this;
  }

  /* ----------------------------------------------------------------------- *
   * Преобразование координат
   * ----------------------------------------------------------------------- */

  /**
   * Проецирует координаты в мировые пиксели.
   * @param {LatLng|number[]} latlng
   * @param {number} [zoom=this._zoom]
   * @returns {Point}
   */
  project(latlng, zoom = this._zoom) {
    return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
  }

  /**
   * Обратное преобразование к {@link project}.
   * @param {Point|{x:number,y:number}} point
   * @param {number} [zoom=this._zoom]
   * @returns {LatLng}
   */
  unproject(point, zoom = this._zoom) {
    return this.options.crs.pointToLatLng(point instanceof Point ? point : new Point(point), zoom);
  }

  /**
   * @param {LatLng|number[]} latlng
   * @returns {Point} пиксели относительно панели карты
   */
  latLngToLayerPoint(latlng) {
    return this.project(latlng).subtract(this._pixelOrigin);
  }

  /**
   * @param {Point|{x:number,y:number}} point
   * @returns {LatLng}
   */
  layerPointToLatLng(point) {
    return this.unproject(new Point(point).add(this._pixelOrigin));
  }

  /**
   * @param {LatLng|number[]} latlng
   * @returns {Point} пиксели относительно контейнера
   */
  latLngToContainerPoint(latlng) {
    return this.latLngToLayerPoint(latlng);
  }

  /**
   * @param {Point|{x:number,y:number}} point
   * @returns {LatLng}
   */
  containerPointToLatLng(point) {
    return this.layerPointToLatLng(point);
  }

  /**
   * @param {Point|{x:number,y:number}} point
   * @returns {Point}
   */
  containerPointToLayerPoint(point) {
    return new Point(point);
  }

  /**
   * @param {Point|{x:number,y:number}} point
   * @returns {Point}
   */
  layerPointToContainerPoint(point) {
    return new Point(point);
  }

  /**
   * @param {MouseEvent|Touch} event
   * @returns {LatLng}
   */
  mouseEventToLatLng(event) {
    return this.containerPointToLatLng(getMousePosition(event, this._container));
  }

  /**
   * Расстояние по большому кругу между двумя координатами в метрах.
   * @param {LatLng|number[]} from
   * @param {LatLng|number[]} to
   * @returns {number}
   */
  distance(from, to) {
    return toLatLng(from).distanceTo(toLatLng(to));
  }

  /**
   * Масштабный коэффициент между двумя уровнями масштабирования.
   * @param {number} toZoom
   * @param {number} [fromZoom=this._zoom]
   * @returns {number}
   */
  getZoomScale(toZoom, fromZoom = this._zoom) {
    return 2 ** (toZoom - fromZoom);
  }

  /**
   * Уровень масштабирования, соответствующий масштабу относительно `fromZoom`.
   * @param {number} scale
   * @param {number} [fromZoom=this._zoom]
   * @returns {number}
   */
  getScaleZoom(scale, fromZoom = this._zoom) {
    return fromZoom + Math.log(scale) / Math.LN2;
  }

  /* ----------------------------------------------------------------------- *
   * Панорамирование и подгонка
   * ----------------------------------------------------------------------- */

  /**
   * Сдвигает область просмотра на пиксельное смещение.
   * @param {Point|number[]} offset
   * @param {object} [options]
   * @returns {this}
   */
  panBy(offset, options = {}) {
    const point = offset instanceof Point ? offset : new Point(offset);
    if (point.x === 0 && point.y === 0) return this;
    const center = this.unproject(this.project(this._center).add(point), this._zoom);
    return this.setView(center, this._zoom, { ...options, animate: options.animate ?? false });
  }

  /**
   * Панорамирует к координате при текущем масштабе.
   * @param {LatLng|number[]} center
   * @param {object} [options]
   * @returns {this}
   */
  panTo(center, options = {}) {
    return this.setView(center, this._zoom, options);
  }

  /**
   * Минимально панорамирует карту, чтобы координата стала видимой.
   * @param {LatLng|number[]} latlng
   * @param {object} [options]
   * @param {number[]} [options.padding=[0,0]]
   * @returns {this}
   */
  panInside(latlng, options = {}) {
    const point = this.latLngToContainerPoint(latlng);
    const padding = this._paddingToPoint(options.padding);
    const target = point.clone();
    target.x = clamp(target.x, padding.x, this._size.x - padding.x);
    target.y = clamp(target.y, padding.y, this._size.y - padding.y);
    if (target.equals(point)) return this;
    return this.panBy(point.subtract(target), options);
  }

  /**
   * Минимально панорамирует карту, чтобы вся область просмотра оставалась внутри границ.
   * @param {Bounds|number[][]} bounds
   * @param {object} [options]
   * @returns {this}
   */
  panInsideBounds(bounds, options = {}) {
    const target = bounds instanceof Bounds ? bounds : new Bounds(bounds);
    if (!target.isValid()) throw new Error('panInsideBounds requires valid bounds');
    const center = this._limitCenter(this._center, this._zoom, target);
    if (center.equals(this._center)) return this;
    return this.panTo(center, { ...options, animate: options.animate ?? false });
  }

  /**
   * Уровень масштабирования, при котором границы помещаются в область просмотра.
   * @param {Bounds|number[][]} bounds
   * @param {boolean} [inside=false] вписать область просмотра в границы
   * @param {number[]|Point} [padding=[0,0]]
   * @returns {number}
   */
  getBoundsZoom(bounds, inside = false, padding = [0, 0]) {
    const target = bounds instanceof Bounds ? bounds : new Bounds(bounds);
    if (!target.isValid()) throw new Error('getBoundsZoom requires valid bounds');

    const paddingPoint = this._paddingToPoint(padding);
    const available = this._size.clone().subtract(paddingPoint.clone().multiplyBy(2));
    if (available.x <= 0 || available.y <= 0) return this._limitZoom(this.getMaxZoom());

    const nw = this.project(target.getNorthWest());
    const se = this.project(target.getSouthEast());
    const width = Math.abs(se.x - nw.x);
    const height = Math.abs(se.y - nw.y);

    if (width === 0 && height === 0) return this._limitZoom(this.getMaxZoom());
    let scale;
    if (width === 0) scale = available.y / height;
    else if (height === 0) scale = available.x / width;
    else {
      scale = inside
        ? Math.max(available.x / width, available.y / height)
        : Math.min(available.x / width, available.y / height);
    }
    return this._limitZoom(this.getScaleZoom(scale));
  }

  /**
   * Плавно перемещает вид к координате и уровню масштабирования. Использует
   * искривлённую траекторию в экранном пространстве и непрерывную интерполяцию
   * масштаба, отрисовываемую обычным конвейером слоёв.
   * @param {LatLng|number[]} center
   * @param {number} [zoom=this._zoom]
   * @param {object} [options]
   * @param {number} [options.duration] переопределить вычисленную длительность
   * @param {number} [options.curve=0.15] коэффициент кривизны траектории
   * @param {boolean} [options.animate=true]
   * @returns {this}
   */
  flyTo(center, zoom = this._zoom, options = {}) {
    const target = toLatLng(center);
    const targetZoom = this._limitZoom(Number(zoom));
    if (!Number.isFinite(targetZoom)) throw new TypeError('flyTo requires a finite zoom');

    if (options.animate === false || !this._loaded || this._size.x === 0 || this._size.y === 0) {
      return this.setView(target, targetZoom, { animate: false });
    }

    if (this._animatingZoom) this._finishZoomAnimation();
    if (this._panFrame) this._cancelPanAnimation();
    if (this._flyFrame) this._cancelFlyTo();

    const startCenter = this._center.clone();
    const startZoom = this._zoom;
    const distance = startCenter.distanceTo(target);
    const duration = Math.max(
      0,
      Number(options.duration) || clamp(350 + Math.sqrt(distance) * 4, 350, 1400),
    );
    const startWorld = this.project(startCenter, 0);
    const endWorld = this.project(target, 0);
    const mid = startWorld.clone().add(endWorld).divideBy(2);
    const dx = endWorld.x - startWorld.x;
    const dy = endWorld.y - startWorld.y;
    const length = Math.hypot(dx, dy) || 1;
    const curve = Number.isFinite(options.curve) ? Number(options.curve) : 0.15;
    const control = mid
      .clone()
      .add(new Point((-dy / length) * length * curve, (dx / length) * length * curve));

    const zoomChanged = Math.abs(targetZoom - startZoom) > 1e-9;
    this._moveStart(zoomChanged);
    this.fire('flystart', { center: startCenter, zoom: startZoom, target, targetZoom }, false);
    const startTime = performance.now();
    const step = () => {
      const progress = Math.min(1, (performance.now() - startTime) / (duration || 1));
      const t = easeInOutCubic(progress);
      const inv = 1 - t;
      const world = new Point(
        inv * inv * startWorld.x + 2 * inv * t * control.x + t * t * endWorld.x,
        inv * inv * startWorld.y + 2 * inv * t * control.y + t * t * endWorld.y,
      );
      const zoomNow = startZoom + (targetZoom - startZoom) * t;
      this._resetView(this.unproject(world, 0), zoomNow, { reset: false });
      if (progress < 1) {
        this._flyFrame = requestAnimFrame(step);
      } else {
        this._flyFrame = null;
        this._resetView(target, targetZoom, { reset: false });
        this._moveEnd(zoomChanged);
        this.fire('flyend', { center: target, zoom: targetZoom }, false);
      }
    };
    this._flyFrame = requestAnimFrame(step);
    return this;
  }

  /**
   * Перелетает к наилучшему виду границ.
   * @param {Bounds|number[][]} bounds
   * @param {object} [options]
   * @returns {this}
   */
  flyToBounds(bounds, options = {}) {
    const target = bounds instanceof Bounds ? bounds : new Bounds(bounds);
    if (!target.isValid()) throw new Error('flyToBounds requires valid bounds');
    let zoom = this.getBoundsZoom(target, false, options.padding);
    if (Number.isFinite(options.maxZoom)) zoom = Math.min(zoom, options.maxZoom);
    return this.flyTo(target.getCenter(), this._limitZoom(zoom), options);
  }

  /**
   * Вписывает географические границы в область просмотра.
   * @param {Bounds|number[][]} bounds
   * @param {object} [options]
   * @param {number[]|Point} [options.padding=[0,0]]
   * @param {number} [options.maxZoom] ограничить вычисленный масштаб
   * @param {boolean} [options.animate=false]
   * @returns {this}
   */
  fitBounds(bounds, options = {}) {
    const target = bounds instanceof Bounds ? bounds : new Bounds(bounds);
    if (!target.isValid()) throw new Error('fitBounds requires valid bounds');
    let zoom = this.getBoundsZoom(target, false, options.padding);
    if (Number.isFinite(options.maxZoom)) zoom = Math.min(zoom, options.maxZoom);
    return this.setView(target.getCenter(), this._limitZoom(zoom), {
      animate: options.animate ?? false,
    });
  }

  /**
   * Отменяет активную анимацию flyTo.
   * @private
   */
  _cancelFlyTo() {
    if (!this._flyFrame) return;
    cancelAnimFrame(this._flyFrame);
    this._flyFrame = null;
    this._zoom = this._limitZoom(this._zoom);
    this._moveEnd(true);
    this.fire('flyend', { center: this._center, zoom: this._zoom }, false);
  }

  /** @private */
  _paddingToPoint(padding) {
    if (padding instanceof Point) return padding.clone();
    if (Array.isArray(padding)) return new Point(padding[0] || 0, padding[1] || 0);
    if (typeof padding === 'number') return new Point(padding, padding);
    return new Point(0, 0);
  }

  /* ----------------------------------------------------------------------- *
   * Слои
   * ----------------------------------------------------------------------- */

  /**
   * Добавляет слой на карту.
   * @param {import('../layers/Layer.js').Layer} layer
   * @returns {this}
   */
  addLayer(layer) {
    if (!layer) throw new TypeError('addLayer expects a layer');
    if (layer._map === this) return this;

    const id = stamp(layer);
    this._layers[id] = layer;
    layer._map = this;
    layer.addEventParent(this);

    try {
      if (typeof layer.onAdd === 'function') layer.onAdd(this);
      layer.fire('add', { layer }, false);
      if (typeof layer._update === 'function') layer._update();
    } catch (error) {
      delete this._layers[id];
      layer._map = null;
      layer.removeEventParent(this);
      throw error;
    }

    this.fire('layeradd', { layer });
    return this;
  }

  /**
   * Удаляет слой.
   * @param {import('../layers/Layer.js').Layer} layer
   * @returns {this}
   */
  removeLayer(layer) {
    if (!layer || layer._map !== this) return this;
    if (typeof layer.onRemove === 'function') layer.onRemove(this);
    layer.fire('remove', { layer }, false);
    layer.removeEventParent(this);
    layer._map = null;
    delete this._layers[stamp(layer)];
    this.fire('layerremove', { layer });
    return this;
  }

  /** @returns {boolean} */
  hasLayer(layer) {
    return Boolean(layer && layer._map === this && this._layers[stamp(layer)]);
  }

  /**
   * Перебирает слои.
   * @param {Function} callback
   * @param {object} [context]
   * @returns {this}
   */
  eachLayer(callback, context = this) {
    for (const layer of Object.values(this._layers)) {
      callback.call(context, layer);
    }
    return this;
  }

  /** @returns {import('../layers/Layer.js').Layer[]} */
  getLayers() {
    return Object.values(this._layers);
  }

  /**
   * Подбирает общий рендерер для векторного пути.
   * @param {import('../layers/vector/Path.js').Path} layer
   * @returns {import('../layers/vector/Renderer.js').Renderer}
   * @private
   */
  _getRenderer(layer) {
    if (layer.options.renderer) {
      const renderer = layer.options.renderer;
      if (!renderer._map) this.addLayer(renderer);
      return renderer;
    }
    if (this.options.preferCanvas) {
      if (!this._canvasRenderer) {
        this._canvasRenderer = new Canvas();
        this.addLayer(this._canvasRenderer);
      }
      return this._canvasRenderer;
    }
    if (!this._svgRenderer) {
      this._svgRenderer = new SVG();
      this.addLayer(this._svgRenderer);
    }
    return this._svgRenderer;
  }

  /**
   * Возвращает панель по имени, при необходимости создавая пользовательскую панель.
   * @param {string} name
   * @param {boolean} [create=true]
   * @returns {HTMLElement|undefined}
   */
  getPane(name = 'overlay', createPane = true) {
    if (this._panes[name]) return this._panes[name];
    if (!createPane) return undefined;
    return this._createPane(name, `sweety-${name}-pane`);
  }

  /** @returns {Record<string, HTMLElement>} */
  getPanes() {
    return this._panes;
  }

  /** @returns {HTMLElement} */
  getContainer() {
    return this._container;
  }

  /* ----------------------------------------------------------------------- *
   * Контролы (реализованы в src/controls)
   * ----------------------------------------------------------------------- */

  /**
   * Добавляет экземпляр контрола.
   * @param {import('../controls/Control.js').Control} control
   * @returns {this}
   */
  addControl(control) {
    if (!control || typeof control.onAdd !== 'function') {
      throw new TypeError('addControl expects a Control instance');
    }
    if (control._map) return this;
    control._map = this;
    this._controls.push(control);

    try {
      const container = control.onAdd(this);
      if (container) {
        control._container = container;
        const position = control.getPosition ? control.getPosition() : 'topright';
        const corner = this._controlCorners[position] || this._controlCorners.topright;
        corner.appendChild(container);
      }
    } catch (error) {
      this._controls.pop();
      control._map = null;
      throw error;
    }
    return this;
  }

  /**
   * Удаляет экземпляр контрола.
   * @param {import('../controls/Control.js').Control} control
   * @returns {this}
   */
  removeControl(control) {
    const index = this._controls.indexOf(control);
    if (index === -1) return this;
    if (typeof control.onRemove === 'function') control.onRemove(this);
    control._container?.remove();
    this._controls.splice(index, 1);
    control._map = null;
    return this;
  }

  /**
   * Перемещает контрол в угол, соответствующий его текущей позиции.
   * @param {import('../controls/Control.js').Control} control
   * @returns {this}
   * @private
   */
  _repositionControl(control) {
    if (!this._controls.includes(control) || !control._container) return this;
    const position = control.getPosition ? control.getPosition() : 'topright';
    const corner = this._controlCorners[position] || this._controlCorners.topright;
    if (corner) corner.appendChild(control._container);
    return this;
  }

  /* ----------------------------------------------------------------------- *
   * Внутренний хук анимации, используемый обработчиками взаимодействия
   * ----------------------------------------------------------------------- */

  /**
   * Анимирует переход масштаба через CSS-масштабирование панели карты. Сначала
   * отрисовывается целевой вид, чтобы к началу перехода тайлы и векторы уже были
   * в конечном разрешении.
   * @param {LatLng} center
   * @param {number} zoom
   * @param {object} [options]
   * @private
   */
  _animatedZoom(center, zoom, options = {}) {
    if (this._animatingZoom) this._finishZoomAnimation();
    if (this._panFrame) this._cancelPanAnimation();

    const oldZoom = this._zoom;
    const distance = Math.abs(zoom - oldZoom);
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
      this.options.zoomAnimation === false ||
      distance > (this.options.zoomAnimationThreshold ?? 4) ||
      reducedMotion
    ) {
      this._moveStart(true);
      this._resetView(center, zoom, { reset: true });
      this._moveEnd(true);
      return;
    }

    const anchor = options.zoomAnchor
      ? new Point(options.zoomAnchor)
      : this._size.clone().divideBy(2);

    this._moveStart(true);
    this.fire('zoomanim', { center, zoom, oldZoom }, false);
    this._resetView(center, zoom, { reset: true });

    const pane = this._mapPane;
    const startScale = 2 ** (oldZoom - zoom);
    this._animatingZoom = true;
    this._zoomAnimated = true;
    pane.style.transition = 'none';
    pane.style.transformOrigin = `${anchor.x}px ${anchor.y}px`;
    pane.style.transform = `scale(${startScale})`;
    // Принудительно сбрасываем стили перед переходом, чтобы первый кадр зафиксировался.
    void pane.offsetWidth;
    addClass(this._container, 'sweety-zoom-anim');
    this._zoomAnimFrame = requestAnimFrame(() => {
      pane.style.transition = '';
      pane.style.transform = 'scale(1)';
    });

    this._zoomAnimTimer = setTimeout(() => this._finishZoomAnimation(), 260);
  }

  /**
   * Завершает выполняющийся переход масштаба и генерирует `moveend`/`zoomend`.
   * Безопасно вызывать, когда переход не запущен.
   * @private
   */
  _finishZoomAnimation() {
    if (!this._animatingZoom) return;
    this._animatingZoom = false;
    this._zoomAnimated = false;
    if (this._zoomAnimTimer) {
      clearTimeout(this._zoomAnimTimer);
      this._zoomAnimTimer = null;
    }
    if (this._zoomAnimFrame) {
      cancelAnimFrame(this._zoomAnimFrame);
      this._zoomAnimFrame = null;
    }
    const pane = this._mapPane;
    if (pane) {
      pane.style.transition = 'none';
      pane.style.transform = '';
      pane.style.transformOrigin = '';
    }
    removeClass(this._container, 'sweety-zoom-anim');
    this._moveEnd(true);
  }

  /**
   * Плавно смещает центр области просмотра на небольшое расстояние.
   * @param {LatLng} center
   * @param {object} [options]
   * @private
   */
  _animatePan(center, options = {}) {
    if (this._panFrame) this._cancelPanAnimation();
    const from = this._center.clone();
    const target = this._limitCenter(new LatLng(center), this._zoom, this.options.maxBounds);
    const duration = Math.max(80, Number(options.duration) || 250);
    const startTime = performance.now();

    this._moveStart(false);
    const step = () => {
      const now = performance.now();
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(progress);
      const centerPoint = this.project(from)
        .multiplyBy(1 - eased)
        .add(this.project(target).multiplyBy(eased));
      this._moveDuringDrag(this.unproject(centerPoint));
      if (progress < 1) {
        this._panFrame = requestAnimFrame(step);
      } else {
        this._panFrame = null;
        this._panEnd = null;
        this._moveEnd(false);
      }
    };
    this._panEnd = () => {
      if (this._panFrame) cancelAnimFrame(this._panFrame);
      this._panFrame = null;
      this._panEnd = null;
      this._moveEnd(false);
    };
    this._panFrame = requestAnimFrame(step);
  }

  /** @private */
  _cancelPanAnimation() {
    if (this._panEnd) this._panEnd();
  }

  /**
   * Подавляет следующий клик, сгенерированный DOM; используется обработчиками перетаскивания.
   * @returns {this}
   */
  _suppressClick() {
    this._suppressClickFlag = true;
    setTimeout(() => {
      this._suppressClickFlag = false;
    }, 0);
    return this;
  }

  /**
   * @param {MouseEvent} event
   * @returns {Point}
   */
  _mouseEventToContainerPoint(event) {
    return getMousePosition(event, this._container);
  }
}

export { DEFAULT_OPTIONS };
