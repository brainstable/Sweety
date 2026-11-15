/**
 * Small, dependency-free helpers shared by every Sweety module.
 * @module util
 */

/** @returns {boolean} True when `value` is a plain object. */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @returns {boolean} True when `value` is a finite number. */
export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Clamp `value` into the inclusive `[min, max]` range. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Wrap a number into `[min, max)` using modular arithmetic. */
export function wrapNum(value, range, includeMax = false) {
  const [min, max] = range;
  const span = max - min;
  const mod = (((value - min) % span) + span) % span;
  return mod === 0 && includeMax ? max : mod + min;
}

/** Convert degrees to radians. */
export const toRad = (degrees) => (degrees * Math.PI) / 180;

/** Convert radians to degrees. */
export const toDeg = (radians) => (radians * 180) / Math.PI;

/** A monotonically increasing id used to key DOM nodes and tiles. */
let lastId = 0;
export function stamp(object) {
  if (!object) return null;
  if (!Object.prototype.hasOwnProperty.call(object, '_sweetyId')) {
    lastId += 1;
    Object.defineProperty(object, '_sweetyId', {
      value: lastId,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }
  return object._sweetyId;
}

/**
 * Shallowly merge own enumerable properties into `target`.
 * Later sources win. `undefined` values are ignored.
 */
export function extend(target, ...sources) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of Object.keys(source)) {
      if (source[key] !== undefined) target[key] = source[key];
    }
  }
  return target;
}

/**
 * Replace `{placeholders}` in a string.
 * @param {string} templateString
 * @param {Record<string, string|number>} data
 * @param {boolean} [escape=false] HTML-escape substituted values
 */
export function template(templateString, data, escape = false) {
  return String(templateString).replace(/\{ *([\w_$-]+) *\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return match;
    if (!escape) return String(value);
    return String(value).replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  });
}

/** Format a number with at most `digits` fraction digits. */
export function formatNum(value, digits = 5) {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

/**
 * Return a debounced function. The last call wins; `cancel` and `flush`
 * are attached so callers can control lifecycle work.
 */
export function debounce(fn, wait = 100, context = null) {
  let timer = null;
  let pendingArgs = null;

  const invoke = () => {
    timer = null;
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn.apply(context, args);
  };

  const debounced = (...args) => {
    pendingArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(invoke, wait);
    return debounced;
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };
  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      invoke();
    }
  };
  return debounced;
}

/** Return a throttled function that runs at most once per `wait` ms. */
export function throttle(fn, wait = 100, context = null) {
  let last = 0;
  let timer = null;
  let pendingArgs = null;

  const later = () => {
    timer = null;
    last = Date.now();
    const args = pendingArgs;
    pendingArgs = null;
    if (args) fn.apply(context, args);
  };

  const throttled = (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    pendingArgs = args;
    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(context, args);
      pendingArgs = null;
    } else if (!timer) {
      timer = setTimeout(later, remaining);
    }
    return throttled;
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pendingArgs = null;
  };
  return throttled;
}

const requestFrame =
  typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (callback) => setTimeout(() => callback(Date.now()), 16);

const cancelFrame =
  typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window)
    : clearTimeout;

/** Schedule a callback on the next animation frame. */
export const requestAnimFrame = (callback) => requestFrame(callback);

/** Cancel a callback scheduled with {@link requestAnimFrame}. */
export const cancelAnimFrame = (callback) => cancelFrame(callback);

/**
 * Coalesce calls into one requestAnimationFrame tick. Useful for pointer and
 * resize events that can fire faster than the display refresh rate.
 * @param {Function} fn
 * @param {object} [context=null]
 * @returns {Function & {cancel: Function}}
 */
export function rafThrottle(fn, context = null) {
  let frame = null;
  let pendingArgs = null;
  const throttled = (...args) => {
    pendingArgs = args;
    if (frame) return throttled;
    frame = requestAnimFrame(() => {
      frame = null;
      const argsToApply = pendingArgs;
      pendingArgs = null;
      fn.apply(context, argsToApply || []);
    });
    return throttled;
  };
  throttled.cancel = () => {
    if (frame) cancelAnimFrame(frame);
    frame = null;
    pendingArgs = null;
  };
  return throttled;
}

/** Cubic ease-out easing function for animated navigation. */
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Cubic ease-in-out easing function. */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Device pixel ratio, clamped to a sane range. */
export function devicePixelRatio() {
  if (typeof window === 'undefined') return 1;
  return clamp(window.devicePixelRatio || 1, 1, 4);
}

/** Whether the current device exposes touch events. */
export function hasTouch() {
  return (
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
}

/** Read a CSS custom property from an element. */
export function readCssVar(element, name, fallback = '') {
  if (!element || typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}
