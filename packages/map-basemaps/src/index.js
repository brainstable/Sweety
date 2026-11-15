import './styles/map-basemaps.css';

import { installMapHook } from './auto.js';
import { basemaps } from './api.js';
import { registerProviders } from './registry.js';
import { fullProviders } from './providers/index.js';

// Полный каталог регистрируется только при импорте основной точки входа.
registerProviders(fullProviders);
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
export { fullProviders, lightProviders } from './providers/index.js';
export {
  osm,
  osmHot,
  openTopoMap,
  cyclOSM,
  openRailwayMap,
  wikimedia,
  cartoPositron,
  cartoDark,
  cartoVoyager,
  esriWorldImagery,
  esriWorldTopo,
  esriLightGray,
  esriDarkGray,
  stamenToner,
  mapbox,
  maptiler,
  thunderforest,
  here,
  stadia,
  jawg,
  google,
  yandex,
  bing,
  usgsImagery,
} from './providers/index.js';

export default basemaps;
