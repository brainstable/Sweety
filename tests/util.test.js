import { describe, expect, it, vi } from 'vitest';
import {
  clamp,
  debounce,
  formatNum,
  isNumber,
  isObject,
  rafThrottle,
  template,
  throttle,
  wrapNum,
} from '../src/util/index.js';
import { addClass, create, getMousePosition, removeClass, setPosition } from '../src/util/dom.js';

describe('utils', () => {
  it('normalises numbers and placeholders', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(wrapNum(190, [-180, 180])).toBe(-170);
    expect(wrapNum(-190, [-180, 180])).toBe(170);
    expect(formatNum(1.234567, 2)).toBe('1.23');
    expect(isNumber(3)).toBe(true);
    expect(isNumber(Number.NaN)).toBe(false);
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
  });

  it('replaces placeholders and optionally escapes values', () => {
    expect(template('{a}/{b}', { a: 1, b: 'x' })).toBe('1/x');
    expect(template('{missing}', {})).toBe('{missing}');
    expect(template('{value}', { value: '<b>&</b>' }, true)).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
  });

  it('debounces calls and supports flush/cancel', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced(1);
    debounced(2);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(2);

    debounced(3);
    debounced.flush();
    expect(fn).toHaveBeenLastCalledWith(3);
    debounced(4);
    debounced.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throttles calls and supports cancel', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = throttle(fn, 100);
    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenLastCalledWith('c');
    throttled.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('coalesces calls into one animation frame', async () => {
    const fn = vi.fn();
    const throttled = rafThrottle(fn);
    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).not.toHaveBeenCalled();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('c');

    throttled('d');
    throttled.cancel();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('DOM utilities', () => {
  it('creates elements, toggles classes and positions with transforms', () => {
    const element = create('div', 'alpha');
    addClass(element, 'beta gamma');
    addClass(element, 'alpha');
    expect(element.classList.contains('beta')).toBe(true);
    removeClass(element, 'beta gamma');
    expect(element.className).toBe('alpha');
    expect(setPosition(element, { x: 10.4, y: 20.6 })).toBe(element);
    expect(element.style.transform).toBe('translate3d(10px, 21px, 0)');
  });

  it('resolves pointer coordinates relative to a container', () => {
    const container = create('div');
    document.body.appendChild(container);
    mockElementSize(container, 300, 200);
    expect(getMousePosition({ clientX: 120, clientY: 80 }, container)).toEqual({
      x: 120,
      y: 80,
    });
  });
});
