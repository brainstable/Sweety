import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { GeoJSONLayer } from '../src/layers/GeoJSON.js';
import { Marker } from '../src/layers/Marker.js';
import { DivIcon } from '../src/layers/Marker.Icon.js';

const data = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Point', color: '#ff0000' },
      geometry: { type: 'Point', coordinates: [37.6, 55.7] },
    },
    {
      type: 'Feature',
      properties: { name: 'Line', color: '#00ff00' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [37.5, 55.6],
          [37.7, 55.7],
          [37.8, 55.8],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Polygon', color: '#0000ff' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [37.5, 55.6],
            [37.8, 55.6],
            [37.8, 55.9],
            [37.5, 55.9],
            [37.5, 55.6],
          ],
          [
            [37.6, 55.7],
            [37.7, 55.7],
            [37.7, 55.8],
            [37.6, 55.8],
            [37.6, 55.7],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'MultiPoint' },
      geometry: {
        type: 'MultiPoint',
        coordinates: [
          [37.4, 55.5],
          [37.9, 55.9],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'MultiPolygon' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [37.1, 55.1],
              [37.2, 55.1],
              [37.2, 55.2],
              [37.1, 55.1],
            ],
          ],
          [
            [
              [37.3, 55.3],
              [37.4, 55.3],
              [37.4, 55.4],
              [37.3, 55.3],
            ],
          ],
        ],
      },
    },
  ],
};

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [55.7, 37.6],
    zoom: 9,
    zoomControl: false,
    attributionControl: false,
  });
  return { map, container };
}

function flatten(layers) {
  const result = [];
  for (const layer of layers) {
    result.push(layer);
    if (typeof layer.getLayers === 'function') result.push(...flatten(layer.getLayers()));
  }
  return result;
}

describe('GeoJSONLayer', () => {
  it('parses every common geometry type into native layers', () => {
    const { map } = setup();
    const geo = new GeoJSONLayer(data).addTo(map);
    const layers = flatten(geo.getLayers());
    const markers = layers.filter((layer) => layer instanceof Marker);
    expect(geo.getLayers()).toHaveLength(5);
    expect(markers).toHaveLength(3);
    expect(layers.some((layer) => layer.constructor.name === 'Polygon')).toBe(true);
    expect(layers.some((layer) => layer.constructor.name === 'Polyline')).toBe(true);
    map.remove();
  });

  it('applies style objects and functions', () => {
    const { map } = setup();
    const style = vi.fn((feature) => ({ color: feature.properties.color }));
    const geo = new GeoJSONLayer(data, { style }).addTo(map);
    const layers = flatten(geo.getLayers());
    const line = layers.find((layer) => layer.feature?.properties.name === 'Line');
    const polygon = layers.find((layer) => layer.feature?.properties.name === 'Polygon');
    expect(style).toHaveBeenCalled();
    expect(line._path.getAttribute('stroke')).toBe('#00ff00');
    expect(polygon._path.getAttribute('stroke')).toBe('#0000ff');

    geo.setStyle({ color: '#123456' });
    expect(line._path.getAttribute('stroke')).toBe('#123456');
    map.remove();
  });

  it('supports pointToLayer, onEachFeature and feature events', () => {
    const { map } = setup();
    const onEachFeature = vi.fn((feature, layer) => {
      layer.bindPopup(feature.properties.name);
    });
    const pointToLayer = vi.fn(
      (feature, latlng) =>
        new Marker(latlng, {
          icon: new DivIcon({ html: feature.properties.name }),
        }),
    );
    const geo = new GeoJSONLayer(data, { pointToLayer, onEachFeature }).addTo(map);
    expect(pointToLayer).toHaveBeenCalledTimes(3);
    expect(onEachFeature).toHaveBeenCalledTimes(5);

    const layers = flatten(geo.getLayers());
    const marker = layers.find((layer) => layer.feature?.properties.name === 'Point');
    expect(marker.getElement().textContent).toBe('Point');
    marker.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(marker.isPopupOpen()).toBe(true);

    const featureClick = vi.fn();
    geo.on('click', featureClick);
    marker.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(featureClick).toHaveBeenCalledOnce();
    expect(featureClick.mock.calls[0][0].sourceTarget.feature.properties.name).toBe('Point');
    map.remove();
  });

  it('filters features and supports incremental addData', () => {
    const { map } = setup();
    const geo = new GeoJSONLayer(data, {
      filter: (feature) => feature.properties.name !== 'Point',
    }).addTo(map);
    expect(geo.getLayers()).toHaveLength(4);

    geo.addData({
      type: 'Feature',
      properties: { name: 'Added' },
      geometry: { type: 'Point', coordinates: [37.6, 55.7] },
    });
    expect(geo.getLayers()).toHaveLength(5);
    expect(geo.toGeoJSON().type).toBe('FeatureCollection');
    expect(geo.toGeoJSON().features.length).toBeGreaterThanOrEqual(4);
    map.remove();
  });

  it('honours custom coordinate conversion and reports invalid input', () => {
    const { map } = setup();
    const coordsToLatLng = vi.fn(([lng, lat]) => ({ lat: lat + 0.1, lng }));
    const geo = new GeoJSONLayer(
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [37.6, 55.7] },
          },
        ],
      },
      { coordsToLatLng },
    ).addTo(map);
    const marker = geo.getLayers()[0];
    expect(marker.getLatLng().lat).toBeCloseTo(55.8);
    expect(coordsToLatLng).toHaveBeenCalled();

    expect(() => new GeoJSONLayer(null)).not.toThrow();
    expect(() => new GeoJSONLayer({ type: 'Feature' })).toThrow(TypeError);
    expect(() => new GeoJSONLayer({ type: 'Nope' })).toThrow('Unsupported GeoJSON geometry');
    expect(() => geo.addData({ type: 'FeatureCollection' })).toThrow(TypeError);
    map.remove();
  });

  it('handles GeometryCollection', () => {
    const { map } = setup();
    const geo = new GeoJSONLayer({
      type: 'GeometryCollection',
      geometries: [
        { type: 'Point', coordinates: [37.6, 55.7] },
        { type: 'Point', coordinates: [37.7, 55.8] },
      ],
    }).addTo(map);
    expect(geo.getLayers()).toHaveLength(1);
    expect(flatten(geo.getLayers()).filter((layer) => layer instanceof Marker)).toHaveLength(2);
    map.remove();
  });
});
