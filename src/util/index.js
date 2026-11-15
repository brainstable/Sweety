/**
 * Небольшие вспомогательные функции без зависимостей, общие для всех модулей Sweety.
 * @module util
 */

/** @returns {boolean} `true`, если `value` — простой объект. */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @returns {boolean} `true`, если `value` — конечное число. */
export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Ограничивает `value` включительным диапазоном `[min, max]`. */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Приводит число к диапазону `[min, max)` по модулю. */
export function wrapNum(value, range, includeMax = false) {
  const [min, max] = range;
  const span = max - min;
  const mod = (((value - min) % span) + span) % span;
  return mod === 0 && includeMax ? max : mod + min;
}

/** Переводит градусы в радианы. */
export const toRad = (degrees) => (degrees * Math.PI) / 180;

/** Переводит радианы в градусы. */
export const toDeg = (radians) => (radians * 180) / Math.PI;

/** Монотонно возрастающий идентификатор для ключевания DOM-узлов и тайлов. */
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
 * Поверхностно объединяет собственные перечисляемые свойства в `target`.
 * Более поздние источники имеют приоритет. Значения `undefined` игнорируются.
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
 * Подставляет значения вместо `{placeholders}` в строке.
 * @param {string} templateString
 * @param {Record<string, string|number>} data
 * @param {boolean} [escape=false] экранировать подставленные значения как HTML
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

/** Форматирует число с не более чем `digits` знаками после запятой. */
export function formatNum(value, digits = 5) {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

/**
 * Возвращает функцию с debounce. Побеждает последний вызов; методы `cancel`
 * и `flush` прикреплены, чтобы вызывающий код мог управлять жизненным циклом.
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

/** Возвращает функцию с throttle, выполняющуюся не чаще одного раза за `wait` мс. */
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

/** Планирует callback на следующий кадр анимации. */
export const requestAnimFrame = (callback) => requestFrame(callback);

/** Отменяет callback, запланированный через {@link requestAnimFrame}. */
export const cancelAnimFrame = (callback) => cancelFrame(callback);

/**
 * Объединяет вызовы в один тик requestAnimationFrame. Полезно для событий
 * указателя и изменения размера, которые могут приходить чаще частоты
 * обновления экрана.
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

/** Кубическая функция плавности ease-out для анимированной навигации. */
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/** Кубическая функция плавности ease-in-out. */
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Соотношение пикселей устройства (DPR), ограниченное разумным диапазоном. */
export function devicePixelRatio() {
  if (typeof window === 'undefined') return 1;
  return clamp(window.devicePixelRatio || 1, 1, 4);
}

/** Проверяет, поддерживает ли текущее устройство сенсорные события. */
export function hasTouch() {
  return (
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );
}

/** Читает пользовательское свойство CSS у элемента. */
export function readCssVar(element, name, fallback = '') {
  if (!element || typeof getComputedStyle !== 'function') return fallback;
  return getComputedStyle(element).getPropertyValue(name).trim() || fallback;
}
