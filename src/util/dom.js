/**
 * DOM helpers. Kept deliberately small so the core stays framework-agnostic.
 * @module util/dom
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an HTML element.
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
 * Create an SVG element in the SVG namespace.
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

/** Add one or more whitespace-separated classes. */
export function addClass(element, className) {
  for (const name of className.split(/\s+/).filter(Boolean)) {
    if (!element.classList.contains(name)) element.classList.add(name);
  }
  return element;
}

/** Remove one or more whitespace-separated classes. */
export function removeClass(element, className) {
  for (const name of className.split(/\s+/).filter(Boolean)) {
    element.classList.remove(name);
  }
  return element;
}

/** Toggle a class, optionally forcing state. */
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

/** Whether an element has a class. */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/** Empty an element without replacing it. */
export function empty(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
  return element;
}

/** Remove an element from the document when attached. */
export function remove(element) {
  if (element && element.parentNode) element.parentNode.removeChild(element);
  return element;
}

/** Set inline transform position using GPU-friendly translate3d. */
export function setPosition(element, point) {
  const x = Math.round(point.x);
  const y = Math.round(point.y);
  element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  return element;
}

/** Set `left`/`top` positioning, used by tiles and SVG overlays. */
export function setPositionAbsolute(element, point) {
  element.style.left = `${Math.round(point.x)}px`;
  element.style.top = `${Math.round(point.y)}px`;
  return element;
}

/** Set element opacity safely. */
export function setOpacity(element, opacity) {
  element.style.opacity = opacity === 0 || opacity ? String(opacity) : '';
  return element;
}

/** Dispatch a DOM event with optional details. */
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

/** Register a DOM listener and return an unsubscribe function. */
export function on(element, types, handler, options = false) {
  for (const type of types.split(/\s+/).filter(Boolean)) {
    element.addEventListener(type, handler, options);
  }
  return () => off(element, types, handler, options);
}

/** Unregister a DOM listener. */
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
 * Resolve pointer coordinates relative to a container, accounting for
 * borders and scroll offsets.
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

/** Normalize wheel delta across browsers and trackpads. */
export function getWheelDelta(event) {
  if (event.deltaMode === 1) return event.deltaY * 40;
  if (event.deltaMode === 2) return event.deltaY * 800;
  return event.deltaY;
}

/** Whether an event originated inside `container`. */
export function isInside(event, container) {
  return container.contains(event.target);
}

/** Disable native text selection while dragging. */
export function disableTextSelection() {
  document.documentElement.classList.add('sweety-dragging');
}

/** Restore native text selection. */
export function enableTextSelection() {
  document.documentElement.classList.remove('sweety-dragging');
}

/** Test whether a wheel event is pinch-style (ctrl+wheel on trackpads). */
export function isZoomWheelEvent(event) {
  return Boolean(event.ctrlKey || event.metaKey);
}

export { SVG_NS };
