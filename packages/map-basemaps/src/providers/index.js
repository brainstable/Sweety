import { cyclOSM, openRailwayMap, openTopoMap, osm, osmHot, wikimedia } from './osm.js';
import {
  cartoDark,
  cartoPositron,
  cartoVoyager,
  esriDarkGray,
  esriLightGray,
  esriWorldImagery,
  esriWorldTopo,
  stamenToner,
} from './carto-esri.js';
import { here, jawg, mapbox, maptiler, stadia, thunderforest } from './keyed.js';
import { bing, google, usgsImagery, yandex } from './engines.js';

/** Полный каталог: используется точкой входа `sweety-map-basemaps`. */
export const fullProviders = [
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
];

/** Минимальный набор: точка входа `sweety-map-basemaps/light`. */
export const lightProviders = [
  osm,
  openTopoMap,
  cyclOSM,
  openRailwayMap,
  wikimedia,
  cartoPositron,
  cartoDark,
  esriWorldImagery,
];

export {
  bing,
  cartoDark,
  cartoPositron,
  cartoVoyager,
  cyclOSM,
  esriDarkGray,
  esriLightGray,
  esriWorldImagery,
  esriWorldTopo,
  google,
  here,
  jawg,
  mapbox,
  maptiler,
  openRailwayMap,
  openTopoMap,
  osm,
  osmHot,
  stadia,
  stamenToner,
  thunderforest,
  usgsImagery,
  wikimedia,
  yandex,
};
