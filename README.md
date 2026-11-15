# Sweety

**Sweety** is a dependency-free, modular JavaScript library for interactive maps.
It provides a Leaflet-style API, GPU-friendly tile rendering, SVG and Canvas vector
renderers, GeoJSON support, controls, and a small plugin system.

> Status: initial scaffold. The public API is documented below as modules land.

## Highlights

- No runtime dependencies — plain ES modules and a UMD bundle.
- `Map`, `TileLayer`, `Marker`, `Popup`, `Tooltip`, `GeoJSONLayer`, and vector layers.
- Web Mercator (EPSG:3857) and geographic (EPSG:4326) projections.
- Mouse, touch, pinch, wheel, double-click, inertia, and animated navigation.
- Extensible controls, panes, layers, and plugins.
- Vitest unit and jsdom integration tests.
- Vite build, GitHub Actions CI, Conventional Commits, and release automation.

## Quick start

```bash
npm install
npm test
npm run build
npm run dev   # demo at http://localhost:5173/examples/
```

```js
import { Map, TileLayer, Marker } from 'sweety-map';
import 'sweety-map/dist/sweety.css';

const map = new Map('map', { center: [55.75, 37.61], zoom: 10 });

new TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

new Marker([55.75, 37.61]).addTo(map).bindPopup('Hello, Moscow!');
```

## License

MIT © 2026 Brainstable. See [LICENSE](LICENSE).
