import { BasemapControl } from './control/BasemapControl.js';
import { createBasemap } from './layer.js';
import { BasemapsManager } from './manager.js';
export { BasemapsManager } from './manager.js';
import {
  clearProviders,
  getProvider,
  listCategories,
  listProviders,
  registerProvider,
  registerProviders,
  unregisterProvider,
} from './registry.js';

/**
 * Публичный singleton-фасад. Сценарий A:
 *
 * ```js
 * basemaps.install(map).set('osm');
 * ```
 */
export const basemaps = {
  /**
   * @param {any} map
   * @param {object} [options]
   * @returns {BasemapsManager}
   */
  install(map, options = {}) {
    return BasemapsManager.install(map, options);
  },

  /** @param {any} map */
  get(map) {
    return map?.basemaps || null;
  },

  /**
   * @param {string} id
   * @param {object} [opts]
   * @param {object} [managerOptions]
   */
  create(id, opts, managerOptions) {
    return createBasemap(id, opts, managerOptions);
  },

  /**
   * @param {object} [options]
   * @returns {BasemapControl}
   */
  createControl(options = {}) {
    return new BasemapControl(options);
  },

  registerProvider,
  registerProviders,
  unregisterProvider,
  getProvider,
  listProviders,
  listCategories,
  clearProviders,
};

/** @returns {BasemapsManager} */
export function installBasemaps(map, options) {
  return BasemapsManager.install(map, options);
}

/** @returns {BasemapsManager} */
export function createBasemapsManager(map, options) {
  return new BasemapsManager(map, options);
}
