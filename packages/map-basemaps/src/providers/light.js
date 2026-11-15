import { cyclOSM, openRailwayMap, openTopoMap, osm, wikimedia } from './osm.js';
import { cartoDark, cartoPositron, esriWorldImagery } from './carto-esri.js';

/** Минимальный набор для точки входа `sweety-map-basemaps/light`. */
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
  cartoDark,
  cartoPositron,
  cyclOSM,
  esriWorldImagery,
  openRailwayMap,
  openTopoMap,
  osm,
  wikimedia,
};

export const lightProviderMap = Object.fromEntries(
  lightProviders.map((provider) => [provider.id, provider]),
);
