import { describe, expect, it, vi } from 'vitest';
import { Bounds } from '../src/core/Bounds.js';
import { Map } from '../src/core/Map.js';
import { Layer } from '../src/layers/Layer.js';
import { FeatureGroup, LayerGroup } from '../src/layers/LayerGroup.js';

class StubLayer extends Layer {
  constructor(options = {}) {
    super(options);
    this.added = 0;
    this.removed = 0;
    this.updates = 0;
    this.styles = [];
    this.popups = [];
  }

  onAdd(map) {
    this.added += 1;
    this._container = document.createElement('div');
    this._container.className = 'stub-layer';
    map.getPane('overlay').appendChild(this._container);
  }

  onRemove() {
    this.removed += 1;
    this._container?.remove();
    this._container = null;
  }

  _update() {
    this.updates += 1;
  }

  bindPopup(content) {
    this.popups.push(content);
    return this;
  }

  setStyle(style) {
    this.styles.push(style);
    return this;
  }
}

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 2,
    zoomControl: false,
    attributionControl: false,
  });
  return { map, container };
}

describe('Layer', () => {
  it('adds, removes and resolves panes', () => {
    const { map } = setup();
    const layer = new StubLayer({ pane: 'overlay', attribution: 'Test data' });
    layer.addTo(map);
    expect(layer._map).toBe(map);
    expect(map.hasLayer(layer)).toBe(true);
    expect(layer.getPane()).toBe(map.getPane('overlay'));
    expect(layer.getAttribution()).toBe('Test data');
    layer.setZIndex(12);
    expect(layer._container.style.zIndex).toBe('12');
    layer.remove();
    expect(map.hasLayer(layer)).toBe(false);
    map.remove();
  });

  it('supports function attributions and containers', () => {
    const { map } = setup();
    const layer = new StubLayer({ attribution: () => 'dynamic' });
    layer.addTo(map);
    expect(layer.getAttribution()).toBe('dynamic');
    expect(layer.bringToFront()).toBe(layer);
    expect(layer.bringToBack()).toBe(layer);
    expect(layer.getPane('custom')).toBe(map.getPane('custom'));
    map.remove();
  });
});

describe('LayerGroup and FeatureGroup', () => {
  it('adds children to the map and removes them together', () => {
    const { map } = setup();
    const first = new StubLayer();
    const second = new StubLayer();
    const group = new LayerGroup([first, second]);
    group.addTo(map);

    expect(group.getLayers()).toEqual([first, second]);
    expect(map.hasLayer(group)).toBe(true);
    expect(map.getLayers()).toHaveLength(3);
    expect(map.hasLayer(first)).toBe(true);
    expect(map.hasLayer(second)).toBe(true);
    expect(first.added).toBe(1);

    group.removeLayer(first);
    expect(first.removed).toBe(1);
    expect(group.hasLayer(first)).toBe(false);

    group.addLayer(first);
    group.clearLayers();
    expect(group.getLayers()).toHaveLength(0);
    expect(second.removed).toBe(1);
    map.remove();
  });

  it('does not collide ids when children are stamped before the group', () => {
    const { map } = setup();
    const first = new StubLayer();
    const second = new StubLayer();
    const group = new LayerGroup([first, second]);
    expect(first._sweetyId).toBeDefined();
    expect(second._sweetyId).toBeDefined();
    group.addTo(map);

    expect(group._sweetyId).not.toBe(first._sweetyId);
    expect(group._sweetyId).not.toBe(second._sweetyId);
    expect(map.hasLayer(group)).toBe(true);
    expect(map.getLayers()).toHaveLength(3);
    map.remove();
  });

  it('adds children that arrive after the group is on the map', () => {
    const { map } = setup();
    const group = new LayerGroup();
    group.addTo(map);
    const layer = new StubLayer();
    group.addLayer(layer);
    expect(layer.added).toBe(1);
    expect(map.hasLayer(layer)).toBe(true);
    map.remove();
  });

  it('bubbles child events through the group to the map once', () => {
    const { map } = setup();
    const group = new LayerGroup();
    group.addTo(map);
    const layer = new StubLayer();
    group.addLayer(layer);

    const groupListener = vi.fn();
    const mapListener = vi.fn();
    group.on('feature', groupListener);
    map.on('feature', mapListener);
    layer.fire('feature', { id: 3 });

    expect(groupListener).toHaveBeenCalledOnce();
    expect(mapListener).toHaveBeenCalledOnce();
    expect(mapListener.mock.calls[0][0].sourceTarget).toBe(layer);
    map.remove();
  });

  it('собирает границы дочерних слоёв и вложенных групп', () => {
    const group = new FeatureGroup();
    const withBounds = new StubLayer();
    withBounds.getBounds = () => new Bounds([0, 0], [10, 10]);
    const withLatLng = new StubLayer();
    withLatLng.getLatLng = () => ({ lat: -5, lng: 20 });
    const nested = new FeatureGroup();
    const inner = new StubLayer();
    inner.getLatLng = () => ({ lat: 30, lng: -40 });
    nested.addLayer(inner);

    group.addLayer(withBounds);
    group.addLayer(withLatLng);
    group.addLayer(nested);

    const bounds = group.getBounds();
    expect(bounds.isValid()).toBe(true);
    expect(bounds.getSouth()).toBe(-5);
    expect(bounds.getNorth()).toBe(30);
    expect(bounds.getWest()).toBe(-40);
    expect(bounds.getEast()).toBe(20);
    expect(new FeatureGroup().getBounds().isValid()).toBe(false);
  });

  it('applies group styling, z-index and popup bindings to features', () => {
    const { map } = setup();
    const group = new FeatureGroup();
    const first = new StubLayer();
    const second = new StubLayer();
    group.addTo(map);
    group.addLayer(first);
    group.addLayer(second);

    group.setStyle({ color: 'red' });
    expect(first.styles).toEqual([{ color: 'red' }]);
    expect(second.styles).toEqual([{ color: 'red' }]);

    group.bindPopup('<b>Feature</b>');
    expect(first.popups).toContain('<b>Feature</b>');
    expect(second.popups).toContain('<b>Feature</b>');

    group.setZIndex(10);
    expect(first.options.zIndex).toBe(10);
    map.remove();
  });
});
