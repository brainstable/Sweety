/**
 * Вспомогательные функции для DOM. Намеренно компактны, чтобы ядро
 * оставалось независимым от фреймворков.
 * @module util/dom
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Создаёт HTML-элемент.
 * @param {string} tagName
 * @param {string} [className]
 * @param {HTMLElement|null} [container]
 * @returns {HTMLElement}
 */
export function create(tagName, className = '', container = null) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (container) container.appendChild(element);
  return element;
}

/**
 * Создаёт SVG-элемент в пространстве имён SVG.
 * @param {string} tagName
 * @param {string} [attributes]
 * @param {SVGElement|null} [container]
 * @returns {SVGElement}
 */
export function createNS(tagName, attributes = '', container = null) {
  const element = document.createElementNS(SVG_NS, tagName);
  if (attributes) element.setAttribute('class', attributes);
  if (container) container.appendChild(element);
  return element;
}

/** Добавляет один или несколько классов, разделённых пробелами. */
export function addClass(element, className) {
  for (const name of className.split(/\s+/).filter(Boolean)) {
    if (!element.classList.contains(name)) element.classList.add(name);
  }
  return element;
}

/** Удаляет один или несколько классов, разделённых пробелами. */
export function removeClass(element, className) {
  for (const name of className.split(/\s+/).filter(Boolean)) {
    element.classList.remove(name);
  }
  return element;
}

/** Переключает класс, при необходимости принудительно задавая состояние. */
export function toggleClass(element, className, force) {
  if (force === undefined) {
    element.classList.toggle(className);
  } else if (force) {
    element.classList.add(className);
  } else {
    element.classList.remove(className);
  }
  return element;
}

/** Проверяет, есть ли у элемента класс. */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/** Очищает элемент, не заменяя его. */
export function empty(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

/** Удаляет элемент из документа, если он присоединён. */
export function remove(element) {
  if (element && element.parentNode) element.parentNode.removeChild(element);
  return element;
}

/** Задаёт встроенное позиционирование через transform с GPU-дружественным translate3d. */
export function setPosition(element, point) {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  return element;
}

/** Задаёт позиционирование через `left`/`top`; используется тайлами и SVG-оверлеями. */
export function setPositionAbsolute(element, point) {
  element.style.left = `${Math.round(point.x)}px`;
  element.style.top = `${Math.round(point.y)}px`;
  return element;
}

/** Безопасно задаёт прозрачность элемента. */
export function setOpacity(element, opacity) {
  element.style.opacity = opacity === 0 || opacity ? String(opacity) : '';
  return element;
}

/** Отправляет событие DOM с необязательными данными. */
export function fireDOMEvent(element, type, data = null) {
  let event;
  try {
    event = new CustomEvent(type, { bubbles: true, cancelable: true, detail: data });
  } catch {
    event = document.createEvent('CustomEvent');
    event.initCustomEvent(type, true, true, data);
  }
  element.dispatchEvent(event);
  return event;
}

/** Регистрирует обработчик DOM и возвращает функцию отписки. */
export function on(element, types, handler, options = false) {
  for (const type of types.split(/\s+/).filter(Boolean)) {
    element.addEventListener(type, handler, options);
  }
  return () => off(element, types, handler, options);
}

/** Удаляет обработчик DOM. */
export function off(element, types, handler, options = false) {
  for (const type of types.split(/\s+/).filter(Boolean)) {
    element.removeEventListener(type, handler, options);
  }
}

export function stopPropagation(event) {
  if (event && event.stopPropagation) event.stopPropagation();
  return event;
}

export function preventDefault(event) {
  if (event && event.preventDefault) event.preventDefault();
  return event;
}

export function stop(event) {
  stopPropagation(event);
  return preventDefault(event);
}

/**
 * Вычисляет координаты указателя относительно контейнера с учётом границ
 * и смещений прокрутки.
 * @returns {{x:number,y:number}}
 */
export function getMousePosition(event, container) {
  const source = event.touches && event.touches.length ? event.touches[0] : event;
  const rect = container.getBoundingClientRect();
  const scaleX = container.offsetWidth ? rect.width / container.offsetWidth : 1;
  const scaleY = container.offsetHeight ? rect.height / container.offsetHeight : 1;
  return {
    x: (source.clientX - rect.left) / (scaleX || 1) - container.clientLeft + container.scrollLeft,
    y: (source.clientY - rect.top) / (scaleY || 1) - container.clientTop + container.scrollTop,
  };
}

/** Нормализует дельту колеса для разных браузеров и тачпадов. */
export function getWheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 40;
  if (event.deltaMode === 2) return event.deltaY * 800;
  return event.deltaY;
}

/** Проверяет, возникло ли событие внутри `container`. */
export function isInside(event, container) {
  return container.contains(event.target);
}

/** Отключает нативное выделение текста при перетаскивании. */
export function disableTextSelection() {
  document.documentElement.classList.add('sweety-dragging');
}

/** Возвращает нативное выделение текста. */
export function enableTextSelection() {
  document.documentElement.classList.remove('sweety-dragging');
}

/** Проверяет, является ли событие колеса жестом масштабирования (ctrl+колесо на тачпадах). */
export function isZoomWheelEvent(event) {
  return Boolean(event.ctrlKey || event.metaKey);
}

export { SVG_NS };
