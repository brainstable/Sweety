/** Бесплатные и условно-бесплатные подложки Carto, Esri, Stamen. */

export const cartoPositron = {
  id: 'carto-positron',
  name: 'Carto Positron',
  category: 'streets',
  url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  subdomains: ['a', 'b', 'c', 'd'],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  retina: true,
  attribution: '© OpenStreetMap contributors © CARTO',
  termsUrl: 'https://carto.com/attributions',
  license: 'ODbL 1.0 / CARTO terms',
  requiresKey: false,
};

export const cartoDark = {
  id: 'carto-dark',
  name: 'Carto Dark Matter',
  category: 'dark',
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  subdomains: ['a', 'b', 'c', 'd'],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  retina: true,
  attribution: '© OpenStreetMap contributors © CARTO',
  termsUrl: 'https://carto.com/attributions',
  license: 'ODbL 1.0 / CARTO terms',
  requiresKey: false,
};

export const cartoVoyager = {
  id: 'carto-voyager',
  name: 'Carto Voyager',
  category: 'streets',
  url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  subdomains: ['a', 'b', 'c', 'd'],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  retina: true,
  attribution: '© OpenStreetMap contributors © CARTO',
  termsUrl: 'https://carto.com/attributions',
  license: 'ODbL 1.0 / CARTO terms',
  requiresKey: false,
};

export const esriWorldImagery = {
  id: 'esri-world-imagery',
  name: 'Esri World Imagery',
  category: 'satellite',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  subdomains: [],
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
  termsUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
  license: 'Esri Master Agreement',
  requiresKey: false,
};

export const esriWorldTopo = {
  id: 'esri-world-topo',
  name: 'Esri World Topographic',
  category: 'terrain',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  subdomains: [],
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  attribution: 'Tiles © Esri',
  termsUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
  license: 'Esri Master Agreement',
  requiresKey: false,
};

export const esriLightGray = {
  id: 'esri-light-gray',
  name: 'Esri Light Gray Canvas',
  category: 'streets',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  subdomains: [],
  minZoom: 0,
  maxZoom: 16,
  tileSize: 256,
  attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors',
  termsUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
  license: 'Esri Master Agreement',
  requiresKey: false,
};

export const esriDarkGray = {
  id: 'esri-dark-gray',
  name: 'Esri Dark Gray Canvas',
  category: 'dark',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  subdomains: [],
  minZoom: 0,
  maxZoom: 16,
  tileSize: 256,
  attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors',
  termsUrl: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
  license: 'Esri Master Agreement',
  requiresKey: false,
};

export const stamenToner = {
  id: 'stamen-toner',
  name: 'Stamen Toner',
  category: 'dark',
  url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
  subdomains: [],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  retina: true,
  attribution: '© Stadia Maps © Stamen Design © OpenMapTiles © OpenStreetMap contributors',
  termsUrl: 'https://stadiamaps.com/terms-of-service/',
  license: 'CC-BY 4.0',
  requiresKey: false,
  notes: 'Stadia Maps may require an API key in production.',
};
