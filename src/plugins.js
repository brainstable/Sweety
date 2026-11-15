const registry = new globalThis.Map();
const installed = new Set();
let defaultApi = null;

/**
 * Плагин Sweety. Хранит установщик, который получает публичный API
 * библиотеки и пользовательские настройки.
 */
export class Plugin {
  /**
   * @param {string} name
   * @param {(api: object, options?: object) => void} install
   * @param {(api: object) => void} [uninstall]
   */
  constructor(name, install, uninstall) {
    if (!name || typeof name !== 'string') {
      throw new TypeError('Имя плагина должно быть непустой строкой');
    }
    if (typeof install !== 'function') {
      throw new TypeError('Установщик плагина должен быть функцией');
    }
    this.name = name;
    this.install = install;
    this.uninstall = uninstall || null;
  }
}

/**
 * Регистрирует плагин по имени. Повторная регистрация запрещена, чтобы
 * случайно не заменить уже подключённое расширение.
 * @param {string|Plugin|{name:string,install:Function,uninstall?:Function}} plugin
 * @param {Function} [installer]
 * @returns {Plugin}
 */
export function definePlugin(plugin, installer) {
  const instance =
    plugin instanceof Plugin
      ? plugin
      : typeof plugin === 'string'
        ? new Plugin(plugin, installer)
        : new Plugin(plugin.name, plugin.install, plugin.uninstall);

  if (registry.has(instance.name)) {
    throw new Error(`Плагин уже зарегистрирован: ${instance.name}`);
  }
  registry.set(instance.name, instance);
  return instance;
}

/**
 * Подключает плагин. Установщик вызывается один раз на процесс.
 * @param {string|Plugin|{name:string,install:Function}} pluginOrName
 * @param {object} [options]
 * @param {object} [api] публичный API; по умолчанию используется namespace Sweety
 * @returns {object} API библиотеки
 */
export function use(pluginOrName, options = {}, api = defaultApi) {
  if (!api) {
    throw new Error('API Sweety ещё не инициализировано; вызовите use после импорта библиотеки');
  }

  const plugin =
    typeof pluginOrName === 'string'
      ? registry.get(pluginOrName)
      : pluginOrName instanceof Plugin
        ? pluginOrName
        : pluginOrName && typeof pluginOrName.install === 'function'
          ? pluginOrName
          : null;

  if (!plugin) {
    throw new Error(`Плагин не найден: ${String(pluginOrName)}`);
  }
  if (!registry.has(plugin.name)) registry.set(plugin.name, plugin);
  if (installed.has(plugin.name)) return api;

  plugin.install(api, options);
  installed.add(plugin.name);
  return api;
}

/**
 * Отключает ранее установленный плагин, если у него есть uninstall.
 * @param {string} name
 * @param {object} [api]
 * @returns {boolean}
 */
export function unuse(name, api = defaultApi) {
  const plugin = registry.get(name);
  if (!plugin || !installed.has(name)) return false;
  if (plugin.uninstall && api) plugin.uninstall(api);
  installed.delete(name);
  return true;
}

/** @returns {Plugin|undefined} */
export function getPlugin(name) {
  return registry.get(name);
}

/** @returns {Plugin[]} */
export function listPlugins() {
  return [...registry.values()];
}

/** @returns {Set<string>} */
export function installedPlugins() {
  return new Set(installed);
}

/**
 * Связывает реестр с объектом публичного API. Вызывается один раз из index.js.
 * @param {object} api
 */
export function setPluginApi(api) {
  defaultApi = api;
}
