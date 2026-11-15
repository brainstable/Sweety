import { Layer } from './Layer.js';
import { toLatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { defaultIcon } from './Marker.Icon.js';
import { addClass, getMousePosition, off, on, removeClass, setPosition } from '../util/dom.js';
import { extend } from '../util/index.js';

const DEFAULT_OPTIONS = {
  icon: null,
  draggable: false,
  keyboard: true,
  title: '',
  alt: 'Marker',
  zIndexOffset: 0,
  opacity: 1,
  riseOnHover: false,
  riseOffset: 250,
  pane: 'marker',
  shadowPane: 'shadow',
  autoPan: false,
  interactive: true,
};

/**
 * Географический маркер с растровыми или HTML-иконками, DOM-событиями,
 * доступом с клавиатуры и необязательным перетаскиванием указателем.
 */
export class Marker extends Layer {
  /**
   * @param {LatLng|number[]} latlng
   * @param {object} [options]
   */
  constructor(latlng, options = {}) {
    super(extend({}, DEFAULT_OPTIONS, options));
    this._latlng = toLatLng(latlng);
    this._icon = this.options.icon || defaultIcon;
    this._dragging = false;
    this._dragged = false;
    this._onIconEvent = (event) => this._handleIconEvent(event);
    this._onKeyDown = (event) => this._handleKeyDown(event);
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._initIcon();
    this._update();
    if (this.options.draggable) this._initDrag();
    map.getPane(this.options.pane || 'marker').appendChild(this._iconElement);
    if (this._shadowElement) map.getPane(this.options.shadowPane).appendChild(this._shadowElement);
    this._bindIconEvents();
  }

  /** */
  onRemove() {
    this._detachDrag();
    this._unbindIconEvents();
    this._iconElement?.remove();
    this._shadowElement?.remove();
    this._iconElement = null;
    this._shadowElement = null;
  }

  /** @private */
  _initIcon() {
    const container = document.createElement('div');
    container.className = 'sweety-marker sweety-interactive';
    if (this.options.draggable) addClass(container, 'sweety-marker-draggable');
    if (this.options.keyboard) container.tabIndex = 0;
    if (this.options.interactive) container.setAttribute('role', 'button');
    if (this.options.title) container.title = this.options.title;
    if (this.options.alt) container.setAttribute('aria-label', this.options.alt);
    if (this.options.riseOnHover) {
      container.addEventListener('mouseover', () => {
        container.style.zIndex = String(this._zIndex + this.options.riseOffset);
      });
      container.addEventListener('mouseout', () => {
        container.style.zIndex = String(this._zIndex);
      });
    }

    const icon = this._icon.createIcon();
    icon.alt = this.options.alt || '';
    container.appendChild(icon);
    this._iconElement = container;
    this._iconImage = icon;

    const shadow = this._icon.createShadow();
    const shadowContainer = shadow ? document.createElement('div') : null;
    if (shadowContainer) {
      shadowContainer.className = 'sweety-marker sweety-marker-shadow';
      shadowContainer.appendChild(shadow);
      this._shadowElement = shadowContainer;
    }
  }

  /** @private */
  _bindIconEvents() {
    if (!this._iconElement || !this.options.interactive) return;
    for (const type of [
      'click',
      'dblclick',
      'contextmenu',
      'mousedown',
      'mouseup',
      'mouseover',
      'mouseout',
    ]) {
      on(this._iconElement, type, this._onIconEvent);
    }
    on(this._iconElement, 'keydown', this._onKeyDown);
  }

  /** @private */
  _unbindIconEvents() {
    if (!this._iconElement) return;
    for (const type of [
      'click',
      'dblclick',
      'contextmenu',
      'mousedown',
      'mouseup',
      'mouseover',
      'mouseout',
    ]) {
      off(this._iconElement, type, this._onIconEvent);
    }
    off(this._iconElement, 'keydown', this._onKeyDown);
  }

  /** @private */
  _handleIconEvent(event) {
    if (!this._map) return;
    if (this._dragged && (event.type === 'click' || event.type === 'mousedown')) {
      event.stopPropagation();
      return;
    }

    const point = this._map.latLngToContainerPoint(this._latlng);
    this.fire(event.type, {
      originalEvent: event,
      latlng: this._latlng.clone(),
      layerPoint: point,
      containerPoint: point,
    });

    if (event.type === 'click' || event.type === 'dblclick' || event.type === 'contextmenu') {
      event.stopPropagation();
    }
  }

  /** @private */
  _handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      this.fire('click', {
        originalEvent: event,
        latlng: this._latlng.clone(),
        layerPoint: this._map.latLngToContainerPoint(this._latlng),
        containerPoint: this._map.latLngToContainerPoint(this._latlng),
        keyboard: true,
      });
    }
  }

  /**
   * Пересчитывает экранную позицию маркера и его z-index.
   * @private
   */
  _update() {
    if (!this._map || !this._iconElement) return;
    const point = this._map.latLngToLayerPoint(this._latlng);
    setPosition(this._iconElement, point);
    if (this._shadowElement) setPosition(this._shadowElement, point);
    this._zIndex = Math.round(point.y) + Number(this.options.zIndexOffset || 0);
    this._iconElement.style.zIndex = String(this._zIndex);
    this._iconElement.style.opacity = String(this.options.opacity);
    if (this._shadowElement) {
      this._shadowElement.style.zIndex = String(this._zIndex - 1);
      this._shadowElement.style.opacity = String(this.options.opacity);
    }
  }

  /**
   * Перемещает маркер.
   * @param {LatLng|number[]} latlng
   * @returns {this}
   */
  setLatLng(latlng) {
    const next = toLatLng(latlng);
    const old = this._latlng;
    this._latlng = next;
    this._update();
    this.fire('move', { latlng: next.clone(), oldLatLng: old });
    return this;
  }

  /** @returns {LatLng} */
  getLatLng() {
    return this._latlng.clone();
  }

  /**
   * Заменяет иконку.
   * @param {import('./Marker.Icon.js').Icon} icon
   * @returns {this}
   */
  setIcon(icon) {
    if (!icon) throw new TypeError('setIcon expects an Icon instance');
    this._icon = icon;
    if (this._map) {
      this._unbindIconEvents();
      this._detachDrag();
      const oldElement = this._iconElement;
      const oldShadow = this._shadowElement;
      this._initIcon();
      this._update();
      this._map.getPane(this.options.pane || 'marker').appendChild(this._iconElement);
      if (this._shadowElement) {
        this._map.getPane(this.options.shadowPane).appendChild(this._shadowElement);
      }
      this._bindIconEvents();
      if (this.options.draggable) {
        this._dragBound = false;
        this._initDrag();
      }
      oldElement?.remove();
      oldShadow?.remove();
    }
    return this;
  }

  /**
   * Меняет смещение маркера в порядке наложения.
   * @param {number} offset
   * @returns {this}
   */
  setZIndexOffset(offset) {
    this.options.zIndexOffset = Number(offset) || 0;
    this._update();
    return this;
  }

  /**
   * @param {number} opacity
   * @returns {this}
   */
  setOpacity(opacity) {
    this.options.opacity = Math.max(0, Math.min(1, Number(opacity)));
    this._update();
    return this;
  }

  /**
   * Включает или выключает перетаскивание во время работы.
   * @param {boolean} draggable
   * @returns {this}
   */
  setDraggable(draggable) {
    const next = Boolean(draggable);
    if (next === this.options.draggable) return this;
    this.options.draggable = next;
    if (!this._iconElement) return this;
    if (next) {
      addClass(this._iconElement, 'sweety-marker-draggable');
      this._initDrag();
    } else {
      removeClass(this._iconElement, 'sweety-marker-draggable');
      this._detachDrag();
    }
    return this;
  }

  /** @returns {boolean} */
  isDraggable() {
    return Boolean(this.options.draggable && this._iconElement);
  }

  /** @returns {HTMLElement|null} */
  getElement() {
    return this._iconElement || null;
  }

  /**
   * Представление маркера в формате GeoJSON.
   * @returns {object}
   */
  toGeoJSON() {
    const coordinates = [this._latlng.lng, this._latlng.lat];
    if (this._latlng.alt) coordinates.push(this._latlng.alt);
    return {
      type: 'Feature',
      properties: this.feature?.properties ? { ...this.feature.properties } : {},
      geometry: { type: 'Point', coordinates },
    };
  }

  /** @private */
  _initDrag() {
    if (!this._iconElement || this._dragBound) return;
    this._dragBound = true;
    this._onDragStart = (event) => this._handleDragStart(event);
    this._onDragMove = (event) => this._handleDragMove(event);
    this._onDragEnd = (event) => this._handleDragEnd(event);
    on(this._iconElement, 'pointerdown', this._onDragStart);
  }

  /** @private */
  _detachDrag() {
    if (!this._dragBound) return;
    off(this._iconElement, 'pointerdown', this._onDragStart);
    off(document, 'pointermove', this._onDragMove);
    off(document, 'pointerup pointercancel', this._onDragEnd);
    this._dragBound = false;
    this._dragging = false;
  }

  /** @private */
  _handleDragStart(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this._map._pinching) return;
    event.stopPropagation();
    event.preventDefault();
    this._dragging = true;
    this._dragged = false;
    this._dragStartPoint = new Point(getMousePosition(event, this._map.getContainer()));
    this._dragStartLatLng = this._latlng.clone();
    on(document, 'pointermove', this._onDragMove, { passive: false });
    on(document, 'pointerup pointercancel', this._onDragEnd);
  }

  /** @private */
  _handleDragMove(event) {
    if (!this._dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const point = new Point(getMousePosition(event, this._map.getContainer()));
    const delta = point.subtract(this._dragStartPoint);
    if (!this._dragged && delta.distanceTo(new Point(0, 0)) < 2) return;
    if (!this._dragged) {
      this._dragged = true;
      this.fire('dragstart', {
        originalEvent: event,
        latlng: this._latlng.clone(),
      });
    }

    const startPoint = this._map.latLngToContainerPoint(this._dragStartLatLng);
    const latlng = this._map.containerPointToLatLng(startPoint.add(delta));
    this._latlng = latlng;
    this._update();
    this.fire('drag', { originalEvent: event, latlng: latlng.clone() });
  }

  /** @private */
  _handleDragEnd(event) {
    if (!this._dragging) return;
    this._dragging = false;
    off(document, 'pointermove', this._onDragMove);
    off(document, 'pointerup pointercancel', this._onDragEnd);
    event.stopPropagation();
    if (this._dragged) {
      this._map._suppressClick();
      this.fire('dragend', {
        originalEvent: event,
        latlng: this._latlng.clone(),
      });
    }
    setTimeout(() => {
      this._dragged = false;
    }, 0);
  }
}
