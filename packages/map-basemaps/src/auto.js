import { Map as SweetyMap } from 'sweety-map';
import { BasemapsManager } from './manager.js';

/**
 * Подключает автоматическую обработку `new Map(..., { basemap: 'osm' })`.
 * Используется публичный hook ядра `Map.addInitHook`, сам hook ставится один раз.
 * @param {typeof SweetyMap} [MapClass]
 */
export function installMapHook(MapClass = SweetyMap) {
  if (!MapClass || MapClass.__sweetyBasemapsHookInstalled) return;
  MapClass.__sweetyBasemapsHookInstalled = true;
  MapClass.addInitHook(function mapBasemapHook(options) {
    if (!options || !options.basemap) return;
    const managerOptions = { ...(options.basemaps || {}) };
    if (typeof options.basemap === 'string') {
      managerOptions.default = options.basemap;
    } else if (typeof options.basemap === 'object') {
      Object.assign(managerOptions, options.basemap);
    }
    try {
      BasemapsManager.install(this, managerOptions);
    } catch (error) {
      this.fire('basemaperror', {
        id: managerOptions.default || null,
        code: error?.code || 'basemap-error',
        error,
        message: error?.message || String(error),
      });
    }
  });
}
