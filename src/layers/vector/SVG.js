import { Renderer } from './Renderer.js';
import { addClass, createNS, getMousePosition, on, preventDefault } from '../../util/dom.js';

/**
 * Рендерер SVG. Один `<svg>` используется совместно всеми слоями path, добавленными на карту.
 * Интерактивные path получают события указателя независимо от карты.
 */
export class SVG extends Renderer {
  /** @private */
  _initContainer() {
    this._container = createNS('svg', 'sweety-layer sweety-svg-layer');
    this._container.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    this._container.style.position = 'absolute';
    this._container.style.left = '0';
    this._container.style.top = '0';
    this._container.style.overflow = 'visible';
    this._container.style.pointerEvents = 'none';
    this._rootGroup = createNS('g');
    this._container.appendChild(this._rootGroup);
    this._update();
  }

  /** @private */
  _update() {
    if (!this._container || !this._map) return;
    const size = this._map.getSize();
    this._container.setAttribute('width', String(size.x));
    this._container.setAttribute('height', String(size.y));
    this._container.style.width = `${size.x}px`;
    this._container.style.height = `${size.y}px`;
  }

  /** @param {import('./Path.js').Path} layer */
  _initPath(layer) {
    super._initPath(layer);
    const path = createNS('path', 'sweety-path');
    if (layer.options.className) addClass(path, layer.options.className);
    path.style.pointerEvents = layer.options.interactive === false ? 'none' : 'auto';
    layer._path = path;
    this._rootGroup.appendChild(path);

    if (layer.options.interactive !== false) {
      layer._svgEventHandlers = {};
      for (const type of [
        'click',
        'dblclick',
        'contextmenu',
        'mousedown',
        'mouseup',
        'mouseover',
        'mouseout',
        'mousemove',
      ]) {
        const handler = (event) => this._handlePathEvent(layer, event);
        layer._svgEventHandlers[type] = handler;
        on(path, type, handler);
      }
    }
  }

  /** @param {import('./Path.js').Path} layer */
  _addPath(layer) {
    if (layer._path && layer._path.parentNode !== this._rootGroup) {
      this._rootGroup.appendChild(layer._path);
    }
  }

  /** @param {import('./Path.js').Path} layer */
  _updatePath(layer) {
    layer._updateSVGPath();
  }

  /** @param {import('./Path.js').Path} layer */
  _removePath(layer) {
    if (layer._path) {
      layer._path.remove();
      layer._path = null;
    }
    layer._svgEventHandlers = null;
    super._removePath(layer);
  }

  /** @private */
  _handlePathEvent(layer, event) {
    if (!this._map || !layer._map) return;
    const containerPoint = getMousePosition(event, this._map.getContainer());
    const layerPoint = this._map.containerPointToLayerPoint(containerPoint);
    layer.fire(event.type, {
      originalEvent: event,
      latlng: this._map.layerPointToLatLng(layerPoint),
      layerPoint,
      containerPoint,
    });
    event.stopPropagation();
    if (event.type === 'contextmenu') preventDefault(event);
  }
}
