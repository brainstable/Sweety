import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import {
  Plugin,
  definePlugin,
  getPlugin,
  installedPlugins,
  listPlugins,
  setPluginApi,
  unuse,
  use,
} from '../src/plugins.js';

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  return container;
}

describe('plugin system', () => {
  it('registers and installs a plugin through the public API', () => {
    const calls = [];
    const api = { Map, custom: null };
    setPluginApi(api);
    const plugin = definePlugin('test-labels', (sweety, options) => {
      calls.push(options);
      sweety.Map.addInitHook(function initLabels(mapOptions) {
        this.pluginLabel = mapOptions.label;
      });
      sweety.Map.prototype.getPluginLabel = function getPluginLabel() {
        return this.pluginLabel;
      };
    });

    expect(plugin).toBeInstanceOf(Plugin);
    expect(getPlugin('test-labels')).toBe(plugin);
    expect(listPlugins()).toContain(plugin);

    use('test-labels', { label: 'demo' });
    use('test-labels', { label: 'ignored' });
    expect(calls).toEqual([{ label: 'demo' }]);
    expect(installedPlugins().has('test-labels')).toBe(true);

    const map = new Map(setup(), {
      zoomControl: false,
      attributionControl: false,
      label: 'sweety',
    });
    expect(map.getPluginLabel()).toBe('sweety');
    map.remove();
  });

  it('supports plugin objects, uninstall and clear errors', () => {
    setPluginApi({ Map });
    const uninstall = vi.fn();
    const plugin = new Plugin('object-plugin', () => {}, uninstall);
    use(plugin);
    expect(installedPlugins().has('object-plugin')).toBe(true);
    expect(unuse('object-plugin')).toBe(true);
    expect(uninstall).toHaveBeenCalledOnce();
    expect(unuse('object-plugin')).toBe(false);

    expect(() => use('missing-plugin')).toThrow('Плагин не найден');
    expect(() => definePlugin('object-plugin', () => {})).toThrow('уже зарегистрирован');
    expect(() => new Plugin('', () => {})).toThrow('непустой строкой');
    expect(() => new Plugin('bad', null)).toThrow('должен быть функцией');
  });
});
