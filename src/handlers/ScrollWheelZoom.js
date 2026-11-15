import { Handler } from '../core/Handler.js';
import { getMousePosition, getWheelDelta, off, on, preventDefault } from '../util/dom.js';
import { requestAnimFrame } from '../util/index.js';

/**
 * Масштабирование колесом мыши и тачпадом. Приращения колеса накапливаются и
 * применяются после короткой задержки, поэтому один жест даёт один предсказуемый
 * шаг масштаба вместо серии анимаций.
 */
export class ScrollWheelZoom extends Handler {
  /** @private */
  _enable() {
    this._onWheel = (event) => this._handleWheel(event);
    on(this._map.getContainer(), 'wheel', this._onWheel, { passive: false });
  }

  /** @private */
  _disable() {
    off(this._map.getContainer(), 'wheel', this._onWheel);
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._delta = 0;
    this._point = null;
    this._startZoom = null;
  }

  /** @private */
  _handleWheel(event) {
    if (event._sweetyStopped || this._map._animatingZoom) return;
    preventDefault(event);

    const point = getMousePosition(event, this._map.getContainer());
    const delta = getWheelDelta(event);
    if (!delta) return;

    // Браузеры сообщают очень малые приращения при жесте «щипок» на тачпаде.
    // Нормируем их, чтобы взаимодействие ощущалось так же, как с колесом мыши.
    const normalised = event.ctrlKey ? delta * 10 : delta;
    this._delta = (this._delta || 0) + normalised;
    this._point = point;
    if (this._startZoom === null || this._startZoom === undefined) {
      this._startZoom = this._map.getZoom();
    }

    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      requestAnimFrame(() => this._performZoom());
    }, this._map.options.wheelDebounceTime);
  }

  /** @private */
  _performZoom() {
    if (!this._point || !this._delta) return;
    const options = this._map.options;
    const pxPerLevel = Number(options.wheelPxPerZoomLevel) || 60;
    const delta = this._delta;
    const point = this._point;
    const startZoom = this._startZoom ?? this._map.getZoom();

    this._delta = 0;
    this._point = null;
    this._startZoom = null;

    const targetZoom = this._map._limitZoom(
      startZoom - (delta / pxPerLevel) * (Number(options.zoomDelta) || 1),
    );
    if (targetZoom === this._map.getZoom()) return;

    this._map.setZoomAroundPoint(point, targetZoom, {
      animate: options.zoomAnimation !== false,
      zoomAnchor: point,
    });
  }
}
