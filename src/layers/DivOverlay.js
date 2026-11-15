import { Evented } from '../core/Evented.js';
import { LatLng, toLatLng } from '../core/LatLng.js';
import { Point } from '../core/Point.js';
import { create, empty, on, setOpacity } from '../util/dom.js';
import { extend } from '../util/index.js';

const DEFAULT_OPTIONS = {
  pane: 'popup',
  offset: [0, 0],
  className: '',
  autoPan: true,
  autoPanPadding: [20, 20],
  keepInView: false,
  closeButton: true,
  autoClose: true,
  closeOnEscapeKey: true,
  interactive: true,
  maxWidth: 300,
  minWidth: 50,
  maxHeight: null,
  direction: 'auto',
  opacity: 1,
};

/**
 * Общая реализация для всплывающих окон и подсказок. Оверлеи — не слои в смысле
 * тайлов и векторов, а легковесные эмиттеры событий, которым принадлежит узел
 * панели; они следуют за географическим якорем.
 */
export class DivOverlay extends Evented {
  /** @param {object} [options] */
  constructor(options = {}) {
    super();
    this.options = extend({}, DEFAULT_OPTIONS, options);
    this._map = null;
    this._source = null;
    this._latlng = null;
    this._content = '';
    this._container = null;
    this._contentNode = null;
    this._open = false;
    this._kind = 'popup';
    this._placement = 'top';
    this._lastMap = null;
    this._onMapClick = (event) => {
      if (!this.options.autoClose) return;
      if (event.sourceTarget !== this._map) return;
      this.close();
    };
    this._onEscape = (event) => {
      if (event.key === 'Escape' && this.options.closeOnEscapeKey) this.close();
    };
    this._onMapUnload = () => this.close();
    this._onViewChange = () => this._updatePosition();
  }

  /**
   * Задаёт HTML, DOM-узел или функцию, возвращающую то или другое.
   * @param {string|HTMLElement|Function} content
   * @returns {this}
   */
  setContent(content) {
    this._content = content;
    if (this._container) this._renderContent();
    return this;
  }

  /** @returns {string|HTMLElement|Function} */
  getContent() {
    return this._content;
  }

  /**
   * Задаёт географическую привязку.
   * @param {LatLng|number[]} latlng
   * @returns {this}
   */
  setLatLng(latlng) {
    this._latlng = toLatLng(latlng);
    if (this._open) this._updatePosition();
    return this;
  }

  /** @returns {LatLng|null} */
  getLatLng() {
    return this._latlng ? this._latlng.clone() : null;
  }

  /** @returns {HTMLElement|null} */
  getElement() {
    return this._container;
  }

  /**
   * Открывает оверлей на карте.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  openOn(map) {
    if (!map) throw new TypeError('openOn expects a map');
    if (this._open && this._map === map) {
      this._updatePosition();
      return this;
    }
    if (this._open) this.close();

    this._map = map;
    this._lastMap = map;
    const slot = this._kind === 'tooltip' ? '_tooltip' : '_popup';
    if (map[slot] && map[slot] !== this) map[slot].close();
    map[slot] = this;

    this._initLayout();
    this._renderContent();
    this._container.style.display = '';
    map.getPane(this.options.pane).appendChild(this._container);
    this._open = true;

    map.on('move zoom resize', this._onViewChange);
    if (this.options.autoClose) map.on('click', this._onMapClick);
    map.on('unload', this._onMapUnload);
    if (this.options.closeOnEscapeKey) document.addEventListener('keydown', this._onEscape);

    this._updatePosition();
    if (this._source && typeof this._source.fire === 'function') {
      this._source.fire(`${this._kind}open`, { [this._kind]: this }, false);
    }
    map.fire(`${this._kind}open`, { [this._kind]: this, layer: this._source }, false);
    this.fire('open', { [this._kind]: this }, false);

    if (this.options.autoPan && this._latlng) {
      map.panInside(this._latlng, { padding: this.options.autoPanPadding, animate: true });
    }
    return this;
  }

  /**
   * Открывает на карте; псевдоним для {@link openOn}.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  addTo(map) {
    return this.openOn(map);
  }

  /** Закрывает оверлей. @returns {this} */
  close() {
    if (!this._open) return this;
    const map = this._map;
    this._open = false;

    map.off('move zoom resize', this._onViewChange);
    map.off('click', this._onMapClick);
    map.off('unload', this._onMapUnload);
    document.removeEventListener('keydown', this._onEscape);
    this._container?.remove();

    const slot = this._kind === 'tooltip' ? '_tooltip' : '_popup';
    if (map[slot] === this) map[slot] = null;

    if (this._source && typeof this._source.fire === 'function') {
      this._source.fire(`${this._kind}close`, { [this._kind]: this }, false);
    }
    map.fire(`${this._kind}close`, { [this._kind]: this, layer: this._source }, false);
    this.fire('close', { [this._kind]: this }, false);
    this._map = null;
    return this;
  }

  /** Удаляет с карты. @returns {this} */
  remove() {
    return this.close();
  }

  /** Переключает состояние открытия. @returns {this} */
  toggle() {
    if (this._open) return this.close();
    const map = this._map || this._lastMap;
    return map ? this.openOn(map) : this;
  }

  /** @returns {boolean} */
  isOpen() {
    return this._open;
  }

  /** Перерисовывает содержимое и положение. @returns {this} */
  update() {
    if (!this._open) return this;
    this._renderContent();
    this._updatePosition();
    return this;
  }

  /** @private */
  _initLayout() {
    if (!this._container) {
      this._container = create(
        'div',
        `sweety-${this._kind} ${this.options.className || ''}`.trim(),
      );
      this._container.style.position = 'absolute';
      this._container.style.maxWidth =
        typeof this.options.maxWidth === 'number'
          ? `${this.options.maxWidth}px`
          : this.options.maxWidth;
      this._container.style.minWidth =
        typeof this.options.minWidth === 'number'
          ? `${this.options.minWidth}px`
          : this.options.minWidth;
      if (this.options.maxHeight) {
        this._container.style.maxHeight = `${this.options.maxHeight}px`;
        this._container.style.overflowY = 'auto';
      }
      if (this._kind === 'tooltip' && !this.options.interactive) {
        this._container.style.pointerEvents = 'none';
      }

      this._contentNode = create('div', `sweety-${this._kind}-content`, this._container);

      if (this._kind === 'popup' && this.options.closeButton) {
        const close = create('button', 'sweety-popup-close', this._container);
        close.type = 'button';
        close.setAttribute('aria-label', 'Close popup');
        close.innerHTML = '&times;';
        on(close, 'click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.close();
        });
      }
    }
    setOpacity(this._container, this.options.opacity);
  }

  /** @private */
  _renderContent() {
    if (!this._contentNode) return;
    empty(this._contentNode);
    const content =
      typeof this._content === 'function' ? this._content(this._source || this) : this._content;
    if (content instanceof Node) {
      this._contentNode.appendChild(content);
    } else {
      this._contentNode.innerHTML =
        content === undefined || content === null ? '' : String(content);
    }
  }

  /** @private */
  _updatePosition() {
    if (!this._map || !this._container || !this._latlng) return;
    const point = this._map.latLngToContainerPoint(this._latlng);
    const offset = Array.isArray(this.options.offset)
      ? new Point(this.options.offset)
      : new Point(this.options.offset || 0, 0);
    const placement = this._choosePlacement(point);

    this._container.className =
      `sweety-${this._kind} sweety-${this._kind}-${placement} ${this.options.className || ''}`.trim();
    this._placement = placement;

    let left = point.x + offset.x;
    let top = point.y + offset.y;
    let transform = 'translate(-50%, -100%)';
    if (placement === 'bottom') transform = 'translate(-50%, 0)';
    else if (placement === 'left') transform = 'translate(-100%, -50%)';
    else if (placement === 'right') transform = 'translate(0, -50%)';
    else if (placement === 'center') transform = 'translate(-50%, -50%)';

    if (this.options.keepInView) {
      const padding = 8;
      if (left < padding) left = padding;
      if (left > this._map.getSize().x - padding) left = this._map.getSize().x - padding;
      if (top < padding) top = padding;
      if (top > this._map.getSize().y - padding) top = this._map.getSize().y - padding;
    }

    this._container.style.left = `${Math.round(left)}px`;
    this._container.style.top = `${Math.round(top)}px`;
    this._container.style.transform = transform;
    this._container.style.zIndex = String(this._kind === 'tooltip' ? 650 : 700);
  }

  /** @private */
  _choosePlacement(point) {
    let placement = this.options.direction || 'auto';
    if (placement === 'auto') {
      placement = point.y < 100 ? 'bottom' : 'top';
    }
    return ['top', 'bottom', 'left', 'right', 'center'].includes(placement) ? placement : 'top';
  }
}

/** Вспомогательная резервная привязка для подклассов, когда у источника нет координат. */
export function fallbackLatLng(source, map) {
  if (source) {
    if (typeof source.getLatLng === 'function') return source.getLatLng();
    if (typeof source.getCenter === 'function') return source.getCenter();
    if (typeof source.getBounds === 'function') {
      const bounds = source.getBounds();
      if (bounds && bounds.isValid()) return bounds.getCenter();
    }
  }
  return map ? map.getCenter() : new LatLng(0, 0);
}
