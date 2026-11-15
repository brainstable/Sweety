import { TileSourceAdapter } from './TileSource.js';

/**
 * Yandex tiles. Внимание: сетка использует EPSG:3395; адаптер собирает URL, но
 * корректная геопривязка требует CRS EPSG:3395 на карте.
 */
export class YandexAdapter extends TileSourceAdapter {
  constructor() {
    super('yandex');
  }

  buildUrl(provider, coords, context = {}) {
    const layer = context.variantValue || 'map';
    const lang = context.adapterOptions?.lang || provider.adapterOptions?.lang || 'ru_RU';
    return (
      `https://core-renderer-tiles.maps.yandex.net/tiles?l=${encodeURIComponent(layer)}` +
      `&x=${coords.x}&y=${coords.y}&z=${coords.z}&scale=1&lang=${encodeURIComponent(lang)}`
    );
  }
}
