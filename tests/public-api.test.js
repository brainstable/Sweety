import { describe, expect, it } from 'vitest';
import Sweety, {
  AttributionControl,
  Bounds,
  Canvas,
  Circle,
  Control,
  DivIcon,
  EPSG3857,
  EPSG4326,
  Evented,
  FeatureGroup,
  GeoJSONLayer,
  Icon,
  LatLng,
  Layer,
  LayerGroup,
  LayersControl,
  Map,
  Marker,
  Point,
  Polygon,
  Polyline,
  Popup,
  Projection,
  Rectangle,
  ScaleControl,
  SVG,
  TileLayer,
  Tooltip,
  ZoomControl,
} from '../src/index.js';

describe('public API', () => {
  it('exposes the complete namespace and named exports', () => {
    expect(Sweety.version).toBe('0.1.0');
    expect(Sweety.Map).toBe(Map);
    expect(Sweety.LatLng).toBe(LatLng);
    expect(Sweety.Point).toBe(Point);
    expect(Sweety.Bounds).toBe(Bounds);
    expect(Sweety.Evented).toBe(Evented);
    expect(Sweety.Projection).toBe(Projection);
    expect(Sweety.EPSG3857).toBe(EPSG3857);
    expect(Sweety.EPSG4326).toBe(EPSG4326);
    expect(Sweety.Layer).toBe(Layer);
    expect(Sweety.LayerGroup).toBe(LayerGroup);
    expect(Sweety.FeatureGroup).toBe(FeatureGroup);
    expect(Sweety.TileLayer).toBe(TileLayer);
    expect(Sweety.Marker).toBe(Marker);
    expect(Sweety.Icon).toBe(Icon);
    expect(Sweety.DivIcon).toBe(DivIcon);
    expect(Sweety.Popup).toBe(Popup);
    expect(Sweety.Tooltip).toBe(Tooltip);
    expect(Sweety.GeoJSONLayer).toBe(GeoJSONLayer);
    expect(Sweety.Polyline).toBe(Polyline);
    expect(Sweety.Polygon).toBe(Polygon);
    expect(Sweety.Circle).toBe(Circle);
    expect(Sweety.Rectangle).toBe(Rectangle);
    expect(Sweety.SVG).toBe(SVG);
    expect(Sweety.Canvas).toBe(Canvas);
    expect(Sweety.Control).toBe(Control);
    expect(Sweety.ZoomControl).toBe(ZoomControl);
    expect(Sweety.AttributionControl).toBe(AttributionControl);
    expect(Sweety.ScaleControl).toBe(ScaleControl);
    expect(Sweety.LayersControl).toBe(LayersControl);
    expect(typeof Sweety.use).toBe('function');
    expect(typeof Sweety.definePlugin).toBe('function');
    expect(Sweety.plugin).toBe(Sweety.definePlugin);
    expect(Sweety.GeoJSON).toBe(GeoJSONLayer);
  });

  it('provides a working map from the default namespace', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockElementSize(container, 640, 360);
    const map = new Sweety.Map(container, {
      center: [55.75, 37.61],
      zoom: 10,
      zoomControl: false,
      attributionControl: false,
    });
    expect(map.getZoom()).toBe(10);
    new Sweety.Marker([55.75, 37.61]).addTo(map);
    expect(map.getLayers()).toHaveLength(1);
    map.remove();
  });
});
