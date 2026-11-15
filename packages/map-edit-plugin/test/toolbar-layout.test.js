import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { Map } from 'sweety-map';
import { EditPlugin } from '../src/EditPlugin.js';

// jsdom подменяет глобальный URL и резолвит относительные пути от location,
// поэтому для файла стилей берём реализацию из node:url.
const CSS = readFileSync(new NodeURL('../src/styles/map-edit-plugin.css', import.meta.url), 'utf8');

/** @type {Array<{plugin: EditPlugin, map: Map}>} */
const harnesses = [];

function createHarness(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 2,
    zoomControl: false,
    attributionControl: false,
    zoomAnimation: false,
    fadeAnimation: false,
    doubleClickZoom: false,
  });
  const plugin = new EditPlugin(map, { keyboard: false, ...options });
  harnesses.push({ plugin, map });
  return { plugin, map };
}

/** Высота панели применяется в requestAnimationFrame, даём ему пройти. */
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 40));

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    if (!harness.plugin._destroyed) harness.plugin.destroy();
    harness.map.remove();
  }
});

describe('EditControl: раскладка', () => {
  it('панель инструментов вертикальная и переносит кнопки в столбцы', () => {
    const block = CSS.match(/\.map-edit-control\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(block).toMatch(/flex-direction:\s*column/);
    expect(block).toMatch(/flex-wrap:\s*wrap/);
    expect(block).toMatch(/max-height:/);

    const horizontal =
      CSS.match(/\.map-edit-control\.map-edit-control-horizontal\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(horizontal).toMatch(/flex-direction:\s*row/);
  });

  it('ограничивает высоту панели нижней границей карты', async () => {
    const { plugin } = createHarness();
    const control = plugin.control.getContainer();
    expect(control.getAttribute('aria-orientation')).toBe('vertical');
    await nextFrame();
    expect(control.style.maxHeight).toBe('590px');
  });

  it('пересчитывает высоту при изменении размера карты', async () => {
    const { plugin, map } = createHarness();
    const control = plugin.control.getContainer();
    await nextFrame();
    expect(control.style.maxHeight).toBe('590px');

    mockElementSize(map.getContainer(), 800, 320);
    map.fire('resize', {
      oldSize: { x: 800, y: 600 },
      newSize: { x: 800, y: 320 },
    });
    await nextFrame();
    expect(control.style.maxHeight).toBe('310px');

    mockElementSize(map.getContainer(), 800, 120);
    map.fire('resize', {
      oldSize: { x: 800, y: 320 },
      newSize: { x: 800, y: 120 },
    });
    await nextFrame();
    expect(control.style.maxHeight).toBe('160px');
  });

  it('для нижнего угла отсчитывает высоту от размера карты', async () => {
    const { plugin } = createHarness({ position: 'bottomleft' });
    await nextFrame();
    expect(plugin.control.getContainer().style.maxHeight).toBe('580px');
  });
});
