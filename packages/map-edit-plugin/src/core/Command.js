import { restoreGeometry } from './GeometryUtils.js';

/**
 * Базовая команда Command-паттерна. Команда должна быть идемпотентной:
 * повторный `execute()` после `undo()` возвращает то же состояние.
 */
export class Command {
  /** @param {string} [label] */
  constructor(label = '') {
    /** @type {string} */
    this.label = label;
    /** @type {string} */
    this.kind = 'command';
  }

  execute() {}

  undo() {}
}

/**
 * Изменение геометрии одного или нескольких слоёв. До и после — снимки,
 * полученные из {@link snapshotGeometry}.
 */
export class GeometryCommand extends Command {
  /**
   * @param {string} label
   * @param {Array<{layer: any, before: object, after: object}>} entries
   */
  constructor(label, entries) {
    super(label);
    this.kind = 'geometry';
    /** @type {Array<{layer: any, before: object, after: object}>} */
    this.entries = entries.filter((entry) => entry && entry.layer && entry.after);
  }

  execute() {
    for (const entry of this.entries) restoreGeometry(entry.layer, entry.after);
  }

  undo() {
    for (const entry of this.entries) restoreGeometry(entry.layer, entry.before);
  }
}

/** Перемещение одной вершины. */
export class MoveVertexCommand extends GeometryCommand {
  /**
   * @param {any} layer
   * @param {object} before
   * @param {object} after
   */
  constructor(layer, before, after) {
    super('Move vertex', [{ layer, before, after }]);
  }
}

/** Вставка вершины (включая возможное последующее перетаскивание). */
export class AddVertexCommand extends GeometryCommand {
  /**
   * @param {any} layer
   * @param {object} before
   * @param {object} after
   */
  constructor(layer, before, after) {
    super('Add vertex', [{ layer, before, after }]);
  }
}

/** Удаление вершины. */
export class DeleteVertexCommand extends GeometryCommand {
  /**
   * @param {any} layer
   * @param {object} before
   * @param {object} after
   */
  constructor(layer, before, after) {
    super('Delete vertex', [{ layer, before, after }]);
  }
}

/** Перемещение тела геометрии (одного слоя или всех частей группы). */
export class MoveLayerCommand extends GeometryCommand {
  /**
   * @param {Array<{layer: any, before: object, after: object}>} entries
   */
  constructor(entries) {
    super('Move geometry', entries);
  }
}

/** Изменение радиуса круга. */
export class ResizeCircleCommand extends GeometryCommand {
  /**
   * @param {any} layer
   * @param {object} before
   * @param {object} after
   */
  constructor(layer, before, after) {
    super('Resize circle', [{ layer, before, after }]);
  }
}

/** Добавление слоя на карту или в группу. */
export class CreateLayerCommand extends Command {
  /**
   * @param {any} layer
   * @param {{map: any, parent?: any|null, label?: string}} options
   */
  constructor(layer, { map, parent = null, label = 'Create layer' }) {
    super(label);
    this.kind = 'create';
    this.layer = layer;
    this.map = map;
    /** @type {any|null} */
    this.parent = parent || null;
  }

  execute() {
    if (this.parent) {
      if (!this.parent.hasLayer(this.layer)) this.parent.addLayer(this.layer);
      else if (!this.map.hasLayer(this.layer)) this.map.addLayer(this.layer);
      return;
    }
    if (!this.map.hasLayer(this.layer)) this.map.addLayer(this.layer);
  }

  undo() {
    if (this.parent) {
      if (this.parent.hasLayer(this.layer)) this.parent.removeLayer(this.layer);
      else if (this.map.hasLayer(this.layer)) this.map.removeLayer(this.layer);
      return;
    }
    if (this.map.hasLayer(this.layer)) this.map.removeLayer(this.layer);
  }
}

/** Удаление слоя с карты или из группы. */
export class DeleteLayerCommand extends Command {
  /**
   * @param {any} layer
   * @param {{map: any, parent?: any|null, label?: string}} options
   */
  constructor(layer, { map, parent = null, label = 'Delete layer' }) {
    super(label);
    this.kind = 'delete';
    this.layer = layer;
    this.map = map;
    /** @type {any|null} */
    this.parent = parent || null;
  }

  execute() {
    if (this.parent) {
      if (this.parent.hasLayer(this.layer)) this.parent.removeLayer(this.layer);
      else if (this.map.hasLayer(this.layer)) this.map.removeLayer(this.layer);
      return;
    }
    if (this.map.hasLayer(this.layer)) this.map.removeLayer(this.layer);
  }

  undo() {
    if (this.parent) {
      if (!this.parent.hasLayer(this.layer)) this.parent.addLayer(this.layer);
      else if (!this.map.hasLayer(this.layer)) this.map.addLayer(this.layer);
      return;
    }
    if (!this.map.hasLayer(this.layer)) this.map.addLayer(this.layer);
  }
}

/** Группирует несколько команд в одну операцию undo/redo. */
export class CompositeCommand extends Command {
  /**
   * @param {Command[]} commands
   * @param {string} [label]
   */
  constructor(commands, label = 'Composite operation') {
    super(label);
    this.kind = 'composite';
    this.commands = commands.filter(Boolean);
  }

  execute() {
    for (const command of this.commands) command.execute();
  }

  undo() {
    for (let index = this.commands.length - 1; index >= 0; index -= 1) {
      this.commands[index].undo();
    }
  }
}
