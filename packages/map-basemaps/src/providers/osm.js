/** OpenStreetMap и гуманитарный слой HOT. */

export const osm = {
  id: 'osm',
  name: 'OpenStreetMap',
  category: 'streets',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  subdomains: ['a', 'b', 'c'],
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  attribution: '© OpenStreetMap contributors',
  termsUrl: 'https://www.openstreetmap.org/copyright',
  license: 'ODbL 1.0',
  requiresKey: false,
  keyParam: null,
};

export const osmHot = {
  id: 'osm-hot',
  name: 'OSM Humanitarian',
  category: 'humanitarian',
  url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  subdomains: ['a', 'b', 'c'],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  attribution: '© OpenStreetMap contributors, Tiles: HOT',
  termsUrl: 'https://www.hotosm.org/',
  license: 'ODbL 1.0',
  requiresKey: false,
};

export const openTopoMap = {
  id: 'opentopomap',
  name: 'OpenTopoMap',
  category: 'terrain',
  url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  subdomains: ['a', 'b', 'c'],
  minZoom: 0,
  maxZoom: 17,
  tileSize: 256,
  attribution: 'Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap (CC-BY-SA)',
  termsUrl: 'https://opentopomap.org/about',
  license: 'CC-BY-SA 3.0',
  requiresKey: false,
};

export const cyclOSM = {
  id: 'cyclosm',
  name: 'CyclOSM',
  category: 'transport',
  url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
  subdomains: ['a', 'b', 'c'],
  minZoom: 0,
  maxZoom: 20,
  tileSize: 256,
  attribution: '© OpenStreetMap contributors | CyclOSM',
  termsUrl: 'https://github.com/cyclosm/cyclosm-cartocss-style',
  license: 'ODbL 1.0',
  requiresKey: false,
};

export const openRailwayMap = {
  id: 'openrailwaymap',
  name: 'OpenRailwayMap',
  category: 'transport',
  url: 'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
  subdomains: ['a', 'b', 'c'],
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  attribution: '© OpenStreetMap contributors | OpenRailwayMap',
  termsUrl: 'https://www.openrailwaymap.org/',
  license: 'ODbL 1.0',
  requiresKey: false,
};

export const wikimedia = {
  id: 'wikimedia',
  name: 'Wikimedia Maps',
  category: 'streets',
  url: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png',
  subdomains: [],
  minZoom: 0,
  maxZoom: 19,
  tileSize: 256,
  retina: true,
  attribution: '© OpenStreetMap contributors | Wikimedia',
  termsUrl: 'https://foundation.wikimedia.org/wiki/Policy:Maps_Terms_of_Use',
  license: 'CC-BY-SA 4.0',
  requiresKey: false,
};
