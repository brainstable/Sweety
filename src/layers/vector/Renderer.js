import { Layer } from '../Layer.js';
import { stamp } from '../../util/index.js';

/**
 * Абстрактный рендерер, владеющий общей DOM-поверхностью для множества векторных слоёв.
 * Подклассы реализуют отрисовку в SVG или Canvas.
 */
export class Renderer extends Layer {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({ pane: 'overlay', ...options });
    /** @type {Record<string, import('./Path.js').Path>} */
    this._layers = Object.create(null);
  }

  /** @param {import('../../core/Map.js').Map} map */
  onAdd(map) {
    this._initContainer();
    map.getPane(this.options.pane).appendChild(this._container);
    this._update();
  }

  /** */
  onRemove() {
    this._destroyContainer();
    this._layers = Object.create(null);
  }

  /** @protected */
  _initContainer() {
    throw new Error('Renderer._initContainer must be implemented');
  }

  /** @protected */
  _destroyContainer() {
    this._container?.remove();
    this._container = null;
  }

  /**
   * Регистрирует path и создаёт его узел отрисовки.
   * @param {import('./Path.js').Path} layer
   */
  _initPath(layer) {
    this._layers[stamp(layer)] = layer;
    layer._renderer = this;
  }

  /**
   * Подключает уже зарегистрированный path к поверхности отрисовки.
   * @param {import('./Path.js').Path} _layer
   */
  _addPath(_layer) {}

  /**
   * Удаляет path с поверхности отрисовки.
   * @param {import('./Path.js').Path} layer
   */
  _removePath(layer) {
    delete this._layers[layer._sweetyId];
    layer._renderer = null;
  }

  /**
   * Перерисовывает один path.
   * @param {import('./Path.js').Path} _layer
   */
  _updatePath(_layer) {}
}
