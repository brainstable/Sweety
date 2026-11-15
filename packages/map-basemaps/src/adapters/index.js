import { BasemapError } from '../errors.js';
import { BingAdapter } from './BingAdapter.js';
import { GoogleAdapter } from './GoogleAdapter.js';
import { TileSourceAdapter } from './TileSource.js';
import { WMSAdapter } from './WMSAdapter.js';
import { WMTSAdapter } from './WMTSAdapter.js';
import { XYZAdapter } from './XYZAdapter.js';
import { YandexAdapter } from './YandexAdapter.js';

/** @type {Map<string, TileSourceAdapter>} */
const adapters = new globalThis.Map();

/**
 * @param {string} type
 * @param {TileSourceAdapter} adapter
 * @returns {TileSourceAdapter}
 */
export function registerTileSource(type, adapter) {
  if (!type || typeof type !== 'string') throw new TypeError('Adapter type must be a string');
  if (!adapter || typeof adapter.buildUrl !== 'function') {
    throw new TypeError(`Adapter "${type}" must implement buildUrl()`);
  }
  adapters.set(type, adapter);
  return adapter;
}

/**
 * @param {string} [type='xyz']
 * @returns {TileSourceAdapter}
 */
export function getTileSource(type = 'xyz') {
  const adapter = adapters.get(type);
  if (!adapter) {
    throw new BasemapError(`Unknown tile source type: "${String(type)}"`, {
      code: 'unknown-source-type',
    });
  }
  return adapter;
}

/** @returns {boolean} */
export function hasTileSource(type) {
  return adapters.has(type);
}

/** @returns {string[]} */
export function listTileSources() {
  return [...adapters.keys()];
}

/** @returns {TileSourceAdapter} */
export function unregisterTileSource(type) {
  const adapter = adapters.get(type);
  adapters.delete(type);
  return adapter;
}

// Встроенные стратегии. Регистрируются при импорте адаптеров.
registerTileSource('xyz', new XYZAdapter('xyz'));
registerTileSource('xyz-json', new XYZAdapter('xyz-json'));
registerTileSource('google', new GoogleAdapter());
registerTileSource('yandex', new YandexAdapter());
registerTileSource('bing', new BingAdapter());
registerTileSource('wms', new WMSAdapter());
registerTileSource('wmts', new WMTSAdapter());

export {
  BingAdapter,
  GoogleAdapter,
  TileSourceAdapter,
  WMSAdapter,
  WMTSAdapter,
  XYZAdapter,
  YandexAdapter,
};
