import './styles/map-basemaps.css';

import { installMapHook } from './auto.js';
import { basemaps } from './api.js';
import { registerProviders } from './registry.js';
import { lightProviders } from './providers/light.js';

registerProviders(lightProviders);
installMapHook();

export { basemaps } from './api.js';
export { BasemapsManager, installBasemaps, createBasemapsManager } from './api.js';
export { BasemapControl } from './control/BasemapControl.js';
export { BasemapTileLayer, createBasemap, createLayerFromResolved } from './layer.js';
export {
  registerProvider,
  registerProviders,
  unregisterProvider,
  getProvider,
  requireProvider,
  listProviders,
  listCategories,
  clearProviders,
  providerCount,
  CATEGORIES,
} from './registry.js';
export {
  resolveBasemap,
  resolveUrl,
  resolveKey,
  getAttribution,
  isRetinaDisplay,
} from './resolver.js';
export { BasemapError, BasemapKeyError, maskKey, maskUrl } from './errors.js';
export {
  registerTileSource,
  unregisterTileSource,
  getTileSource,
  hasTileSource,
  listTileSources,
  TileSourceAdapter,
  XYZAdapter,
  WMSAdapter,
  WMTSAdapter,
  GoogleAdapter,
  YandexAdapter,
  BingAdapter,
} from './adapters/index.js';
export { lightProviders } from './providers/light.js';
export {
  osm,
  openTopoMap,
  cyclOSM,
  openRailwayMap,
  wikimedia,
  cartoPositron,
  cartoDark,
  esriWorldImagery,
} from './providers/light.js';

export default basemaps;
