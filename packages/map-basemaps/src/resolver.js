import { requireProvider } from './registry.js';
import { BasemapError, BasemapKeyError, maskKey, maskUrl } from './errors.js';

/** @typedef {import('./registry.js').ProviderDef} ProviderDef */

const KEY_TOKENS = [
  '{key}',
  '{apikey}',
  '{apiKey}',
  '{api_key}',
  '{access_token}',
  '{access-token}',
  '{token}',
];

/**
 * Ключ из окружения. Работает и в Node, и в Vite (import.meta.env), но не
 * обращается к процессу на этапе импорта модуля.
 * @param {ProviderDef} provider
 * @param {Record<string, any>} [env]
 * @returns {string|null}
 */
function keyFromEnv(provider, env) {
  const source = env || (typeof process !== 'undefined' && process.env ? process.env : null);
  if (!source) return null;
  const id = provider.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const names = [provider.envKey, `SWEETY_BASEMAP_${id}_KEY`, `VITE_${id}_KEY`, `${id}_KEY`].filter(
    Boolean,
  );
  for (const name of names) {
    const value = source[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Приоритет: opts.key → keys[id] → keys.global → env.
 * @param {ProviderDef} provider
 * @param {{key?: string}} [opts]
 * @param {{keys?: Record<string, any>, env?: Record<string, any>}} [context]
 * @returns {string|null}
 */
export function resolveKey(provider, opts = {}, context = {}) {
  if (opts.key !== undefined && opts.key !== null && String(opts.key).trim()) {
    return String(opts.key).trim();
  }
  const keys = context.keys || {};
  if (keys[provider.id] && String(keys[provider.id]).trim()) {
    return String(keys[provider.id]).trim();
  }
  if (keys.global && String(keys.global).trim()) return String(keys.global).trim();
  return keyFromEnv(provider, context.env);
}

/**
 * @param {ProviderDef} provider
 * @param {string} name
 * @returns {{name: string, url: string, variantValue: string, attribution: string, extra: object}}
 */
function resolveVariant(provider, name) {
  const variantName = name || provider.defaultVariant || 'default';
  const definition = provider.variants?.[variantName];
  if (definition === undefined && variantName !== 'default') {
    throw new BasemapError(
      `Unknown variant "${variantName}" for basemap "${provider.id}". ` +
        `Available: ${Object.keys(provider.variants || {}).join(', ') || 'none'}.`,
      { code: 'unknown-variant', providerId: provider.id },
    );
  }

  let url = provider.url;
  let variantValue = variantName;
  let attribution = provider.attribution;
  let extra = {};

  if (typeof definition === 'string') {
    if (/^https?:\/\//i.test(definition) || definition.startsWith('/')) {
      url = definition;
    } else {
      variantValue = definition;
    }
  } else if (definition && typeof definition === 'object') {
    if (typeof definition.url === 'string') url = definition.url;
    variantValue = definition.variant || definition.value || variantName;
    attribution = definition.attribution ?? attribution;
    extra = definition;
  }

  return { name: variantName, url, variantValue, attribution, extra };
}

/**
 * @param {string} url
 * @param {string|null} key
 * @param {string|null} [keyParam]
 * @returns {string}
 */
function applyKey(url, key, keyParam) {
  if (!key) return url;
  let result = url;
  let replaced = false;
  for (const token of KEY_TOKENS) {
    if (result.includes(token)) {
      result = result.split(token).join(encodeURIComponent(key));
      replaced = true;
    }
  }
  if (!replaced && keyParam) {
    const separator = result.includes('?') ? '&' : '?';
    result += `${separator}${encodeURIComponent(keyParam)}=${encodeURIComponent(key)}`;
  }
  return result;
}

/**
 * @param {string} url
 * @param {string|((url: string) => string)|null|undefined} proxy
 * @returns {string}
 */
function applyProxy(url, proxy) {
  if (!proxy) return url;
  if (typeof proxy === 'function') return proxy(url);
  if (typeof proxy === 'string') {
    return proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(url)) : proxy + url;
  }
  return url;
}

/**
 * @returns {boolean}
 */
export function isRetinaDisplay() {
  return typeof window !== 'undefined' && Number(window.devicePixelRatio) > 1;
}

/**
 * @param {string} template
 * @param {{x:number,y:number,z:number}} coords
 * @param {string[]} subdomains
 * @returns {string}
 */
function applyCoords(template, coords, subdomains) {
  const list = subdomains && subdomains.length ? subdomains : ['a'];
  const subdomain = list[Math.abs((coords.x * 7 + coords.y * 13 + coords.z * 31) % list.length)];
  const max = 2 ** coords.z;
  return template
    .replace(/\{s\}/g, subdomain)
    .replace(/\{z\}/g, String(coords.z))
    .replace(/\{x\}/g, String(coords.x))
    .replace(/\{y\}/g, String(coords.y))
    .replace(/\{-y\}/g, String(max - 1 - coords.y));
}

/**
 * Собирает разрешённый дескриптор подложки: URL, вариант, ключ, retina,
 * атрибуция и параметры слоя.
 *
 * @param {string} id
 * @param {object} [opts]
 * @param {string} [opts.key]
 * @param {string} [opts.variant]
 * @param {boolean} [opts.retina]
 * @param {string} [opts.subdomain]
 * @param {boolean|string} [opts.attribution]
 * @param {string} [opts.urlTemplate]
 * @param {string|Function} [opts.proxy]
 * @param {{x:number,y:number,z:number}} [opts.coords]
 * @param {{keys?: Record<string, any>, env?: Record<string, any>, retina?: boolean|'auto', variant?: string, proxy?: string|Function}} [context]
 * @returns {object}
 */
export function resolveBasemap(id, opts = {}, context = {}) {
  const provider = requireProvider(id);
  const requestedVariant = opts.variant || context.variant || provider.defaultVariant || 'default';
  const isRetinaVariant = requestedVariant === 'retina';
  const variantName = isRetinaVariant ? provider.defaultVariant || 'default' : requestedVariant;
  const variant = resolveVariant(provider, variantName);

  let url = opts.urlTemplate || variant.url || provider.url;
  if (typeof url !== 'string' || !url) {
    throw new BasemapError(`Provider "${provider.id}" has no URL template`, {
      code: 'invalid-url',
      providerId: provider.id,
    });
  }

  const key = resolveKey(provider, opts, context);
  if (provider.requiresKey && !key) {
    throw new BasemapKeyError(provider.id, {
      termsUrl: provider.termsUrl,
      keyParam: provider.keyParam,
    });
  }

  const autoRetina =
    opts.retina !== undefined
      ? Boolean(opts.retina)
      : isRetinaVariant
        ? true
        : context.retina !== undefined && context.retina !== 'auto'
          ? Boolean(context.retina)
          : Boolean(provider.retina && isRetinaDisplay());

  url = url.replace(/\{variant\}/g, variant.variantValue);
  url = url.replace(/\{r\}/g, autoRetina ? '@2x' : '');
  url = applyKey(url, key, provider.keyParam);

  if (opts.subdomain) url = url.replace(/\{s\}/g, String(opts.subdomain));
  if (opts.coords) url = applyCoords(url, opts.coords, provider.subdomains);

  const proxy = opts.proxy ?? context.proxy;
  url = applyProxy(url, proxy);

  const attribution =
    opts.attribution === false
      ? ''
      : opts.attribution === true || opts.attribution === undefined
        ? (variant.extra.attribution ?? variant.attribution ?? provider.attribution ?? '')
        : String(opts.attribution);

  return {
    id: provider.id,
    provider,
    url,
    maskedUrl: maskUrl(url, key),
    keyMasked: maskKey(key),
    variant: variant.name,
    variantValue: variant.variantValue,
    attribution,
    retina: autoRetina,
    tileSize: Number(variant.extra.tileSize ?? provider.tileSize) || 256,
    minZoom: Number(variant.extra.minZoom ?? provider.minZoom) || 0,
    maxZoom: Number(variant.extra.maxZoom ?? provider.maxZoom) || Number(provider.maxZoom) || 19,
    maxNativeZoom: variant.extra.maxNativeZoom ?? provider.maxNativeZoom ?? null,
    minNativeZoom: variant.extra.minNativeZoom ?? provider.minNativeZoom ?? null,
    subdomains: variant.extra.subdomains ?? provider.subdomains,
    type: variant.extra.type ?? provider.type ?? 'xyz',
    category: variant.extra.category ?? provider.category,
    termsUrl: provider.termsUrl || '',
    license: provider.license || '',
    projections: provider.projections || ['EPSG:3857'],
    adapterOptions: { ...(provider.adapterOptions || {}), ...(variant.extra.adapterOptions || {}) },
    variantExtra: variant.extra,
  };
}

/**
 * @param {string} id
 * @param {object} [opts]
 * @param {object} [context]
 * @returns {string}
 */
export function resolveUrl(id, opts, context) {
  return resolveBasemap(id, opts, context).url;
}

/**
 * @param {string} id
 * @param {object} [opts]
 * @param {object} [context]
 * @returns {string}
 */
export function getAttribution(id, opts = {}, context = {}) {
  const provider = requireProvider(id);
  if (opts.attribution !== undefined) {
    return opts.attribution === false ? '' : String(opts.attribution);
  }
  const name = opts.variant || context.variant || provider.defaultVariant || 'default';
  const variant = provider.variants?.[name];
  if (variant && typeof variant === 'object' && variant.attribution) {
    return String(variant.attribution);
  }
  return provider.attribution || '';
}
