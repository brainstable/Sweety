import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Point } from '../src/core/Point.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setup(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 2,
    zoomControl: false,
    attributionControl: false,
    ...options,
  });
  return { map, container };
}

function touchPointer(type, id, x, y) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperty(event, 'pointerId', { value: id });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  return event;
}

describe('wheel and double-click zoom', () => {
  it('zooms with the mouse wheel and anchors the pointer', async () => {
    const { map, container } = setup({ zoomAnimation: false });
    const zoomSpy = vi.fn();
    map.on('zoom', zoomSpy);
    const anchor = map.containerPointToLatLng(new Point(200, 150));

    container.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaY: -60,
        clientX: 200,
        clientY: 150,
      }),
    );
    await wait(100);

    expect(map.getZoom()).toBe(3);
    expect(zoomSpy).toHaveBeenCalled();
    const after = map.latLngToContainerPoint(anchor);
    expect(after.x).toBeCloseTo(200, 5);
    expect(after.y).toBeCloseTo(150, 5);
    map.remove();
  });

  it('zooms on double click and respects the maximum zoom', () => {
    const { map, container } = setup({ zoomAnimation: false, maxZoom: 3 });
    container.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 300,
      }),
    );
    expect(map.getZoom()).toBe(3);

    container.dispatchEvent(
      new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: 400,
        clientY: 300,
      }),
    );
    expect(map.getZoom()).toBe(3);
    map.remove();
  });

  it('can disable wheel and double-click handlers', async () => {
    const { map, container } = setup({ scrollWheelZoom: false, doubleClickZoom: false });
    expect(map.scrollWheelZoom.enabled()).toBe(false);
    expect(map.doubleClickZoom.enabled()).toBe(false);
    container.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: -100 }));
    container.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await wait(80);
    expect(map.getZoom()).toBe(2);
    map.remove();
  });
});

describe('pinch zoom', () => {
  it('zooms with two touch pointers', () => {
    const { map, container } = setup({ zoomAnimation: false });
    const pinchStart = vi.fn();
    const pinch = vi.fn();
    const pinchEnd = vi.fn();
    map.on('pinchstart', pinchStart);
    map.on('pinch', pinch);
    map.on('pinchend', pinchEnd);

    container.dispatchEvent(touchPointer('pointerdown', 1, 300, 300));
    container.dispatchEvent(touchPointer('pointerdown', 2, 500, 300));
    expect(pinchStart).toHaveBeenCalledOnce();

    document.dispatchEvent(touchPointer('pointermove', 1, 250, 300));
    document.dispatchEvent(touchPointer('pointermove', 2, 550, 300));
    expect(pinch).toHaveBeenCalled();
    expect(map.getZoom()).toBe(3);

    document.dispatchEvent(touchPointer('pointerup', 1, 250, 300));
    expect(pinchEnd).toHaveBeenCalledOnce();
    expect(map._pinching).toBe(false);
    map.remove();
  });
});

describe('animated zoom', () => {
  it('applies and clears the CSS transition', async () => {
    const { map } = setup();
    const zoomEnd = vi.fn();
    map.on('zoomend', zoomEnd);

    map.setZoomAroundPoint(new Point(400, 300), 4, {
      animate: true,
      zoomAnchor: new Point(400, 300),
    });
    expect(map._animatingZoom).toBe(true);
    expect(map.getZoom()).toBe(4);
    expect(map.getContainer().classList.contains('sweety-zoom-anim')).toBe(true);
    expect(map.getContainer().querySelector('.sweety-map-pane').style.transform).toContain(
      'scale(0.25)',
    );

    await wait(300);
    expect(map._animatingZoom).toBe(false);
    expect(map.getContainer().classList.contains('sweety-zoom-anim')).toBe(false);
    expect(zoomEnd).toHaveBeenCalled();
    map.remove();
  });

  it('animates panTo with requestAnimationFrame', async () => {
    const { map } = setup();
    const moveEnd = vi.fn();
    map.on('moveend', moveEnd);
    map.panTo([10, 20], { animate: true, duration: 80 });
    await wait(200);
    expect(map.getCenter().lat).toBeCloseTo(10, 6);
    expect(map.getCenter().lng).toBeCloseTo(20, 6);
    expect(moveEnd).toHaveBeenCalled();
    map.remove();
  });
});
