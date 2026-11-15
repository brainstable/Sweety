/**
 * Режимы редактора. Редактор — конечный автомат: `idle` не реагирует на клики,
 * `select` выбирает объекты, `edit` показывает вершины, `create` рисует новую
 * геометрию, `delete` удаляет объекты по клику.
 *
 * @module EditMode
 */

/** @typedef {'idle'|'select'|'edit'|'create'|'delete'} EditModeName */

/** @type {EditModeName[]} */
export const EDIT_MODES = ['idle', 'select', 'edit', 'create', 'delete'];

/**
 * Допустимые переходы. `create` доступен из любого режима, потому что рисование
 * можно начать программно; выход из `create` всегда разрешён.
 * @type {Record<EditModeName, EditModeName[]>}
 */
export const MODE_TRANSITIONS = {
  idle: ['select', 'edit', 'create', 'delete'],
  select: ['idle', 'edit', 'create', 'delete'],
  edit: ['idle', 'select', 'create', 'delete'],
  create: ['idle', 'select', 'edit', 'delete'],
  delete: ['idle', 'select', 'edit', 'create'],
};

/**
 * Проверяет имя режима.
 * @param {unknown} mode
 * @returns {mode is EditModeName}
 */
export function isEditMode(mode) {
  return typeof mode === 'string' && EDIT_MODES.includes(/** @type {EditModeName} */ (mode));
}

/**
 * Конечный автомат режимов. Не содержит DOM и не знает о карте — только
 * проверяет переходы и хранит предыдущий режим.
 */
export class EditMode {
  /** @param {EditModeName} [initial='idle'] */
  constructor(initial = 'idle') {
    if (!isEditMode(initial)) throw new RangeError(`Unknown edit mode: ${String(initial)}`);
    /** @type {EditModeName} */
    this._mode = initial;
    /** @type {EditModeName|null} */
    this._previous = null;
  }

  /** @returns {EditModeName} */
  get mode() {
    return this._mode;
  }

  /** @returns {EditModeName|null} */
  get previous() {
    return this._previous;
  }

  /**
   * Проверяет, разрешён ли переход без его выполнения.
   * @param {EditModeName} next
   * @returns {boolean}
   */
  canTransition(next) {
    return isEditMode(next) && MODE_TRANSITIONS[this._mode].includes(next);
  }

  /**
   * Переключает режим.
   * @param {EditModeName} next
   * @returns {{changed: boolean, previous: EditModeName, mode: EditModeName}}
   */
  set(next) {
    if (!isEditMode(next)) throw new RangeError(`Unknown edit mode: ${String(next)}`);
    if (next === this._mode) {
      return { changed: false, previous: this._previous ?? this._mode, mode: this._mode };
    }
    if (!this.canTransition(next)) {
      throw new Error(`Edit mode transition is not allowed: ${this._mode} -> ${next}`);
    }
    this._previous = this._mode;
    this._mode = next;
    return { changed: true, previous: this._previous, mode: this._mode };
  }

  /**
   * Сбрасывает состояние в `idle` без проверки переходов. Используется при
   * `destroy()`.
   * @returns {EditModeName}
   */
  reset() {
    const previous = this._mode;
    this._previous = previous;
    this._mode = 'idle';
    return previous;
  }
}

/** @returns {boolean} */
export function isDrawingMode(mode) {
  return mode === 'create';
}
