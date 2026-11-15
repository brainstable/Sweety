import { Layer } from '../Layer.js';
import { stamp } from '../../util/index.js';

/**
 * Abstract renderer that owns a shared DOM surface for many vector layers.
 * Subclasses implement SVG or Canvas drawing.
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
   * Register a path and create its drawing node.
   * @param {import('./Path.js').Path} layer
   */
  _initPath(layer) {
    this._layers[stamp(layer)] = layer;
    layer._renderer = this;
  }

  /**
   * Attach an already registered path to the drawing surface.
   * @param {import('./Path.js').Path} _layer
   */
  _addPath(_layer) {}

  /**
   * Remove a path from the drawing surface.
   * @param {import('./Path.js').Path} layer
   */
  _removePath(layer) {
    delete this._layers[layer._sweetyId];
    layer._renderer = null;
  }

  /**
   * Redraw one path.
   * @param {import('./Path.js').Path} _layer
   */
  _updatePath(_layer) {}
}
