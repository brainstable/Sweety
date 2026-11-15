import { describe, expect, it } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Layer } from '../src/layers/Layer.js';
import { LayerGroup } from '../src/layers/LayerGroup.js';

class StubLayer extends Layer {}

describe('layer identifiers', () => {
  it('keeps group and children distinct when children are stamped first', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    mockElementSize(container, 600, 400);
    const map = new Map(container, {
      center: [0, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
    });
    const first = new StubLayer();
    const second = new StubLayer();
    const group = new LayerGroup([first, second]);

    expect(first._sweetyId).toBeDefined();
    group.addTo(map);

    expect(group._sweetyId).not.toBe(first._sweetyId);
    expect(group._sweetyId).not.toBe(second._sweetyId);
    expect(map.hasLayer(group)).toBe(true);
    expect(map.hasLayer(first)).toBe(true);
    expect(map.hasLayer(second)).toBe(true);
    expect(map.getLayers()).toHaveLength(3);
    map.remove();
  });
});
