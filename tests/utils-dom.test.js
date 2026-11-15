import { describe, expect, it, vi } from 'vitest';
import {
  SVG_NS,
  addClass,
  create,
  createNS,
  disableTextSelection,
  empty,
  enableTextSelection,
  fireDOMEvent,
  getMousePosition,
  getWheelDelta,
  hasClass,
  isInside,
  isZoomWheelEvent,
  off,
  on,
  preventDefault,
  remove,
  removeClass,
  setOpacity,
  setPosition,
  setPositionAbsolute,
  stop,
  stopPropagation,
  toggleClass,
} from '../src/util/dom.js';

describe('DOM helpers', () => {
  it('creates HTML and SVG nodes', () => {
    const container = create('div', 'container');
    const child = create('span', 'child', container);
    expect(container.firstChild).toBe(child);
    expect(container.className).toBe('container');
    const svg = createNS('svg', 'icon');
    expect(svg.namespaceURI).toBe(SVG_NS);
    expect(svg.getAttribute('class')).toBe('icon');
  });

  it('manages classes, children and opacity', () => {
    const element = create('div', 'alpha beta');
    expect(hasClass(element, 'alpha')).toBe(true);
    addClass(element, 'gamma');
    toggleClass(element, 'gamma');
    expect(hasClass(element, 'gamma')).toBe(false);
    toggleClass(element, 'gamma', true);
    expect(hasClass(element, 'gamma')).toBe(true);
    removeClass(element, 'alpha beta');
    expect(element.className).toBe('gamma');
    setOpacity(element, 0);
    expect(element.style.opacity).toBe('0');
    setOpacity(element, 0.4);
    expect(element.style.opacity).toBe('0.4');
    setOpacity(element, null);
    expect(element.style.opacity).toBe('');
  });

  it('positions elements and empties/removes them', () => {
    const parent = create('div');
    const child = create('span', '', parent);
    setPosition(child, { x: 1.2, y: 3.8 });
    expect(child.style.transform).toBe('translate3d(1px, 4px, 0)');
    setPositionAbsolute(child, { x: 5.4, y: 6.6 });
    expect(child.style.left).toBe('5px');
    expect(child.style.top).toBe('7px');
    empty(parent);
    expect(parent.firstChild).toBeNull();

    document.body.appendChild(parent);
    remove(parent);
    expect(parent.parentNode).toBeNull();
  });

  it('registers, unregisters and dispatches custom DOM events', () => {
    const element = create('div');
    document.body.appendChild(element);
    const listener = vi.fn();
    const unsubscribe = on(element, 'custom other', listener);
    fireDOMEvent(element, 'custom', { id: 7 });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toEqual({ id: 7 });

    unsubscribe();
    fireDOMEvent(element, 'custom');
    expect(listener).toHaveBeenCalledOnce();

    const offListener = vi.fn();
    on(element, 'custom', offListener);
    off(element, 'custom', offListener);
    fireDOMEvent(element, 'custom');
    expect(offListener).not.toHaveBeenCalled();
  });

  it('normalises wheel deltas and reports event targets', () => {
    expect(getWheelDelta({ deltaY: 5, deltaMode: 0 })).toBe(5);
    expect(getWheelDelta({ deltaY: 2, deltaMode: 1 })).toBe(80);
    expect(getWheelDelta({ deltaY: 1, deltaMode: 2 })).toBe(800);

    const parent = create('div');
    const child = create('span', '', parent);
    expect(isInside({ target: child }, parent)).toBe(true);
    expect(isInside({ target: document.body }, parent)).toBe(false);
    expect(isZoomWheelEvent({ ctrlKey: true })).toBe(true);
    expect(isZoomWheelEvent({ metaKey: true })).toBe(true);
    expect(isZoomWheelEvent({})).toBe(false);
  });

  it('stops and prevents events and toggles selection classes', () => {
    const event = {
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    };
    stopPropagation(event);
    preventDefault(event);
    stop(event);
    expect(event.stopPropagation).toHaveBeenCalledTimes(2);
    expect(event.preventDefault).toHaveBeenCalledTimes(2);

    disableTextSelection();
    expect(document.documentElement.classList.contains('sweety-dragging')).toBe(true);
    enableTextSelection();
    expect(document.documentElement.classList.contains('sweety-dragging')).toBe(false);
  });

  it('reads touch coordinates and client offsets', () => {
    const container = create('div');
    document.body.appendChild(container);
    mockElementSize(container, 300, 200);
    const touchEvent = {
      touches: [{ clientX: 30, clientY: 40 }],
    };
    expect(getMousePosition(touchEvent, container)).toEqual({ x: 30, y: 40 });
  });
});
