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
} from '../util/index.js';

/** @type {Function[]} */
const initHooks = [];

/**
 * @typedef {object} MapOptions
 * @property {LatLng|number[]} [center=[0,0]] Initial geographic centre
 * @property {number} [zoom=0] Initial zoom
 * @property {number} [minZoom=0] Minimum zoom
 * @property {number} [maxZoom=22] Maximum zoom
 * @property {number} [zoomSnap=1] Snap interval for programmatic zoom
 * @property {number} [zoomDelta=1] Amount changed by zoomIn/zoomOut
 * @property {Bounds|number[][]} [maxBounds=null] Restrict the viewport
 * @property {import('../geo/CRS.js').CRS} [crs=EPSG3857] Coordinate reference system
 * @property {boolean} [zoomAnimation=true] Animate zoom transitions
 * @property {boolean} [fadeAnimation=true] Fade in newly loaded tiles
 * @property {boolean} [trackResize=true] Observe container size
 * @property {boolean} [preferCanvas=false] Use a shared Canvas renderer for paths
 * @property {boolean} [closePopupOnClick=true] Close popups on map click
 * @property {boolean} [zoomControl=true] Add the default zoom control
 * @property {boolean} [attributionControl=true] Add the default attribution control
 * @property {number} [zoomAnimationThreshold=4] Max zoom levels animated at once
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
 * Central map controller. It owns the DOM container, the view state, layer
 * registry, interaction handlers, panes and controls.
 *
 * @example
 * const map = new Map('map', { center: [55.75, 37.61], zoom: 10 });
 * map.on('click', (event) => console.log(event.latlng));
 */
export class Map extends Evented {
  /**
   * Register a function invoked at the end of every Map construction.
   * Plugins use this hook to add methods or controls without monkey-patching
   * the constructor.
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
   * Layout and lifecycle
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
   * Instantiate and expose an interaction handler on the map.
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
   * Apply a centre during an active drag or kinetic animation. Unlike
   * {@link setView}, this does not start or end a movement transaction.
   * @param {LatLng|number[]} center
   * @returns {boolean} whether the centre actually changed
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
   * Current map size in CSS pixels.
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
   * Re-read the container size. Useful after showing a previously hidden map.
   * @param {object} [options]
   * @param {boolean} [options.pan=true] Keep the centre while resizing
   * @param {boolean} [options.debounce=false] Coalesce resize events
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
   * Destroy the map, remove all layers and handlers, and detach listeners.
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
   * Run a callback once the map is ready. If already loaded it runs
   * asynchronously to keep ordering predictable.
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
   * View state
   * ----------------------------------------------------------------------- */

  /**
   * Set the centre and zoom, firing the standard view event sequence.
   * @param {LatLng|number[]} center
   * @param {number} [zoom=this._zoom]
   * @param {object} [options]
   * @param {boolean} [options.animate=false] Animate the transition
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
   * Re-render all layers at the current view. Called after every committed
   * movement; layers decide whether they need to load or only reposition.
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
   * Clamp a centre so the viewport stays inside `maxBounds`.
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

    // A world smaller than the viewport is centred rather than clamped.
    if (minX > maxX) minX = maxX = (nw.x + se.x) / 2;
    if (minY > maxY) minY = maxY = (nw.y + se.y) / 2;

    return this.unproject(
      new Point(clamp(centerPoint.x, minX, maxX), clamp(centerPoint.y, minY, maxY)),
      zoom,
    );
  }

  /** @returns {LatLng} a defensive copy of the current centre */
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
   * Set zoom around the current centre (or a supplied anchor).
   * @param {number} zoom
   * @param {object} [options]
   * @returns {this}
   */
  setZoom(zoom, options = {}) {
    return this.setView(this._center, zoom, options);
  }

  /**
   * Change zoom relative to the current level.
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
   * Zoom while keeping a geographic or pixel anchor visually fixed.
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
   * Zoom around a screen point, used by wheel and pinch handlers.
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

  /** @returns {Point} world pixel origin of the viewport */
  getPixelOrigin() {
    return this._pixelOrigin.clone();
  }

  /**
   * Pixel bounds of the viewport.
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

  /** @returns {Bounds} geographic viewport bounds */
  getBounds() {
    return this.getPixelBounds();
  }

  /**
   * Restrict panning to geographic bounds.
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
   * Coordinate conversion
   * ----------------------------------------------------------------------- */

  /**
   * Project coordinates to world pixels.
   * @param {LatLng|number[]} latlng
   * @param {number} [zoom=this._zoom]
   * @returns {Point}
   */
  project(latlng, zoom = this._zoom) {
    return this.options.crs.latLngToPoint(toLatLng(latlng), zoom);
  }

  /**
   * Inverse of {@link project}.
   * @param {Point|{x:number,y:number}} point
   * @param {number} [zoom=this._zoom]
   * @returns {LatLng}
   */
  unproject(point, zoom = this._zoom) {
    return this.options.crs.pointToLatLng(point instanceof Point ? point : new Point(point), zoom);
  }

  /**
   * @param {LatLng|number[]} latlng
   * @returns {Point} pixels relative to the map pane
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
   * @returns {Point} pixels relative to the container
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
   * Great-circle distance between two coordinates in metres.
   * @param {LatLng|number[]} from
   * @param {LatLng|number[]} to
   * @returns {number}
   */
  distance(from, to) {
    return toLatLng(from).distanceTo(toLatLng(to));
  }

  /**
   * Scale factor between two zoom levels.
   * @param {number} toZoom
   * @param {number} [fromZoom=this._zoom]
   * @returns {number}
   */
  getZoomScale(toZoom, fromZoom = this._zoom) {
    return 2 ** (toZoom - fromZoom);
  }

  /**
   * Zoom level that corresponds to a scale relative to `fromZoom`.
   * @param {number} scale
   * @param {number} [fromZoom=this._zoom]
   * @returns {number}
   */
  getScaleZoom(scale, fromZoom = this._zoom) {
    return fromZoom + Math.log(scale) / Math.LN2;
  }

  /* ----------------------------------------------------------------------- *
   * Panning and fitting
   * ----------------------------------------------------------------------- */

  /**
   * Shift the viewport by a pixel offset.
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
   * Pan to a coordinate at the current zoom.
   * @param {LatLng|number[]} center
   * @param {object} [options]
   * @returns {this}
   */
  panTo(center, options = {}) {
    return this.setView(center, this._zoom, options);
  }

  /**
   * Pan the map minimally so a coordinate becomes visible.
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
   * Pan the map minimally so the whole viewport stays inside bounds.
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
   * Zoom level that fits bounds in the viewport.
   * @param {Bounds|number[][]} bounds
   * @param {boolean} [inside=false] fit the viewport inside bounds
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
   * Smoothly fly to a coordinate and zoom level. Uses a curved screen-space
   * path and a continuous zoom interpolation rendered by the normal layer
   * pipeline.
   * @param {LatLng|number[]} center
   * @param {number} [zoom=this._zoom]
   * @param {object} [options]
   * @param {number} [options.duration] override the computed duration
   * @param {number} [options.curve=0.15] path curvature factor
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
   * Fly to the best view of bounds.
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
   * Fit geographic bounds into the viewport.
   * @param {Bounds|number[][]} bounds
   * @param {object} [options]
   * @param {number[]|Point} [options.padding=[0,0]]
   * @param {number} [options.maxZoom] cap the computed zoom
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
   * Cancel an active flyTo animation.
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
   * Layers
   * ----------------------------------------------------------------------- */

  /**
   * Add a layer to the map.
   * @param {import('../layers/Layer.js').Layer} layer
   * @returns {this}
   */
  addLayer(layer) {
    if (!layer) throw new TypeError('addLayer expects a layer');
    if (layer._map === this) return this;

    const id = layer._sweetyId || (layer._sweetyId = ++Map._layerId);
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
   * Remove a layer.
   * @param {import('../layers/Layer.js').Layer} layer
   * @returns {this}
   */
  removeLayer(layer) {
    if (!layer || layer._map !== this) return this;
    if (typeof layer.onRemove === 'function') layer.onRemove(this);
    layer.fire('remove', { layer }, false);
    layer.removeEventParent(this);
    layer._map = null;
    delete this._layers[layer._sweetyId];
    this.fire('layerremove', { layer });
    return this;
  }

  /** @returns {boolean} */
  hasLayer(layer) {
    return Boolean(layer && layer._map === this && this._layers[layer._sweetyId]);
  }

  /**
   * Iterate over layers.
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
   * Resolve a shared renderer for a vector path.
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
   * Get a pane by name, creating a custom pane on demand.
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
   * Controls (implemented in src/controls)
   * ----------------------------------------------------------------------- */

  /**
   * Add a control instance.
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
   * Remove a control instance.
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
   * Move a control to its current position corner.
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
   * Internal animation hook used by interaction handlers
   * ----------------------------------------------------------------------- */

  /**
   * Animate a zoom transition with a CSS scale on the map pane. The target
   * view is rendered first so tiles and vectors are already at their final
   * resolution when the transition starts.
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
    // Force a style flush before the transition to make the first frame stick.
    void pane.offsetWidth;
    addClass(this._container, 'sweety-zoom-anim');
    this._zoomAnimFrame = requestAnimFrame(() => {
      pane.style.transform = 'scale(1)';
    });

    this._zoomAnimTimer = setTimeout(() => this._finishZoomAnimation(), 260);
  }

  /**
   * Complete an in-flight zoom transition and fire `moveend`/`zoomend`.
   * Safe to call when no transition is running.
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
   * Tween the viewport centre over a short distance.
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
   * Prevent the next DOM-generated click, used by drag handlers.
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

Map._layerId = 0;

export { DEFAULT_OPTIONS };
