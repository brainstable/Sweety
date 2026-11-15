/**
 * Стек команд для undo/redo. Ограничен по размеру, чтобы долгая сессия не
 * удерживала неограниченное число снимков геометрии.
 */
export class CommandStack {
  /** @param {{limit?: number}} [options] */
  constructor({ limit = 100 } = {}) {
    /** @type {number} */
    this.limit = Math.max(1, Number(limit) || 100);
    /** @type {import('./Command.js').Command[]} */
    this._undoStack = [];
    /** @type {import('./Command.js').Command[]} */
    this._redoStack = [];
  }

  /** @returns {number} */
  get undoLength() {
    return this._undoStack.length;
  }

  /** @returns {number} */
  get redoLength() {
    return this._redoStack.length;
  }

  /** @returns {boolean} */
  canUndo() {
    return this._undoStack.length > 0;
  }

  /** @returns {boolean} */
  canRedo() {
    return this._redoStack.length > 0;
  }

  /**
   * Добавляет команду. По умолчанию сразу выполняет её; для уже применённых
   * изменений (drag, draw) передайте `apply: false`.
   * @param {import('./Command.js').Command} command
   * @param {{apply?: boolean}} [options]
   * @returns {import('./Command.js').Command}
   */
  push(command, { apply = true } = {}) {
    if (!command) throw new TypeError('CommandStack.push expects a command');
    if (apply) command.execute();
    this._undoStack.push(command);
    if (this._undoStack.length > this.limit) this._undoStack.shift();
    this._redoStack.length = 0;
    return command;
  }

  /**
   * @returns {import('./Command.js').Command|null}
   */
  undo() {
    const command = this._undoStack.pop();
    if (!command) return null;
    try {
      command.undo();
    } catch (error) {
      this._undoStack.push(command);
      throw error;
    }
    this._redoStack.push(command);
    return command;
  }

  /**
   * @returns {import('./Command.js').Command|null}
   */
  redo() {
    const command = this._redoStack.pop();
    if (!command) return null;
    try {
      command.execute();
    } catch (error) {
      this._redoStack.push(command);
      throw error;
    }
    this._undoStack.push(command);
    return command;
  }

  clear() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  /** @returns {import('./Command.js').Command[]} */
  getUndoStack() {
    return this._undoStack.slice();
  }

  /** @returns {import('./Command.js').Command[]} */
  getRedoStack() {
    return this._redoStack.slice();
  }
}
