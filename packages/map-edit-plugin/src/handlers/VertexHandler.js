import { EditHandler } from './EditHandler.js';

/**
 * Перетаскивание одной вершины (а также центра/радиуса круга и угла
 * прямоугольника). Вся геометрия и команда живут в плагине, обработчик лишь
 * управляет жизненным циклом жеста.
 */
export class VertexHandler extends EditHandler {
  /**
   * @param {any} handle
   * @param {PointerEvent} event
   * @returns {this}
   */
  start(handle, event) {
    if (this.active) this.cancel();
    this.active = true;
    this.handle = handle;
    this.plugin._beginVertexDrag(handle, event);
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
    this.plugin._finishHandleDrag();
  }

  cancel() {
    this.active = false;
    this.plugin._cancelActiveDrag(true);
  }
}
