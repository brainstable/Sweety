import { TileLayer } from 'sweety-map';
import { getTileSource } from './adapters/index.js';
import { resolveBasemap } from './resolver.js';

/**
 * TileLayer, который строит URL через выбранный TileSourceAdapter. Позволяет
 * использовать один слой для XYZ, WMS, WMTS, Google и Bing.
 */
export class BasemapTileLayer extends TileLayer {
  /**
   * @param {object} resolved результат resolveBasemap()
   * @param {import('./adapters/TileSource.js').TileSourceAdapter} adapter
   * @param {object} [options]
   */
  constructor(resolved, adapter, options = {}) {
    super(resolved.url, {
      attribution: resolved.attribution,
      minZoom: resolved.minZoom,
      maxZoom: resolved.maxZoom,
      maxNativeZoom: resolved.maxNativeZoom,
      minNativeZoom: resolved.minNativeZoom,
      tileSize: resolved.tileSize,
      subdomains: resolved.subdomains,
      detectRetina: false,
      opacity: 1,
      ...options,
    });
    this.resolved = resolved;
    this.provider = resolved.provider;
    this.adapter = adapter;
    this.basemapId = resolved.id;
    this._basemapVariant = resolved.variant;
    this._basemapRetina = resolved.retina;
  }

  /**
   * @param {{x:number,y:number,z:number}} coords
   * @returns {string}
   */
  getTileUrl(coords) {
    try {
      return this.adapter.buildUrl(this.provider, coords, {
        url: this.resolved.url,
        variantValue: this.resolved.variantValue,
        retina: this.resolved.retina,
        adapterOptions: this.resolved.adapterOptions,
      });
    } catch {
      // Ошибка конфигурации адаптера не должна ронять весь слой: отдаём
      // базовый шаблон, а слой сгенерирует tileerror штатным путём.
      return super.getTileUrl(coords);
    }
  }

  /** @returns {string} */
  getBasemapId() {
    return this.basemapId;
  }

  /** @returns {object} */
  getProvider() {
    return this.provider;
  }

  /** @returns {object} */
  getResolved() {
    return this.resolved;
  }

  /** @returns {string} */
  getBasemapVariant() {
    return this._basemapVariant;
  }

  /**
   * Меняет провайдера без пересоздания DOM-контейнера, если совместимы tileSize
   * и проекция. Менеджер использует этот метод только для смены URL/атрибуции.
   * @param {object} resolved
   * @param {import('./adapters/TileSource.js').TileSourceAdapter} adapter
   * @returns {this}
   */
  setBasemap(resolved, adapter) {
    this.resolved = resolved;
    this.provider = resolved.provider;
    this.adapter = adapter;
    this.basemapId = resolved.id;
    this._basemapVariant = resolved.variant;
    this._basemapRetina = resolved.retina;
    this._url = resolved.url;
    this.options.attribution = resolved.attribution;
    this.options.minZoom = resolved.minZoom;
    this.options.maxZoom = resolved.maxZoom;
    this.redraw();
    return this;
  }
}

/**
 * Создаёт слой из уже разрешённого дескриптора. Используется менеджером и
 * функциональным API.
 * @param {object} resolved
 * @param {object} [opts]
 * @param {object} [managerOptions]
 * @returns {BasemapTileLayer}
 */
export function createLayerFromResolved(resolved, opts = {}, managerOptions = {}) {
  const adapter = getTileSource(resolved.type);
  return new BasemapTileLayer(resolved, adapter, {
    opacity: opts.opacity ?? managerOptions.opacity,
    zIndex: opts.zIndex ?? managerOptions.zIndex,
    crossOrigin: opts.crossOrigin ?? managerOptions.crossOrigin,
    errorTileUrl: opts.errorTileUrl ?? managerOptions.errorTileUrl,
    noWrap: opts.noWrap ?? managerOptions.noWrap,
    updateWhenIdle: opts.updateWhenIdle ?? managerOptions.updateWhenIdle,
    keepBuffer: opts.keepBuffer ?? managerOptions.keepBuffer,
    maxRetries: opts.maxRetries ?? managerOptions.maxRetries,
    ...(opts.layerOptions || {}),
  });
}

/**
 * Функциональный сценарий B: создать слой без менеджера.
 * @param {string} id
 * @param {object} [opts]
 * @param {object} [managerOptions]
 * @returns {BasemapTileLayer}
 */
export function createBasemap(id, opts = {}, managerOptions = {}) {
  const resolved = resolveBasemap(id, opts, {
    keys: managerOptions.keys,
    env: managerOptions.env,
    retina: opts.retina ?? managerOptions.retina,
    variant: opts.variant ?? managerOptions.variant,
    proxy: opts.proxy ?? managerOptions.proxy,
  });
  return createLayerFromResolved(resolved, opts, managerOptions);
}
