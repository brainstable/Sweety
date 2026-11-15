import { describe, expect, it, vi } from 'vitest';
import { LatLng, Polygon } from 'sweety-map';
import {
  AddVertexCommand,
  Command,
  CompositeCommand,
  CreateLayerCommand,
  DeleteLayerCommand,
  DeleteVertexCommand,
  GeometryCommand,
  MoveLayerCommand,
  MoveVertexCommand,
} from '../src/core/Command.js';
import { CommandStack } from '../src/core/CommandStack.js';
import { snapshotGeometry } from '../src/core/GeometryUtils.js';

function fakeMap() {
  const layers = new Set();
  return {
    layers,
    hasLayer: (layer) => layers.has(layer),
    addLayer(layer) {
      layers.add(layer);
    },
    removeLayer(layer) {
      layers.delete(layer);
    },
  };
}

describe('CommandStack', () => {
  it('выполняет команду при push и поддерживает undo/redo', () => {
    const value = { count: 0 };
    const command = new Command('increment');
    command.execute = vi.fn(() => {
      value.count += 1;
    });
    command.undo = vi.fn(() => {
      value.count -= 1;
    });

    const stack = new CommandStack();
    stack.push(command);
    expect(value.count).toBe(1);
    expect(stack.canUndo()).toBe(true);
    expect(stack.undo()).toBe(command);
    expect(value.count).toBe(0);
    expect(stack.canRedo()).toBe(true);
    expect(stack.redo()).toBe(command);
    expect(value.count).toBe(1);
    expect(stack.undoLength).toBe(1);
  });

  it('не выполняет уже применённую команду при apply:false', () => {
    const command = new Command('noop');
    command.execute = vi.fn();
    command.undo = vi.fn();
    const stack = new CommandStack();
    stack.push(command, { apply: false });
    expect(command.execute).not.toHaveBeenCalled();
    stack.undo();
    expect(command.undo).toHaveBeenCalledOnce();
  });

  it('очищает redo при новой команде и соблюдает лимит', () => {
    const stack = new CommandStack({ limit: 2 });
    const make = (label) => {
      const command = new Command(label);
      command.execute = vi.fn();
      command.undo = vi.fn();
      return command;
    };
    const first = make('first');
    const second = make('second');
    const third = make('third');
    stack.push(first);
    stack.push(second);
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.push(third);
    expect(stack.canRedo()).toBe(false);
    expect(stack.undoLength).toBe(2);
    stack.push(make('fourth'));
    expect(stack.undoLength).toBe(2);
    expect(stack.getUndoStack()[0].label).toBe('third');
  });

  it('возвращает null на пустом стеке и очищается', () => {
    const stack = new CommandStack();
    expect(stack.undo()).toBeNull();
    expect(stack.redo()).toBeNull();
    stack.push(new Command('x'));
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });
});

describe('GeometryCommand', () => {
  it('перекатывает геометрию вперёд и назад', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    const before = snapshotGeometry(polygon);
    polygon.setLatLngs([
      [
        [2, 2],
        [2, 3],
        [3, 3],
      ],
    ]);
    const after = snapshotGeometry(polygon);
    const command = new MoveVertexCommand(polygon, before, after);
    const stack = new CommandStack();
    stack.push(command, { apply: false });

    stack.undo();
    expect(polygon.getLatLngs()[0][0].lat).toBe(0);
    stack.redo();
    expect(polygon.getLatLngs()[0][0].lat).toBe(2);
  });

  it('поддерживает именованные команды вершин и группы', () => {
    const polygon = new Polygon([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    ]);
    const before = snapshotGeometry(polygon);
    polygon.getLatLngs()[0].push(new LatLng(1, 0));
    const after = snapshotGeometry(polygon);
    expect(new AddVertexCommand(polygon, before, after).label).toBe('Add vertex');
    expect(new DeleteVertexCommand(polygon, before, after).label).toBe('Delete vertex');

    const groupCommand = new MoveLayerCommand([
      { layer: polygon, before, after },
      { layer: polygon, before, after },
    ]);
    expect(groupCommand.entries).toHaveLength(2);
  });

  it('пустые команды не падают', () => {
    const command = new GeometryCommand('empty', []);
    expect(() => command.execute()).not.toThrow();
    expect(() => command.undo()).not.toThrow();
  });
});

describe('CreateLayerCommand/DeleteLayerCommand', () => {
  it('добавляет и удаляет слой, переживая undo/redo', () => {
    const map = fakeMap();
    const layer = { name: 'layer' };
    const create = new CreateLayerCommand(layer, { map });
    const stack = new CommandStack();
    stack.push(create);
    expect(map.hasLayer(layer)).toBe(true);
    stack.undo();
    expect(map.hasLayer(layer)).toBe(false);
    stack.redo();
    expect(map.hasLayer(layer)).toBe(true);

    const remove = new DeleteLayerCommand(layer, { map });
    stack.push(remove);
    expect(map.hasLayer(layer)).toBe(false);
    stack.undo();
    expect(map.hasLayer(layer)).toBe(true);
  });

  it('работает с группой-родителем', () => {
    const map = fakeMap();
    const parent = {
      children: new Set(),
      hasLayer(layer) {
        return this.children.has(layer);
      },
      addLayer(layer) {
        this.children.add(layer);
      },
      removeLayer(layer) {
        this.children.delete(layer);
      },
    };
    const layer = { name: 'child' };
    const command = new CreateLayerCommand(layer, { map, parent });
    command.execute();
    expect(parent.hasLayer(layer)).toBe(true);
    command.undo();
    expect(parent.hasLayer(layer)).toBe(false);
  });
});

describe('CompositeCommand', () => {
  it('выполняет команды по порядку, а откатывает в обратном', () => {
    const calls = [];
    const make = (label) => {
      const command = new Command(label);
      command.execute = () => calls.push(`do:${label}`);
      command.undo = () => calls.push(`undo:${label}`);
      return command;
    };
    const composite = new CompositeCommand([make('a'), make('b')], 'both');
    composite.execute();
    expect(calls).toEqual(['do:a', 'do:b']);
    calls.length = 0;
    composite.undo();
    expect(calls).toEqual(['undo:b', 'undo:a']);
  });
});
