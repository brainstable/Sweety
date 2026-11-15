import { Handler } from '../core/Handler.js';
import { Point } from '../core/Point.js';
import { getMousePosition, off, on, preventDefault } from '../util/dom.js';
import { clamp } from '../util/index.js';

/**
 * Масштабирование жестом «щипок» двумя пальцами. Позиции указателей хранятся
 * в собственном реестре, чтобы жест продолжался при выходе указателей за
 * пределы контейнера.
 */
export class TouchZoom extends Handler {
  constructor(map) {
    super(map);
    this._pointers = new globalThis.Map();
    this._startDistance = 0;
    this._startZoom = 0;
    this._startPoint = null;
    this._startLatLng = null;
    this._pinching = false;
  }

  /** @private */
  _enable() {
    this._onPointerDown = (event) => this._handlePointerDown(event);
    this._onPointerMove = (event) => this._handlePointerMove(event);
    this._onPointerUp = (event) => this._handlePointerUp(event);
    on(this._map.getContainer(), 'pointerdown', this._onPointerDown);
  }

  /** @private */
  _disable() {
    off(this._map.getContainer(), 'pointerdown', this._onPointerDown);
    this._detach();
    this._endPinch();
  }

  /** @private */
  _handlePointerDown(event) {
    if (event.pointerType !== 'touch') return;
    if (event.pointerId === undefined) return;
    this._pointers.set(
      event.pointerId,
      new Point(getMousePosition(event, this._map.getContainer())),
    );
    if (this._pointers.size === 2 && !this._pinching) this._beginPinch(event);
  }

  /** @private */
  _beginPinch(event) {
    const points = [...this._pointers.values()];
    this._startDistance = points[0].distanceTo(points[1]);
    if (this._startDistance < 10) return;

    this._pinching = true;
    this._map._pinching = true;
    this._startZoom = this._map.getZoom();
    this._startPoint = this._midpoint(points);
    this._startLatLng = this._map.containerPointToLatLng(this._startPoint);
    this._map._moveStart(true);

    // Перетаскивание одним пальцем могло уже начаться; корректно завершаем его.
    if (this._map.dragging && this._map.dragging._dragging) {
      this._map.dragging._finishDrag(event);
      this._map._moveEnd(false);
    }

    on(document, 'pointermove', this._onPointerMove, { passive: false });
    on(document, 'pointerup pointercancel', this._onPointerUp);
    this._map.fire('pinchstart', {
      originalEvent: event,
      latlng: this._startLatLng,
      scale: 1,
    });
  }

  /** @private */
  _handlePointerMove(event) {
    if (!this._pointers.has(event.pointerId)) return;
    this._pointers.set(
      event.pointerId,
      new Point(getMousePosition(event, this._map.getContainer())),
    );
    if (!this._pinching || this._pointers.size < 2) return;

    preventDefault(event);
    const points = [...this._pointers.values()];
    const distance = points[0].distanceTo(points[1]);
    const midpoint = this._midpoint(points);
    const scale = distance / this._startDistance;
    const targetZoom = this._map._limitZoom(this._startZoom + Math.log2(scale));

    // Удерживаем географическую точку под начальной серединой щипка привязанной
    // к текущей середине при движении пальцев.
    if (targetZoom !== this._map.getZoom() || !midpoint.equals(this._startPoint)) {
      const world = this._map
        .project(this._startLatLng, targetZoom)
        .subtract(midpoint)
        .add(this._map.getSize().divideBy(2));
      this._map._resetView(this._map.unproject(world, targetZoom), targetZoom, { reset: false });
      this._startPoint = midpoint;
    }

    this._map.fire('pinch', {
      originalEvent: event,
      latlng: this._startLatLng,
      scale: clamp(scale, 0.1, 20),
    });
  }

  /** @private */
  _handlePointerUp(event) {
    if (!this._pointers.has(event.pointerId)) return;
    this._pointers.delete(event.pointerId);
    if (this._pinching) this._endPinch(event);
  }

  /** @private */
  _endPinch(event) {
    if (!this._pinching) {
      this._pointers.clear();
      this._detach();
      return;
    }
    this._pinching = false;
    this._map._pinching = false;
    this._pointers.clear();
    this._detach();
    this._map._suppressClick();
    this._map.fire('pinchend', { originalEvent: event, latlng: this._map.getCenter() });
    this._map._moveEnd(true);
  }

  /** @private */
  _detach() {
    off(document, 'pointermove', this._onPointerMove);
    off(document, 'pointerup pointercancel', this._onPointerUp);
  }

  /** @private */
  _midpoint(points) {
    return new Point((points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2);
  }
}
