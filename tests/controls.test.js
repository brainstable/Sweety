import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Control } from '../src/controls/Control.js';
import { ZoomControl } from '../src/controls/Zoom.js';
import { AttributionControl } from '../src/controls/Attribution.js';
import { ScaleControl } from '../src/controls/Scale.js';
import { LayersControl } from '../src/controls/Layers.js';
import { TileLayer } from '../src/layers/TileLayer.js';
import { Marker } from '../src/layers/Marker.js';

function setup(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
    ...options,
  });
  return { map, container };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class CustomControl extends Control {
  constructor(position = 'bottomleft') {
    super({ position });
  }

  onAdd() {
    this._container = this._initLayout('sweety-control-custom');
    this._container.innerHTML = '<button type="button">Custom</button>';
    return this._container;
  }
}

describe('Control', () => {
  it('adds, repositions and removes custom controls', () => {
    const { map } = setup();
    const control = new CustomControl('topright').addTo(map);
    expect(control.getContainer().parentNode).toBe(map._controlCorners.topright);
    expect(control.getPosition()).toBe('topright');

    control.setPosition('bottomleft');
    expect(control.getContainer().parentNode).toBe(map._controlCorners.bottomleft);
    expect(() => control.setPosition('nope')).toThrow('Unknown control position');

    const container = control.getContainer();
    control.remove();
    expect(container.parentNode).toBeNull();
    expect(map._controls).toHaveLength(0);
    map.remove();
  });

  it('does not trigger map clicks from controls', () => {
    const { map } = setup();
    const click = vi.fn();
    map.on('click', click);
    const control = new CustomControl('topleft').addTo(map);
    control.getContainer().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(click).not.toHaveBeenCalled();
    map.remove();
  });

  it('adds the default zoom and attribution controls', () => {
    const { map } = setup({ zoomControl: true, attributionControl: true });
    expect(map._controlCorners.topleft.querySelector('.sweety-control-zoom')).toBeTruthy();
    expect(
      map._controlCorners.bottomright.querySelector('.sweety-control-attribution'),
    ).toBeTruthy();
    map.remove();
  });
});

describe('ZoomControl', () => {
  it('zooms in and out and disables buttons at limits', async () => {
    const { map } = setup({ minZoom: 3, maxZoom: 5 });
    const control = new ZoomControl().addTo(map);
    const zoomIn = control.getContainer().querySelector('.sweety-control-zoom-in');
    const zoomOut = control.getContainer().querySelector('.sweety-control-zoom-out');

    zoomIn.click();
    expect(map.getZoom()).toBe(5);
    await wait(300);
    expect(zoomIn.disabled).toBe(true);
    expect(zoomOut.disabled).toBe(false);

    zoomOut.click();
    expect(map.getZoom()).toBe(4);
    map.setZoom(3);
    await wait(300);
    expect(zoomOut.disabled).toBe(true);
    map.remove();
  });
});

describe('AttributionControl', () => {
  it('collects layer attributions and updates on layer changes', () => {
    const { map } = setup();
    const control = new AttributionControl({ prefix: 'Sweety' }).addTo(map);
    expect(control.getContainer().textContent).toContain('Sweety');

    const layer = new TileLayer('https://tiles.test/{z}/{x}/{y}.png', {
      attribution: '&copy; Test',
    }).addTo(map);
    expect(control.getContainer().textContent).toContain('Test');

    layer.remove();
    expect(control.getContainer().textContent).not.toContain('Test');

    control.addAttribution('Manual');
    expect(control.getContainer().textContent).toContain('Manual');
    control.removeAttribution('Manual');
    expect(control.getContainer().textContent).not.toContain('Manual');
    control.setPrefix('Prefix');
    expect(control.getContainer().textContent).toContain('Prefix');
    map.remove();
  });

  it('de-duplicates identical attributions and handles functions', () => {
    const { map } = setup();
    const control = new AttributionControl({ prefix: '' }).addTo(map);
    new TileLayer('https://a.test/{z}/{x}/{y}.png', { attribution: 'Same' }).addTo(map);
    new TileLayer('https://b.test/{z}/{x}/{y}.png', {
      attribution: () => 'Same',
    }).addTo(map);
    const text = control.getContainer().textContent;
    expect(text.match(/Same/g)).toHaveLength(1);
    map.remove();
  });
});

describe('ScaleControl', () => {
  it('renders metric and imperial scale lines and updates on zoom', () => {
    const { map } = setup();
    const control = new ScaleControl().addTo(map);
    const lines = control.getContainer().querySelectorAll('.sweety-control-scale-line');
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toMatch(/(m|km)$/);
    expect(lines[1].textContent).toMatch(/(ft|mi)$/);

    const before = lines[0].textContent;
    map.setZoom(8);
    const after = control.getContainer().querySelector('.sweety-control-scale-line').textContent;
    expect(after).not.toBe(before);
    map.remove();
  });
});

describe('LayersControl', () => {
  function layerSetup() {
    const { map } = setup();
    const streets = new Marker([0, 0], { title: 'Streets' });
    const satellite = new Marker([1, 1], { title: 'Satellite' });
    const labels = new Marker([2, 2], { title: 'Labels' });
    streets.addTo(map);
    return { map, streets, satellite, labels };
  }

  it('switches base layers and toggles overlays', () => {
    const { map, streets, satellite, labels } = layerSetup();
    const control = new LayersControl(
      { Streets: streets, Satellite: satellite },
      { Labels: labels },
    ).addTo(map);
    const baseChange = vi.fn();
    const overlayAdd = vi.fn();
    const overlayRemove = vi.fn();
    map.on('baselayerchange', baseChange);
    map.on('overlayadd', overlayAdd);
    map.on('overlayremove', overlayRemove);

    const baseInputs = control.getContainer().querySelectorAll('input[type="radio"]');
    expect(baseInputs).toHaveLength(2);
    expect(baseInputs[0].checked).toBe(true);

    baseInputs[1].click();
    expect(map.hasLayer(satellite)).toBe(true);
    expect(map.hasLayer(streets)).toBe(false);
    expect(baseChange).toHaveBeenCalledOnce();
    expect(baseChange.mock.calls[0][0].name).toBe('Satellite');

    const overlayInput = control.getContainer().querySelector('input[type="checkbox"]');
    overlayInput.click();
    expect(map.hasLayer(labels)).toBe(true);
    expect(overlayAdd).toHaveBeenCalledOnce();
    overlayInput.click();
    expect(map.hasLayer(labels)).toBe(false);
    expect(overlayRemove).toHaveBeenCalledOnce();
    map.remove();
  });

  it('collapses and expands, and follows external layer changes', () => {
    const { map, streets, labels } = layerSetup();
    const control = new LayersControl({ Streets: streets }, { Labels: labels }).addTo(map);
    const container = control.getContainer();
    expect(container.classList.contains('sweety-control-layers-expanded')).toBe(false);

    control._toggleButton.click();
    expect(container.classList.contains('sweety-control-layers-expanded')).toBe(true);

    labels.addTo(map);
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(checkbox.checked).toBe(true);
    labels.remove();
    expect(checkbox.checked).toBe(false);

    control.addOverlay(new Marker([3, 3]), 'Extra');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    control.removeLayer(labels);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    map.remove();
  });
});
