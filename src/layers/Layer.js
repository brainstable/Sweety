import { Evented } from '../core/Evented.js';
import { toLatLng } from '../core/LatLng.js';
import { Popup } from './Popup.js';
import { Tooltip } from './Tooltip.js';
import { fallbackLatLng } from './DivOverlay.js';
import { extend } from '../util/index.js';

/**
 * Абстрактный базовый класс для всех слоёв карты.
 *
 * Слой — это любой объект, который можно добавить на карту и который управляет
 * DOM-узлом или рендерером. Подклассы реализуют {@link onAdd} и {@link onRemove};
 * карта берёт на себя учёт жизненного цикла и всплытие событий.
 */
export class Layer extends Evented {
  /**
   * @param {object} [options]
   * @param {string} [options.pane] панель карты, используемая слоем
   * @param {string} [options.attribution] HTML-строка атрибуции
   */
  constructor(options = {}) {
    super();
    /** @type {object} */
    this.options = extend({}, options);
    /** @type {import('../core/Map.js').Map|null} */
    this._map = null;
    /** @type {HTMLElement|SVGElement|null} */
    this._container = null;
  }

  /**
   * Добавляет слой на карту.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  addTo(map) {
    if (!map) throw new TypeError('Layer.addTo expects a map');
    map.addLayer(this);
    return this;
  }

  /**
   * Удаляет слой с текущей карты.
   * @returns {this}
   */
  remove() {
    if (this._map) this._map.removeLayer(this);
    return this;
  }

  /**
   * Удаляет слой с указанной карты.
   * @param {import('../core/Map.js').Map} map
   * @returns {this}
   */
  removeFrom(map) {
    if (map) map.removeLayer(this);
    return this;
  }

  /**
   * Вызывается картой при добавлении слоя. Подклассы создают свой DOM.
   * @param {import('../core/Map.js').Map} map
   */
  onAdd(_map) {}

  /**
   * Вызывается картой при удалении слоя. Подклассы освобождают ресурсы.
   * @param {import('../core/Map.js').Map} map
   */
  onRemove(_map) {}

  /**
   * Возвращает панель: сначала запрошенную, затем настроенную у слоя, затем
   * панель оверлеев.
   * @param {string} [name]
   * @returns {HTMLElement|undefined}
   */
  getPane(name) {
    if (!this._map) return undefined;
    return this._map.getPane(name || this.options.pane || 'overlay');
  }

  /**
   * Текст атрибуции, связанный с этим слоем.
   * @returns {string|null}
   */
  getAttribution() {
    const value = this.options.attribution;
    return typeof value === 'function' ? value.call(this) : value || null;
  }

  /**
   * Задаёт z-index контейнера слоя.
   * @param {number} zIndex
   * @returns {this}
   */
  setZIndex(zIndex) {
    this.options.zIndex = zIndex;
    if (this._container) this._container.style.zIndex = String(zIndex);
    return this;
  }

  /**
   * Переносит контейнер слоя на передний план своей панели.
   * @returns {this}
   */
  bringToFront() {
    if (this._container && this._container.parentNode) {
      this._container.parentNode.appendChild(this._container);
    }
    return this;
  }

  /**
   * Отправляет контейнер слоя на задний план своей панели.
   * @returns {this}
   */
  bringToBack() {
    if (this._container && this._container.parentNode) {
      const parent = this._container.parentNode;
      parent.insertBefore(this._container, parent.firstChild);
    }
    return this;
  }

  /* ----------------------------------------------------------------------- *
   * Всплывающие окна
   * ----------------------------------------------------------------------- */

  /**
   * Привязывает всплывающее окно, открывающееся по клику на слой.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindPopup(content, options = {}) {
    if (!this._popup) {
      this._popup = new Popup(options);
      this._popup._source = this;
      this._popupClickHandler = (event) => this.openPopup(event.latlng);
      this._popupMoveHandler = () => this._syncPopup();
      this._popupRemoveHandler = () => this._popup?.close();
      this.on('click', this._popupClickHandler);
      this.on('move', this._popupMoveHandler);
      this.on('remove', this._popupRemoveHandler);
    } else {
      extend(this._popup.options, options);
    }
    this._popup.setContent(content);
    return this;
  }

  /**
   * Обновляет содержимое всплывающего окна без пересоздания привязки.
   * @param {string|HTMLElement|Function} content
   * @returns {this}
   */
  setPopupContent(content) {
    if (this._popup) this._popup.setContent(content);
    return this;
  }

  /**
   * Открывает привязанное всплывающее окно.
   * @param {import('../core/LatLng.js').LatLng|number[]} [latlng]
   * @returns {this}
   */
  openPopup(latlng) {
    if (!this._popup) return this;
    if (!this._map) {
      this.once('add', () => this.openPopup(latlng));
      return this;
    }
    const anchor = latlng ? toLatLng(latlng) : fallbackLatLng(this, this._map);
    this._popup.setLatLng(anchor);
    this._popup.openOn(this._map);
    return this;
  }

  /** Закрывает привязанное всплывающее окно. @returns {this} */
  closePopup() {
    this._popup?.close();
    return this;
  }

  /** Переключает привязанное всплывающее окно. @returns {this} */
  togglePopup() {
    if (!this._popup) return this;
    if (this.isPopupOpen()) this.closePopup();
    else this.openPopup();
    return this;
  }

  /** @returns {boolean} */
  isPopupOpen() {
    return Boolean(this._popup && this._popup.isOpen());
  }

  /** Удаляет привязку всплывающего окна. @returns {this} */
  unbindPopup() {
    if (!this._popup) return this;
    this._popup.close();
    this.off('click', this._popupClickHandler);
    this.off('move', this._popupMoveHandler);
    this.off('remove', this._popupRemoveHandler);
    this._popup = null;
    return this;
  }

  /** @returns {Popup|null} */
  getPopup() {
    return this._popup || null;
  }

  /** @private */
  _syncPopup() {
    if (this._popup && this._popup.isOpen() && this._map) {
      this._popup.setLatLng(fallbackLatLng(this, this._map));
    }
  }

  /* ----------------------------------------------------------------------- *
   * Всплывающие подсказки
   * ----------------------------------------------------------------------- */

  /**
   * Привязывает всплывающую подсказку, открывающуюся при наведении.
   * @param {string|HTMLElement|Function} content
   * @param {object} [options]
   * @returns {this}
   */
  bindTooltip(content, options = {}) {
    if (!this._tooltip) {
      this._tooltip = new Tooltip(options);
      this._tooltip._source = this;
      this._tooltipEnterHandler = () => this.openTooltip();
      this._tooltipLeaveHandler = () => {
        if (!this._tooltip.options.permanent) this.closeTooltip();
      };
      this._tooltipMoveHandler = () => this._syncTooltip();
      this._tooltipRemoveHandler = () => this._tooltip?.close();
      this._tooltipAddHandler = () => {
        if (this._tooltip.options.permanent) this.openTooltip();
      };
      this.on('mouseover', this._tooltipEnterHandler);
      this.on('mouseout', this._tooltipLeaveHandler);
      this.on('move', this._tooltipMoveHandler);
      this.on('remove', this._tooltipRemoveHandler);
      this.on('add', this._tooltipAddHandler);
    } else {
      extend(this._tooltip.options, options);
    }
    this._tooltip.setContent(content);
    if (this._tooltip.options.permanent && this._map) this.openTooltip();
    return this;
  }

  /**
   * Открывает привязанную всплывающую подсказку.
   * @param {import('../core/LatLng.js').LatLng|number[]} [latlng]
   * @returns {this}
   */
  openTooltip(latlng) {
    if (!this._tooltip) return this;
    if (!this._map) {
      this.once('add', () => this.openTooltip(latlng));
      return this;
    }
    const anchor = latlng ? toLatLng(latlng) : fallbackLatLng(this, this._map);
    this._tooltip.setLatLng(anchor);
    this._tooltip.openOn(this._map);
    return this;
  }

  /** Закрывает привязанную всплывающую подсказку. @returns {this} */
  closeTooltip() {
    this._tooltip?.close();
    return this;
  }

  /** Переключает привязанную всплывающую подсказку. @returns {this} */
  toggleTooltip() {
    if (!this._tooltip) return this;
    if (this.isTooltipOpen()) this.closeTooltip();
    else this.openTooltip();
    return this;
  }

  /** @returns {boolean} */
  isTooltipOpen() {
    return Boolean(this._tooltip && this._tooltip.isOpen());
  }

  /** Удаляет привязку всплывающей подсказки. @returns {this} */
  unbindTooltip() {
    if (!this._tooltip) return this;
    this._tooltip.close();
    this.off('mouseover', this._tooltipEnterHandler);
    this.off('mouseout', this._tooltipLeaveHandler);
    this.off('move', this._tooltipMoveHandler);
    this.off('remove', this._tooltipRemoveHandler);
    this.off('add', this._tooltipAddHandler);
    this._tooltip = null;
    return this;
  }

  /** @returns {Tooltip|null} */
  getTooltip() {
    return this._tooltip || null;
  }

  /** @private */
  _syncTooltip() {
    if (this._tooltip && this._tooltip.isOpen() && this._map) {
      this._tooltip.setLatLng(fallbackLatLng(this, this._map));
    }
  }
}
