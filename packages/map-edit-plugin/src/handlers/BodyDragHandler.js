import { EditHandler } from './EditHandler.js';

/**
 * Перетаскивание тела выбранной геометрии. Для группы двигает все части, для
 * маркера/круга/прямоугольника — соответствующий снимок.
 */
export class BodyDragHandler extends EditHandler {
  /**
   * @param {any} session
   * @param {PointerEvent} event
   * @returns {this}
   */
  start(session, event) {
    if (this.active) this.cancel();
    this.active = true;
    this.session = session;
    this.plugin._beginBodyDrag(session, event);
    return this;
  }

  /** @param {PointerEvent} event */
  move(event) {
    if (!this.active) return;
    this.plugin._processPointerMove(event);
  }

  end() {
    if (!this.active) return;
    this.active = false;
    this.plugin._finishBodyDrag();
  }

  cancel() {
    this.active = false;
    this.plugin._cancelActiveDrag(true);
  }
}
