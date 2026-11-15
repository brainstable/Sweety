import { BasemapError } from './errors.js';

/** Глобальный реестр дескрипторов подложек. */
const registry = new globalThis.Map();

export const CATEGORIES = [
  'streets',
  'satellite',
  'terrain',
  'dark',
  'transport',
  'humanitarian',
  'custom',
];

/**
 * @typedef {object} ProviderDef
 * @property {string} id
 * @property {string} name
 * @property {string} [url]
 * @property {string[]|string} [subdomains]
 * @property {number} [minZoom]
 * @property {number} [maxZoom]
 * @property {number} [maxNativeZoom]
 * @property {number} [tileSize]
 * @property {string} [attribution]
 * @property {string} [termsUrl]
 * @property {string} [license]
 * @property {boolean} [requiresKey]
 * @property {string|null} [keyParam]
 * @property {string} [category]
 * @property {'xyz'|'xyz-json'|'wms'|'wmts'|'google'|'yandex'|'bing'|string} [type]
 * @property {Record<string, string|object>} [variants]
 * @property {string} [defaultVariant]
 * @property {string[]} [projections]
 * @property {string} [preview]
 * @property {string} [notes]
 * @property {boolean} [retina]
 * @property {string} [envKey]
 * @property {object} [adapterOptions]
 */

/**
 * Нормализует и проверяет дескриптор провайдера.
 * @param {ProviderDef} definition
 * @returns {ProviderDef}
 */
function normalize(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('registerProvider expects a provider descriptor');
  }
  if (typeof definition.id !== 'string' || !definition.id.trim()) {
    throw new TypeError('Provider descriptor requires a non-empty string id');
  }
  if (typeof definition.name !== 'string' || !definition.name.trim()) {
    throw new TypeError(`Provider "${definition.id}" requires a non-empty name`);
  }
  if (typeof definition.url !== 'string' || !definition.url) {
    throw new TypeError(`Provider "${definition.id}" requires a url`);
  }

  const subdomains =
    definition.subdomains === undefined
      ? ['a', 'b', 'c']
      : Array.isArray(definition.subdomains)
        ? definition.subdomains.map(String)
        : String(definition.subdomains).split('');

  const variants = definition.variants || {};
  const defaultVariant =
    definition.defaultVariant ||
    (variants.default !== undefined ? 'default' : Object.keys(variants)[0]) ||
    'default';

  return {
    type: 'xyz',
    category: 'custom',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    attribution: '',
    termsUrl: '',
    license: '',
    requiresKey: false,
    keyParam: null,
    projections: ['EPSG:3857'],
    retina: false,
    ...definition,
    subdomains,
    variants,
    defaultVariant,
  };
}

/**
 * Регистрирует провайдера. По умолчанию переопределяет существующий id —
 * это позволяет приложению заменить встроенный URL/ключ.
 * @param {ProviderDef} definition
 * @param {{override?: boolean}} [options]
 * @returns {ProviderDef}
 */
export function registerProvider(definition, { override = true } = {}) {
  const provider = normalize(definition);
  if (!override && registry.has(provider.id)) return registry.get(provider.id);
  registry.set(provider.id, provider);
  return provider;
}

/**
 * @param {ProviderDef[]} definitions
 * @param {{override?: boolean}} [options]
 * @returns {ProviderDef[]}
 */
export function registerProviders(definitions, options = {}) {
  return definitions.map((definition) => registerProvider(definition, options));
}

/**
 * @param {string} id
 * @returns {boolean}
 */
export function unregisterProvider(id) {
  return registry.delete(id);
}

/**
 * @param {string} id
 * @returns {ProviderDef|undefined}
 */
export function getProvider(id) {
  return registry.get(id);
}

/**
 * @param {string} id
 * @returns {ProviderDef}
 */
export function requireProvider(id) {
  const provider = registry.get(id);
  if (!provider) {
    throw new BasemapError(`Unknown basemap provider: "${String(id)}"`, {
      code: 'unknown-provider',
      providerId: String(id),
    });
  }
  return provider;
}

/**
 * @param {string|Function|{category?: string, requiresKey?: boolean, type?: string, search?: string, ids?: string[]}} [filter]
 * @returns {ProviderDef[]}
 */
export function listProviders(filter) {
  let providers = [...registry.values()];
  if (!filter) return providers;

  if (typeof filter === 'string') {
    if (filter === 'all' || filter === '*') return providers;
    providers = providers.filter(
      (provider) =>
        provider.category === filter ||
        provider.id === filter ||
        provider.name.toLowerCase().includes(filter.toLowerCase()),
    );
  } else if (typeof filter === 'function') {
    providers = providers.filter(filter);
  } else if (typeof filter === 'object') {
    if (filter.ids) {
      const ids = new Set(filter.ids);
      providers = providers.filter((provider) => ids.has(provider.id));
    }
    if (filter.category) {
      providers = providers.filter((provider) => provider.category === filter.category);
    }
    if (filter.type) providers = providers.filter((provider) => provider.type === filter.type);
    if (filter.requiresKey !== undefined) {
      providers = providers.filter(
        (provider) => Boolean(provider.requiresKey) === Boolean(filter.requiresKey),
      );
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      providers = providers.filter(
        (provider) =>
          provider.id.toLowerCase().includes(search) ||
          provider.name.toLowerCase().includes(search) ||
          provider.category.toLowerCase().includes(search),
      );
    }
  }
  return providers;
}

/** @returns {string[]} */
export function listCategories() {
  return [...new Set([...CATEGORIES, ...listProviders().map((provider) => provider.category)])];
}

/** Удаляет все провайдеры. Полезно в тестах и для сборок «только свой». */
export function clearProviders() {
  registry.clear();
}

/** @returns {number} */
export function providerCount() {
  return registry.size;
}
