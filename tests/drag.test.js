import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';

function pointerEvent(type, x, y, extra = {}) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  Object.assign(event, extra);
  return event;
}

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 2,
    inertia: false,
    zoomControl: false,
    attributionControl: false,
  });
  return { map, container };
}

describe('DragHandler', () => {
  it('pans the map after the drag threshold and emits drag events', () => {
    const { map, container } = setup();
    const dragstart = vi.fn();
    const drag = vi.fn();
    const dragend = vi.fn();
    const movestart = vi.fn();
    const moveend = vi.fn();
    map.on('dragstart', dragstart);
    map.on('drag', drag);
    map.on('dragend', dragend);
    map.on('movestart', movestart);
    map.on('moveend', moveend);

    const before = map.getCenter();
    container.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    document.dispatchEvent(pointerEvent('pointermove', 401, 300));
    expect(dragstart).not.toHaveBeenCalled();

    document.dispatchEvent(pointerEvent('pointermove', 450, 320));
    expect(dragstart).toHaveBeenCalledOnce();
    expect(drag).toHaveBeenCalledOnce();
    expect(movestart).toHaveBeenCalledOnce();
    expect(map.getCenter().lng).toBeLessThan(before.lng);
    expect(map.getCenter().lat).toBeGreaterThan(before.lat);

    document.dispatchEvent(pointerEvent('pointerup', 450, 320));
    expect(dragend).toHaveBeenCalledOnce();
    expect(moveend).toHaveBeenCalledOnce();
    map.remove();
  });

  it('suppresses the click that follows a drag', () => {
    const { map, container } = setup();
    const click = vi.fn();
    map.on('click', click);

    container.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    document.dispatchEvent(pointerEvent('pointermove', 460, 300));
    document.dispatchEvent(pointerEvent('pointerup', 460, 300));
    container.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 460, clientY: 300 }));
    expect(click).not.toHaveBeenCalled();
    map.remove();
  });

  it('can be disabled and re-enabled', () => {
    const { map, container } = setup();
    expect(map.dragging.enabled()).toBe(true);
    map.dragging.disable();
    expect(map.dragging.enabled()).toBe(false);

    const center = map.getCenter();
    container.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    document.dispatchEvent(pointerEvent('pointermove', 480, 300));
    document.dispatchEvent(pointerEvent('pointerup', 480, 300));
    expect(map.getCenter().equals(center, 1e-9)).toBe(true);

    map.dragging.enable();
    expect(map.dragging.enabled()).toBe(true);
    map.remove();
  });

  it('does not start a drag from a marker or control', () => {
    const { map, container } = setup();
    const control = document.createElement('div');
    control.className = 'sweety-control';
    container.appendChild(control);

    const center = map.getCenter();
    control.dispatchEvent(pointerEvent('pointerdown', 400, 300));
    document.dispatchEvent(pointerEvent('pointermove', 500, 300));
    expect(map.getCenter().equals(center, 1e-9)).toBe(true);
    map.remove();
  });

  it('computes kinetic velocity and applies inertia', async () => {
    const { map } = setup();
    const handler = map.dragging;
    handler._samples = [
      { time: 0, x: 400, y: 300 },
      { time: 50, x: 500, y: 300 },
    ];
    const velocity = handler._computeVelocity();
    expect(velocity.x).toBeLessThan(0);
    expect(velocity.y).toBeCloseTo(0, 5);

    const before = map.getCenter();
    handler._startInertia({ x: -100, y: 0 });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(map.getCenter().lng).not.toBeCloseTo(before.lng);
    handler._cancelInertia();
    map.remove();
  });
});
