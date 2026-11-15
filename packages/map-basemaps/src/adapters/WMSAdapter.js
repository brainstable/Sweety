import { TileSourceAdapter } from './TileSource.js';

const HALF_WORLD = Math.PI * 6378137;

/**
 * WMS 1.1.1/1.3.0 GetMap. По умолчанию работает в EPSG:3857, то есть в той же
 * проекции, что и ядро карты.
 */
export class WMSAdapter extends TileSourceAdapter {
  constructor() {
    super('wms');
  }

  buildUrl(provider, coords, context = {}) {
    const layers = provider.layers ?? context.adapterOptions?.layers;
    if (!layers) {
      throw new Error(`WMS provider "${provider.id}" requires a "layers" option`);
    }
    const tileSize = Number(provider.tileSize) || 256;
    const version = String(provider.version || '1.3.0');
    const crs = provider.crs || context.adapterOptions?.crs || 'EPSG:3857';
    const span = (HALF_WORLD * 2) / 2 ** coords.z;
    const minX = -HALF_WORLD + coords.x * span;
    const maxX = minX + span;
    const maxY = HALF_WORLD - coords.y * span;
    const minY = maxY - span;

    const params = {
      SERVICE: 'WMS',
      REQUEST: 'GetMap',
      VERSION: version,
      LAYERS: Array.isArray(layers) ? layers.join(',') : layers,
      STYLES: provider.styles || '',
      FORMAT: provider.format || 'image/png',
      TRANSPARENT: String(provider.transparent ?? true).toUpperCase(),
      WIDTH: String(tileSize),
      HEIGHT: String(tileSize),
      BBOX: [minX, minY, maxX, maxY].map((value) => value.toFixed(6)).join(','),
      [version.startsWith('1.3') ? 'CRS' : 'SRS']: crs,
      ...(provider.params || {}),
      ...(context.adapterOptions?.params || {}),
    };
    return appendQuery(context.url || provider.url, params);
  }
}

/**
 * @param {string} url
 * @param {Record<string, string|number|boolean>} params
 * @returns {string}
 */
export function appendQuery(url, params) {
  const separator = url.includes('?') ? '&' : '?';
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `${url}${separator}${query}` : url;
}
