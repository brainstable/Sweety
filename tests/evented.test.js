import { describe, expect, it, vi } from 'vitest';
import { Event, Evented } from '../src/core/Evented.js';

describe('Evented', () => {
  it('registers listeners for multiple event types and passes data', () => {
    const source = new Evented();
    const first = vi.fn();
    const second = vi.fn();

    source.on('click dblclick', first);
    source.on('click', second);
    source.fire('click', { latlng: [1, 2], originalEvent: 'dom' });
    source.fire('dblclick');

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0]).toBeInstanceOf(Event);
    expect(first.mock.calls[0][0]).toMatchObject({
      type: 'click',
      target: source,
      sourceTarget: source,
      latlng: [1, 2],
    });
  });

  it('uses the supplied context and supports object registration', () => {
    const source = new Evented();
    const context = { value: 42 };
    const listener = vi.fn(function () {
      return this.value;
    });

    source.on({ ping: listener }, context);
    source.fire('ping');
    expect(listener.mock.results[0].value).toBe(42);
  });

  it('removes listeners precisely and clears all with off()', () => {
    const source = new Evented();
    const a = vi.fn();
    const b = vi.fn();

    source.on('x', a);
    source.on('x', b);
    source.off('x', a);
    source.fire('x');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);

    source.off();
    source.fire('x');
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('calls once listeners exactly once', () => {
    const source = new Evented();
    const listener = vi.fn();
    source.once('ready', listener);
    source.fire('ready');
    source.fire('ready');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicate registration of the same fn and context', () => {
    const source = new Evented();
    const listener = vi.fn();
    source.on('tick', listener);
    source.on('tick', listener);
    source.fire('tick');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('bubbles events through event parents without loops', () => {
    const child = new Evented();
    const group = new Evented();
    const map = new Evented();
    const groupListener = vi.fn();
    const mapListener = vi.fn();

    child.addEventParent(group);
    group.addEventParent(map);
    group.on('feature', groupListener);
    map.on('feature', mapListener);

    child.fire('feature', { id: 7 });
    expect(groupListener).toHaveBeenCalledTimes(1);
    expect(mapListener).toHaveBeenCalledTimes(1);
    expect(mapListener.mock.calls[0][0].sourceTarget).toBe(child);
    expect(mapListener.mock.calls[0][0].propagatedFrom).toBe(group);
    expect(mapListener.mock.calls[0][0].id).toBe(7);
  });

  it('reports listeners including parents when requested', () => {
    const child = new Evented();
    const parent = new Evented();
    child.addEventParent(parent);
    expect(child.listens('move')).toBe(false);
    parent.on('move', () => {});
    expect(child.listens('move')).toBe(false);
    expect(child.listens('move', true)).toBe(true);
  });
});
