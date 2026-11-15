import { Handler } from '../core/Handler.js';
import { getMousePosition, off, on, preventDefault } from '../util/dom.js';

/** Double-click zoom, anchored at the cursor. */
export class DoubleClickZoom extends Handler {
  /** @private */
  _enable() {
    this._onDoubleClick = (event) => this._handleDoubleClick(event);
    on(this._map.getContainer(), 'dblclick', this._onDoubleClick);
  }

  /** @private */
  _disable() {
    off(this._map.getContainer(), 'dblclick', this._onDoubleClick);
  }

  /** @private */
  _handleDoubleClick(event) {
    if (event._sweetyStopped || this._map._animatingZoom) return;
    const target = event.target;
    if (
      target &&
      target.closest &&
      target.closest('.sweety-control, .sweety-popup, .sweety-tooltip')
    ) {
      return;
    }

    preventDefault(event);
    const point = getMousePosition(event, this._map.getContainer());
    const targetZoom = this._map._limitZoom(this._map.getZoom() + this._map.options.zoomDelta);
    if (targetZoom === this._map.getZoom()) return;

    this._map.setZoomAroundPoint(point, targetZoom, {
      animate: this._map.options.zoomAnimation !== false,
      zoomAnchor: point,
    });
  }
}
