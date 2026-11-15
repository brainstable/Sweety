import { Layer } from './Layer.js';
import { Point } from '../core/Point.js';
import { addClass, create, removeClass, setOpacity } from '../util/dom.js';
import { devicePixelRatio, extend, template } from '../util/index.js';

const DEFAULT_TILE_SIZE = 256;

/** @typedef {object} TileLayerOptions
 * @property {string|string[]} [subdomains='abc']
 * @property {number} [minZoom=0]
 * @property {number} [maxZoom=19]
 * @property {number|null} [maxNativeZoom=null]
 * @property {number|null} [minNativeZoom=null]
 * @property {number} [tileSize=256]
 * @property {boolean} [tms=false]
 * @property {boolean} [noWrap=false]
 * @property {number} [zoomOffset=0]
 * @property {boolean} [zoomReverse=false]
 * @property {string} [errorTileUrl='']
 * @property {boolean} [detectRetina=false]
 * @property {boolean|string} [crossOrigin=false]
 * @property {string} [referrerPolicy='']
 * @property {number} [opacity=1]
 * @property {number} [keepBuffer=2]
 * @property {number} [maxRetries=2]
 * @property {string} [className='']
 * @property {string} [attribution]
 */

const DEFAULT_OPTIONS = {
  subdomains: 'abc',
  minZoom: 0,
  maxZoom: 19,
  maxNativeZoom: null,
  minNativeZoom: null,
  tileSize: DEFAULT_TILE_SIZE,
  tms: false,
  noWrap: false,
  zoomOffset: 0,
  zoomReverse: false,
  errorTileUrl: '',
  detectRetina: false,
  crossOrigin: false,
  referrerPolicy: '',
  opacity: 1,
  keepBuffer: 2,
  maxRetries: 2,
  className: '',
  attribution: null,
  pane: 'tile',
  maxCacheSize: 256,
};

/**
 * XYZ tile layer with visible-tile virtualisation, subdomains, retina URLs,
 * a DOM image cache and retry handling.
 *
 * @example
 * new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
 *   attribution: '&copy; OpenStreetMap contributors',
 * }).addTo(map);
 */
export class TileLayer extends Layer {
  /**
   * @param {string} urlTemplate
   * @param {TileLayerOptions} [options]
   */
  constructor(urlTemplate, options = {}) {
    super(extend({}, DEFAULT_OPTIONS, options));
    if (typeof urlTemplate !== 'string' || !urlTemplate) {
      throw new TypeError('TileLayer requires a non-empty URL template');
    }
    /** @type {string} */
    this._url = urlTemplate;
    /** @type {Record<string, object>} */
    this._tiles = Object.create(null);
    /** @type {Map<string, HTMLImageElement>} */
    this._tileCache = new globalThis.Map();
    this._tileZoom = null;
    this._tileContainer = null;
    this._retryTimers = new Set();
    this._tileSize = new Point(Number(this.options.tileSize) || DEFAULT_TILE_SIZE);
    this._subdomains = Array.isArray(this.options.subdomains)
      ? this.options.subdomains
      : String(this.options.subdomains).split('');
    if (!this._subdomains.length) this._subdomains = [''];
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._container = create(
      'div',
      `sweety-layer sweety-tile-layer ${this.options.className || ''}`.trim(),
    );
    this._container.style.position = 'absolute';
    this._container.style.left = '0';
    this._container.style.top = '0';
    this._container.style.zIndex = String(this.options.zIndex || 1);
    setOpacity(this._container, this.options.opacity);
    map.getPane(this.options.pane).appendChild(this._container);
    this._tileContainer = this._container;
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    for (const timer of this._retryTimers) clearTimeout(timer);
    this._retryTimers.clear();
    this._clearTiles();
    this._clearCache();
    if (this._tileContainer && this._tileContainer.parentNode) {
      this._tileContainer.parentNode.removeChild(this._tileContainer);
    }
    this._tileContainer = null;
    this._container = null;
    this._tileZoom = null;
    map.fire('tilelayerremove', { layer: this });
  }

  /**
   * Recompute the visible tile grid. Only tiles inside the viewport plus
   * `keepBuffer` are kept in the DOM.
   * @private
   */
  _update() {
    if (!this._map || !this._tileContainer) return;

    const map = this._map;
    const zoom = map.getZoom();
    if (zoom < this.options.minZoom || zoom > this.options.maxZoom) {
      this._tileContainer.style.display = 'none';
      this._clearTiles();
      return;
    }
    this._tileContainer.style.display = '';

    let tileZoom = Math.round(zoom);
    if (this.options.zoomReverse) tileZoom = map.getMaxZoom() - tileZoom + this.options.zoomOffset;
    else tileZoom += Number(this.options.zoomOffset) || 0;
    if (this.options.maxNativeZoom !== null)
      tileZoom = Math.min(tileZoom, this.options.maxNativeZoom);
    if (this.options.minNativeZoom !== null)
      tileZoom = Math.max(tileZoom, this.options.minNativeZoom);
    tileZoom = Math.max(0, Math.min(24, tileZoom));

    if (this._tileZoom !== null && this._tileZoom !== tileZoom) {
      this._clearTiles();
    }
    this._tileZoom = tileZoom;

    const scale = 2 ** (zoom - tileZoom);
    const tileSize = this._tileSize.x;
    const origin = map.getPixelOrigin();
    const range = this.getTileRange(tileZoom);
    const { minX, maxX, minY, maxY } = range;

    const visible = Object.create(null);
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const key = `${tileZoom}/${x}/${y}`;
        visible[key] = true;
        if (!this._tiles[key]) {
          const left = x * tileSize * scale - origin.x;
          const top = y * tileSize * scale - origin.y;
          this._addTile(key, x, y, tileZoom, left, top, tileSize * scale, 2 ** tileZoom);
        } else {
          const left = x * tileSize * scale - origin.x;
          const top = y * tileSize * scale - origin.y;
          this._positionTile(this._tiles[key], left, top, tileSize * scale);
        }
      }
    }

    for (const key of Object.keys(this._tiles)) {
      if (!visible[key]) this._removeTile(key);
    }

    if (!this._tilesLoaded) {
      this._tilesLoaded = true;
      this.fire('load');
    }
  }

  /**
   * Inclusive tile coordinate range for the current viewport, including the
   * configured buffer. This is the core of tile virtualisation: only these
   * coordinates are materialised in the DOM.
   * @param {number} [tileZoom=this._tileZoom]
   * @returns {{minX:number,maxX:number,minY:number,maxY:number}|null}
   */
  getTileRange(tileZoom = this._tileZoom) {
    if (!this._map || tileZoom === null) return null;
    const map = this._map;
    const tileSize = this._tileSize.x;
    const worldTiles = 2 ** tileZoom;
    const buffer = Number(this.options.keepBuffer) || 0;
    const bounds = map.getPixelBounds();
    const nw = map.project(bounds.getNorthWest(), tileZoom);
    const se = map.project(bounds.getSouthEast(), tileZoom);

    let minX = Math.floor(nw.x / tileSize) - buffer;
    let maxX = Math.floor((se.x - 1) / tileSize) + buffer;
    let minY = Math.floor(nw.y / tileSize) - buffer;
    let maxY = Math.floor((se.y - 1) / tileSize) + buffer;

    if (!this.options.noWrap) {
      const worldPx = worldTiles * tileSize;
      if (se.x - nw.x < worldPx) {
        // Keep the visual range; the URL x coordinate is wrapped separately.
        minX = Math.max(minX, -worldTiles);
        maxX = Math.min(maxX, worldTiles * 2);
      }
    } else {
      minX = Math.max(minX, 0);
      maxX = Math.min(maxX, worldTiles - 1);
    }
    minY = Math.max(minY, 0);
    maxY = Math.min(maxY, worldTiles - 1);
    return { minX, maxX, minY, maxY };
  }

  /** @private */
  _addTile(key, x, y, zoom, left, top, size, worldTiles) {
    const tile = {
      key,
      x,
      y,
      zoom,
      loaded: false,
      errorCount: 0,
      el: null,
    };

    const wrapX = ((x % worldTiles) + worldTiles) % worldTiles;
    const url = this.getTileUrl({ x: wrapX, y, z: zoom });
    tile.url = url;

    let element = this._takeCachedTile(url);
    if (!element) {
      element = document.createElement('img');
      element.alt = '';
      element.draggable = false;
      element.className = 'sweety-tile';
      if (this.options.crossOrigin !== undefined && this.options.crossOrigin !== false) {
        element.crossOrigin =
          this.options.crossOrigin === true ? 'anonymous' : this.options.crossOrigin;
      }
      if (this.options.referrerPolicy) element.referrerPolicy = this.options.referrerPolicy;
    } else {
      element.className = 'sweety-tile sweety-tile-loaded';
      tile.loaded = true;
    }
    element.onload = () => this._tileReady(tile);
    element.onerror = () => this._tileError(tile);

    tile.el = element;
    element.width = this._tileSize.x;
    element.height = this._tileSize.y;
    element.style.width = `${this._tileSize.x}px`;
    element.style.height = `${this._tileSize.y}px`;
    this._positionTile(tile, left, top, size);

    this._tiles[key] = tile;
    this._container.appendChild(element);
    addClass(element, 'sweety-tile-loading');
    this.fire('tileloadstart', { tile: element, coords: { x, y, z: zoom }, url });

    if (!tile.loaded) {
      element.src = url;
    } else {
      this._tileReady(tile);
    }
  }

  /** @private */
  _positionTile(tile, left, top, size) {
    const element = tile.el;
    if (!element) return;
    element.style.position = 'absolute';
    element.style.left = `${Math.round(left)}px`;
    element.style.top = `${Math.round(top)}px`;
    if (size !== this._tileSize.x) {
      element.style.width = `${Math.round(size)}px`;
      element.style.height = `${Math.round(size)}px`;
    }
  }

  /** @private */
  _tileReady(tile) {
    if (!tile.el || tile.ready) return;
    tile.ready = true;
    tile.loaded = true;
    removeClass(tile.el, 'sweety-tile-loading');
    removeClass(tile.el, 'sweety-tile-error');
    addClass(tile.el, 'sweety-tile-loaded');
    this.fire('tileload', {
      tile: tile.el,
      coords: { x: tile.x, y: tile.y, z: tile.zoom },
      url: tile.url,
    });
  }

  /** @private */
  _tileError(tile) {
    if (!tile.el || this._tiles[tile.key] !== tile) return;
    tile.errorCount += 1;
    addClass(tile.el, 'sweety-tile-error');
    this.fire('tileerror', {
      tile: tile.el,
      coords: { x: tile.x, y: tile.y, z: tile.zoom },
      url: tile.url,
      error: new Error(`Failed to load tile ${tile.url}`),
    });

    if (this.options.errorTileUrl) {
      if (tile.el.src !== this.options.errorTileUrl) {
        tile.el.src = this.options.errorTileUrl;
      }
      return;
    }

    if (tile.errorCount <= (Number(this.options.maxRetries) || 0)) {
      const retryUrl = `${tile.url}${tile.url.includes('?') ? '&' : '?'}_sweety_retry=${tile.errorCount}`;
      const timer = setTimeout(
        () => {
          this._retryTimers.delete(timer);
          if (this._tiles[tile.key] === tile && tile.el) tile.el.src = retryUrl;
        },
        250 * 2 ** (tile.errorCount - 1),
      );
      this._retryTimers.add(timer);
    }
  }

  /**
   * Build a URL from the template.
   * @param {{x:number,y:number,z:number}} coords
   * @returns {string}
   */
  getTileUrl({ x, y, z }) {
    const max = 2 ** z;
    const retina = this.options.detectRetina && devicePixelRatio() > 1 ? '@2x' : '';
    const subdomain =
      this._subdomains[Math.abs((x * 7 + y * 13 + z * 31) % this._subdomains.length)];
    const tileY = this.options.tms ? max - 1 - y : y;
    return template(this._url, {
      s: subdomain,
      x,
      y: tileY,
      z,
      r: retina,
      '-y': max - 1 - y,
    });
  }

  /**
   * Change the URL template and optionally redraw.
   * @param {string} urlTemplate
   * @param {boolean} [noRedraw=false]
   * @returns {this}
   */
  setUrl(urlTemplate, noRedraw = false) {
    if (typeof urlTemplate !== 'string' || !urlTemplate) {
      throw new TypeError('setUrl expects a non-empty template');
    }
    this._url = urlTemplate;
    if (!noRedraw) this.redraw();
    return this;
  }

  /**
   * Set container opacity.
   * @param {number} opacity
   * @returns {this}
   */
  setOpacity(opacity) {
    this.options.opacity = Math.max(0, Math.min(1, Number(opacity)));
    if (this._container) setOpacity(this._container, this.options.opacity);
    return this;
  }

  /** @returns {string|null} */
  getAttribution() {
    return this.options.attribution || null;
  }

  /** Remove and recreate all tiles. @returns {this} */
  redraw() {
    this._clearTiles();
    this._tileZoom = null;
    this._tilesLoaded = false;
    this._update();
    return this;
  }

  /** @private */
  _removeTile(key) {
    const tile = this._tiles[key];
    if (!tile) return;
    delete this._tiles[key];
    const element = tile.el;
    if (!element) return;
    element.onload = null;
    element.onerror = null;
    element.remove();
    if (!tile.errorCount && element.complete) this._putCachedTile(tile.url, element);
  }

  /** @private */
  _clearTiles() {
    for (const key of Object.keys(this._tiles)) this._removeTile(key);
    this._tilesLoaded = false;
  }

  /** @private */
  _takeCachedTile(url) {
    const element = this._tileCache.get(url);
    if (!element) return null;
    this._tileCache.delete(url);
    return element;
  }

  /** @private */
  _putCachedTile(url, element) {
    if (!element || this._tileCache.has(url)) return;
    if (this._tileCache.size >= (Number(this.options.maxCacheSize) || 256)) {
      const oldest = this._tileCache.keys().next().value;
      this._tileCache.delete(oldest);
    }
    this._tileCache.set(url, element);
  }

  /** Clear the in-memory image cache. @returns {this} */
  clearTileCache() {
    this._clearCache();
    return this;
  }

  /** @private */
  _clearCache() {
    this._tileCache.clear();
  }

  /** @returns {number} number of tiles currently in the DOM */
  getActiveTileCount() {
    return Object.keys(this._tiles).length;
  }

  /** @returns {number} number of cached images */
  getCacheSize() {
    return this._tileCache.size;
  }
}
