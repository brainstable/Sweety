import Sweety from '../src/index.js';

const {
  Bounds,
  Circle,
  Control,
  GeoJSONLayer,
  LayersControl,
  Map,
  Marker,
  Polygon,
  Polyline,
  ScaleControl,
  TileLayer,
} = Sweety;

const MOSCOW = [55.7522, 37.6156];
const INITIAL_VIEW = { center: MOSCOW, zoom: 11 };
const KREMLIN_BOUNDS = new Bounds([55.7448, 37.601], [55.759, 37.632]);

const map = new Map('map', INITIAL_VIEW);

const osm = new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; участники OpenStreetMap',
  maxZoom: 19,
}).addTo(map);

const topo = new TileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenTopoMap (CC-BY-SA)',
  maxZoom: 17,
  subdomains: 'abc',
});

const objects = new Sweety.FeatureGroup();

const kremlin = new Polygon(
  [
    [55.7522, 37.6175],
    [55.7528, 37.6231],
    [55.7505, 37.6243],
    [55.7483, 37.6218],
    [55.7481, 37.6168],
    [55.7501, 37.6152],
  ],
  {
    color: '#b45309',
    weight: 3,
    fillColor: '#f59e0b',
    fillOpacity: 0.28,
  },
)
  .bindPopup('<strong>Московский Кремль</strong><br>Демонстрационный полигон.')
  .bindTooltip('Кремль', { direction: 'top' });

const gardenRing = new Circle([55.743, 37.615], 900, {
  color: '#0f766e',
  weight: 2,
  dashArray: '6 4',
  fillColor: '#14b8a6',
  fillOpacity: 0.12,
}).bindPopup('Круг радиусом 900 метров');

const embankment = new Polyline(
  [
    [55.747, 37.608],
    [55.7458, 37.615],
    [55.7463, 37.622],
    [55.749, 37.627],
  ],
  {
    color: '#2563eb',
    weight: 4,
    dashArray: '10 6',
  },
).bindTooltip('Набережная', { direction: 'right' });

const marker = new Marker([55.7522, 37.6156], {
  draggable: true,
  title: 'Москва',
  alt: 'Маркер Москвы',
})
  .addTo(map)
  .bindPopup(
    '<strong>Москва</strong><br>Перетащите маркер — попап следует за ним.<br><small>55.7522, 37.6156</small>',
  )
  .bindTooltip('Перетащите меня', { permanent: true, direction: 'top' });

objects.addLayer(kremlin).addLayer(gardenRing).addLayer(embankment);
objects.addTo(map);

const parks = new GeoJSONLayer(
  {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Парк Горького' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [37.598, 55.729],
              [37.61, 55.729],
              [37.61, 55.735],
              [37.598, 55.735],
              [37.598, 55.729],
            ],
          ],
        },
      },
    ],
  },
  {
    style: { color: '#15803d', weight: 2, fillColor: '#22c55e', fillOpacity: 0.22 },
    onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.name),
  },
).addTo(map);

new LayersControl(
  { OpenStreetMap: osm, OpenTopoMap: topo },
  { Объекты: objects, 'Парк Горького': parks },
).addTo(map);

new ScaleControl({ position: 'bottomleft' }).addTo(map);

class ResetViewControl extends Control {
  constructor() {
    super({ position: 'topright' });
  }

  onAdd() {
    this._container = this._initLayout('demo-control');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Сбросить вид';
    button.addEventListener('click', () => map.setView(INITIAL_VIEW.center, INITIAL_VIEW.zoom));
    this._container.appendChild(button);
    return this._container;
  }
}

new ResetViewControl().addTo(map);

const centerOutput = document.getElementById('stat-center');
const zoomOutput = document.getElementById('stat-zoom');
const cursorOutput = document.getElementById('stat-cursor');
const layersOutput = document.getElementById('stat-layers');
const canvasButtons = [document.getElementById('add-canvas'), document.getElementById('clear-canvas')];
let canvasLayers = [];

function formatLatLng(latlng) {
  return `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
}

function updateStats() {
  centerOutput.textContent = formatLatLng(map.getCenter());
  zoomOutput.textContent = String(map.getZoom());
  layersOutput.textContent = String(map.getLayers().length);
}

function updateView() {
  updateStats();
}

map.on('moveend zoomend resize layeradd layerremove', updateView);
map.on('mousemove', (event) => {
  cursorOutput.textContent = formatLatLng(event.latlng);
});

map.on('click', (event) => {
  cursorOutput.textContent = formatLatLng(event.latlng);
});

document.getElementById('fit-kremlin').addEventListener('click', () => {
  map.fitBounds(KREMLIN_BOUNDS, { padding: [40, 40], animate: true });
});

document.getElementById('reset-view').addEventListener('click', () => {
  map.flyTo(INITIAL_VIEW.center, INITIAL_VIEW.zoom, { duration: 700 });
});

document.getElementById('add-canvas').addEventListener('click', () => {
  if (canvasLayers.length) return;
  map.options.preferCanvas = true;
  const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'];
  for (let i = 0; i < 400; i += 1) {
    const angle = (i / 400) * Math.PI * 2;
    const ring = 0.008 + (i % 12) * 0.0016;
    const lat = MOSCOW[0] + Math.sin(angle) * ring;
    const lng = MOSCOW[1] + Math.cos(angle) * ring * 1.7;
    const circle = new Circle([lat, lng], 35 + (i % 7) * 12, {
      renderer: map._canvasRenderer || undefined,
      color: palette[i % palette.length],
      weight: 1,
      fillColor: palette[i % palette.length],
      fillOpacity: 0.45,
      interactive: false,
    });
    circle.addTo(map);
    canvasLayers.push(circle);
  }
  canvasButtons[0].textContent = '400 добавлено';
  canvasButtons[0].disabled = true;
  updateStats();
});

document.getElementById('clear-canvas').addEventListener('click', () => {
  for (const layer of canvasLayers) layer.remove();
  canvasLayers = [];
  canvasButtons[0].textContent = 'Добавить 400';
  canvasButtons[0].disabled = false;
  updateStats();
});

updateStats();
