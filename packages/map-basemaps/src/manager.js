import { Evented } from 'sweety-map';
import { BasemapControl } from './control/BasemapControl.js';
import { maskUrl } from './errors.js';
import { createLayerFromResolved } from './layer.js';
import { getProvider, listProviders, registerProvider, unregisterProvider } from './registry.js';
import { getAttribution, resolveBasemap, resolveKey, resolveUrl } from './resolver.js';

const DEFAULT_OPTIONS = {
  multiple: false,
  persist: false,
  storageKey: 'basemap',
  fallback: null,
  maxTileErrors: 3,
  zIndex: null,
  opacity: 1,
  retina: 'auto',
  variant: 'default',
  keys: {},
  proxy: null,
  env: null,
  control: false,
  controlOptions: {},
};

/**
 * Менеджер подложек. Один экземпляр на карту; хранит активный id, слои,
 * настройки ключей и подписки на события. Не использует глобального состояния.
 */
export class BasemapsManager extends Evented {
  /**
   * Устанавливает менеджер на карту. Идемпотентно.
   * @param {any} map
   * @param {object} [options]
   * @returns {BasemapsManager}
   */
  static install(map, options = {}) {
    if (map?.basemaps) {
      if (options.control && !map.basemaps.control) map.basemaps.addControl(options.controlOptions);
      return map.basemaps;
    }
    const manager = new BasemapsManager(map, options);
    map.basemaps = manager;
    if (manager.options.control) manager.addControl(manager.options.controlOptions);

    const stored = manager._readStorage();
    const configured = options.default ?? options.basemap ?? map.options?.basemap ?? null;
    let initial = configured;
    let initialOptions = {};
    if (configured && typeof configured === 'object') {
      initialOptions = { ...configured };
      initial = initialOptions.id;
      delete initialOptions.id;
    }
    if (!initial && stored?.id) {
      initial = stored.id;
      initialOptions = { ...initialOptions, variant: stored.variant, retina: stored.retina };
    }
    if (initial) {
      try {
        manager.set(initial, { ...initialOptions, force: true });
      } catch {
        if (manager.options.fallback && manager.options.fallback !== initial) {
          try {
            manager.set(manager.options.fallback, { force: true });
          } catch {
            // basemaperror уже отправлен менеджером
          }
        }
      }
    }
    manager.fire('ready', { manager });
    return manager;
  }

  /**
   * @param {any} map
   * @param {object} [options]
   */
  constructor(map, options = {}) {
    super();
    if (!map || typeof map.on !== 'function' || typeof map.addLayer !== 'function') {
      throw new TypeError('BasemapsManager requires a Sweety Map instance');
    }
    this.map = map;
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      keys: { ...DEFAULT_OPTIONS.keys, ...(options.keys || {}) },
      controlOptions: { ...DEFAULT_OPTIONS.controlOptions, ...(options.controlOptions || {}) },
    };
    /** @type {Map<string, any>} */
    this._layers = new Map();
    /** @type {Map<any, {tileerror: Function, load: Function}>} */
    this._layerHandlers = new Map();
    this._readyLayers = new WeakSet();
    this._errorNotified = new WeakSet();
    this._tileErrors = new Map();
    this._activeId = null;
    this._variant =
      this.options.variant && this.options.variant !== 'default' ? this.options.variant : null;
    this._retina = this.options.retina;
    this._swapping = false;
    this._fallbackActive = false;
    this._destroyed = false;
    this.control = null;

    this._onLayerRemove = (event) => this._handleLayerRemove(event);
    map.on('layerremove', this._onLayerRemove, this);
  }

  /* ----------------------------------------------------------------------- *
   * Основные операции
   * ----------------------------------------------------------------------- */

  /**
   * Переключает активную подложку. При ошибке текущая подложка сохраняется,
   * отправляется `basemaperror`, а исключение пробрасывается.
   * @param {string} id
   * @param {object} [opts]
   * @returns {boolean}
   */
  set(id, opts = {}) {
    if (this._destroyed) throw new Error('BasemapsManager is destroyed');
    const same =
      id === this._activeId &&
      this.map.hasLayer(this.getLayer()) &&
      (opts.variant === undefined || opts.variant === this._variant) &&
      opts.key === undefined &&
      opts.retina === undefined;
    if (same && !opts.force) return true;

    let resolved;
    try {
      resolved = resolveBasemap(id, opts, this._context());
    } catch (error) {
      this._reportError(id, error, { phase: 'resolve' });
      throw error;
    }

    const projection = this.map.options?.crs?.code || 'EPSG:3857';
    if (resolved.projections?.length && !resolved.projections.includes(projection)) {
      this.fire('basemaperror', {
        id,
        code: 'projection-warning',
        warning: true,
        message: `Provider "${id}" expects ${resolved.projections.join(', ')}, map uses ${projection}`,
        provider: resolved.provider,
      });
    }

    let layer;
    try {
      layer = this._createLayer(resolved, opts);
    } catch (error) {
      this._reportError(id, error, { phase: 'create' });
      throw error;
    }

    const previousId = this._activeId;
    const oldLayer = this._layers.get(id);
    const previousLayer = this._activeId ? this._layers.get(this._activeId) : null;
    const zIndex =
      opts.zIndex ??
      previousLayer?.options?.zIndex ??
      oldLayer?.options?.zIndex ??
      this.options.zIndex;
    if (zIndex !== null && zIndex !== undefined) layer.setZIndex(zIndex);

    this._bindLayer(layer, id);
    this._swapping = true;
    try {
      this.map.addLayer(layer);
      if (!this.options.multiple) {
        for (const [otherId, otherLayer] of [...this._layers]) {
          if (otherId !== id && this.map.hasLayer(otherLayer)) {
            this.map.removeLayer(otherLayer);
            this._layers.delete(otherId);
            this._unbindLayer(otherLayer);
          }
        }
      }
      if (oldLayer && oldLayer !== layer && this.map.hasLayer(oldLayer)) {
        this.map.removeLayer(oldLayer);
      }
    } catch (error) {
      this._swapping = false;
      this._reportError(id, error, { phase: 'add', layer });
      throw error;
    }
    this._swapping = false;

    this._layers.set(id, layer);
    this._activeId = id;
    this._variant = opts.variant && opts.variant !== 'default' ? opts.variant : this._variant;
    if (opts.retina !== undefined) this._retina = opts.retina;
    this._fallbackActive = Boolean(opts.fallback);
    this._persist();

    this.fire('basemapadded', { id, layer, provider: resolved.provider });
    this.fire('basemapchange', {
      id,
      layer,
      previousId,
      provider: resolved.provider,
      variant: resolved.variant,
      attribution: resolved.attribution,
    });
    return true;
  }

  /**
   * Добавляет подложку как дополнительную, не удаляя остальные.
   * @param {string} id
   * @param {object} [opts]
   * @returns {any}
   */
  add(id, opts = {}) {
    if (this._destroyed) throw new Error('BasemapsManager is destroyed');
    const resolved = resolveBasemap(id, opts, this._context());
    const layer = this._createLayer(resolved, opts);
    const old = this._layers.get(id);
    if (old && this.map.hasLayer(old)) {
      this._swapping = true;
      this.map.removeLayer(old);
      this._swapping = false;
      this._unbindLayer(old);
    }
    const zIndex = opts.zIndex ?? this.options.zIndex;
    if (zIndex !== null && zIndex !== undefined) layer.setZIndex(zIndex);
    this._bindLayer(layer, id);
    this.map.addLayer(layer);
    this._layers.set(id, layer);
    this.fire('basemapadded', { id, layer, provider: resolved.provider });
    if (!this._activeId) {
      this._activeId = id;
      this._persist();
      this.fire('basemapchange', { id, layer, previousId: null, provider: resolved.provider });
    }
    return layer;
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  remove(id) {
    const layer = this._layers.get(id);
    if (!layer) return false;
    this._swapping = true;
    if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    this._swapping = false;
    this._unbindLayer(layer);
    this._layers.delete(id);
    this._tileErrors.delete(id);
    this.fire('basemapremoved', { id, layer });
    if (this._activeId === id) {
      const previousId = this._activeId;
      this._activeId = null;
      this._persist();
      this.fire('basemapchange', { id: null, layer: null, previousId, provider: null });
    }
    return true;
  }

  /** @returns {string|null} */
  get() {
    return this._activeId;
  }

  /**
   * @param {string} [id] без id — активный слой
   * @returns {any|null}
   */
  getLayer(id) {
    if (id !== undefined) return this._layers.get(id) || null;
    return this._activeId ? this._layers.get(this._activeId) || null : null;
  }

  /**
   * @param {object|string|Function} [filter]
   * @returns {object[]}
   */
  list(filter) {
    return listProviders(filter).map((provider) => ({
      ...provider,
      active: provider.id === this._activeId,
      variants: Object.keys(provider.variants || {}),
      hasKey: this.hasKey(provider.id),
    }));
  }

  /**
   * @param {string} id
   * @param {object} [opts]
   * @returns {string}
   */
  resolveUrl(id, opts = {}) {
    return resolveUrl(id, opts, this._context());
  }

  /**
   * @param {string} id
   * @param {object} [opts]
   * @returns {string}
   */
  getAttribution(id, opts = {}) {
    return getAttribution(id, opts, this._context());
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  hasKey(id) {
    const provider = getProvider(id);
    if (!provider) return false;
    if (!provider.requiresKey) return true;
    return Boolean(resolveKey(provider, {}, this._context()));
  }

  /**
   * @param {'default'|'dark'|'light'|'satellite'|'hybrid'|'retina'|string} variant
   * @returns {this}
   */
  setVariant(variant) {
    if (!variant) return this;
    if (variant === 'retina') {
      this._retina = true;
    } else {
      this._variant = variant === 'default' ? null : variant;
      this._retina = this.options.retina;
    }
    if (this._activeId) {
      this.set(this._activeId, {
        variant: variant === 'retina' || variant === 'default' ? undefined : variant,
        retina: variant === 'retina' ? true : undefined,
        force: true,
      });
    }
    return this;
  }

  /** @returns {string} */
  getVariant() {
    return this._variant || 'default';
  }

  /**
   * @param {object} options
   * @returns {BasemapControl}
   */
  addControl(options = {}) {
    if (this.control) return this.control;
    this.control = new BasemapControl({
      ...this.options.controlOptions,
      ...options,
    });
    this.control.addTo(this.map);
    return this.control;
  }

  /* ----------------------------------------------------------------------- *
   * Внутренние методы
   * ----------------------------------------------------------------------- */

  /** @private */
  _context() {
    return {
      keys: this.options.keys,
      env: this.options.env,
      retina: this._retina,
      variant: this._variant,
      proxy: this.options.proxy,
    };
  }

  /** @private */
  _createLayer(resolved, opts) {
    return createLayerFromResolved(resolved, opts, this.options);
  }

  /* ----------------------------------------------------------------------- *
   * Провайдеры (делегирование реестру)
   * ----------------------------------------------------------------------- */

  /**
   * @param {object} definition
   * @param {{override?: boolean}} [options]
   * @returns {object}
   */
  registerProvider(definition, options) {
    return registerProvider(definition, options);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  unregisterProvider(id) {
    return unregisterProvider(id);
  }

  /**
   * @param {string|Function|object} [filter]
   * @returns {object[]}
   */
  getProviders(filter) {
    return listProviders(filter);
  }

  /** @private */
  _bindLayer(layer, id) {
    const onTileError = (event) => this._handleTileError(id, layer, event);
    const onLoad = () => {
      if (this._readyLayers.has(layer)) return;
      this._readyLayers.add(layer);
      this.fire('basemapready', { id, layer, provider: layer.getProvider?.() || null });
    };
    layer.on('tileerror', onTileError);
    layer.on('load', onLoad);
    this._layerHandlers.set(layer, { tileerror: onTileError, load: onLoad });
  }

  /** @private */
  _unbindLayer(layer) {
    const handlers = this._layerHandlers.get(layer);
    if (!handlers) return;
    layer.off('tileerror', handlers.tileerror);
    layer.off('load', handlers.load);
    this._layerHandlers.delete(layer);
  }

  /** @private */
  _handleTileError(id, layer, event) {
    if (this._destroyed || this._layers.get(id) !== layer) return;
    const count = (this._tileErrors.get(id) || 0) + 1;
    this._tileErrors.set(id, count);
    if (!this._errorNotified.has(layer)) {
      this._errorNotified.add(layer);
      this.fire('basemaperror', {
        id,
        layer,
        code: 'tileerror',
        message: `Tile failed to load for basemap "${id}"`,
        url: maskUrl(event?.url || ''),
        error: event?.error || null,
      });
    }
    if (
      !this._fallbackActive &&
      this.options.fallback &&
      this.options.fallback !== id &&
      count >= Number(this.options.maxTileErrors)
    ) {
      this._fallbackActive = true;
      try {
        this.set(this.options.fallback, { force: true, fallback: true });
      } catch {
        // basemaperror уже отправлен
      }
    }
  }

  /** @private */
  _handleLayerRemove(event) {
    if (this._swapping || this._destroyed) return;
    const layer = event.layer;
    let removedId = null;
    for (const [id, candidate] of this._layers) {
      if (candidate === layer) {
        removedId = id;
        break;
      }
    }
    if (!removedId) return;
    this._layers.delete(removedId);
    this._unbindLayer(layer);
    this._tileErrors.delete(removedId);
    this.fire('basemapremoved', { id: removedId, layer });
    if (this._activeId === removedId) {
      this._activeId = null;
      this._persist();
      this.fire('basemapchange', {
        id: null,
        layer: null,
        previousId: removedId,
        provider: null,
      });
    }
  }

  /** @private */
  _reportError(id, error, extra = {}) {
    this.fire('basemaperror', {
      id,
      code: error?.code || 'basemap-error',
      error,
      message: error?.message || String(error),
      provider: getProvider(id) || null,
      ...extra,
    });
  }

  /** @private */
  _readStorage() {
    if (!this.options.persist) return null;
    try {
      const storage = this.options.storage || globalThis.localStorage;
      if (!storage) return null;
      const value = storage.getItem(this.options.storageKey);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  /** @private */
  _persist() {
    if (!this.options.persist) return;
    try {
      const storage = this.options.storage || globalThis.localStorage;
      if (!storage) return;
      if (!this._activeId) {
        storage.removeItem(this.options.storageKey);
        return;
      }
      storage.setItem(
        this.options.storageKey,
        JSON.stringify({
          id: this._activeId,
          variant: this._variant,
          retina: this._retina,
        }),
      );
    } catch {
      // Storage может быть недоступен в приватном режиме/iframe.
    }
  }

  /** Полная очистка слоёв, подписок и UI. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.map.off('layerremove', this._onLayerRemove, this);
    this._swapping = true;
    for (const layer of [...this._layers.values()]) {
      this._unbindLayer(layer);
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    }
    this._swapping = false;
    this._layers.clear();
    this._layerHandlers.clear();
    this._tileErrors.clear();
    if (this.control) {
      this.map.removeControl(this.control);
      this.control = null;
    }
    if (this.map.basemaps === this) delete this.map.basemaps;
    this._activeId = null;
    this.fire('destroy');
  }
}
