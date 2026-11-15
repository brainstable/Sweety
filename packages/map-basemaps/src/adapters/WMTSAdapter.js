import { TileSourceAdapter } from './TileSource.js';
import { appendQuery } from './WMSAdapter.js';

/**
 * WMTS KVP GetTile. Поддерживает префикс TileMatrix и произвольные параметры
 * провайдера; RESTful-шаблоны можно задать через `{TileMatrix}` в URL.
 */
export class WMTSAdapter extends TileSourceAdapter {
  constructor() {
    super('wmts');
  }

  buildUrl(provider, coords, context = {}) {
    const template = context.url || provider.url;
    const layer = provider.layer || provider.layers;
    if (!layer) {
      throw new Error(`WMTS provider "${provider.id}" requires a "layer" option`);
    }
    const tileMatrix = `${provider.tileMatrixPrefix || ''}${coords.z}`;

    if (/\{Tile(Matrix|Row|Col)\}/.test(template)) {
      return template
        .replace(/\{TileMatrix\}/g, encodeURIComponent(tileMatrix))
        .replace(/\{TileRow\}/g, String(coords.y))
        .replace(/\{TileCol\}/g, String(coords.x));
    }

    const params = {
      SERVICE: 'WMTS',
      REQUEST: 'GetTile',
      VERSION: provider.version || '1.0.0',
      LAYER: Array.isArray(layer) ? layer[0] : layer,
      STYLE: provider.style || 'default',
      TILEMATRIXSET: provider.tileMatrixSet || '',
      TILEMATRIX: tileMatrix,
      TILEROW: String(coords.y),
      TILECOL: String(coords.x),
      FORMAT: provider.format || 'image/png',
      ...(provider.params || {}),
      ...(context.adapterOptions?.params || {}),
    };
    return appendQuery(template, params);
  }
}
