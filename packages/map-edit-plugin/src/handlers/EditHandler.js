/**
 * Базовый обработчик жеста редактирования. Обработчики создаются на один жест,
 * хранят только его состояние и делегируют применение геометрии плагину.
 */
export class EditHandler {
  /** @param {import('../EditPlugin.js').EditPlugin} plugin */
  constructor(plugin) {
    this.plugin = plugin;
    this.map = plugin.map;
    this.active = false;
  }

  /**
   * @param {any} _handle
   * @param {PointerEvent} _event
   * @returns {this}
   */
  start(_handle, _event) {
    this.active = true;
    return this;
  }

  /** @param {PointerEvent} _event */
  move(_event) {}

  /** Завершает жест. */
  end() {
    this.active = false;
  }

  /** Прерывает жест без сохранения команды. */
  cancel() {
    this.active = false;
  }
}
