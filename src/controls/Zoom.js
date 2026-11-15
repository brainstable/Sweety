import { Control } from './Control.js';
import { create } from '../util/dom.js';

/**
 * Стандартные кнопки приближения и отдаления, отключаемые на пределах масштаба карты.
 */
export class ZoomControl extends Control {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({
      position: 'topleft',
      zoomInText: '+',
      zoomOutText: '−',
      zoomInTitle: 'Zoom in',
      zoomOutTitle: 'Zoom out',
      ...options,
    });
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._container = this._initLayout('sweety-control-zoom');
    this._zoomInButton = this._createButton(
      this.options.zoomInText,
      this.options.zoomInTitle,
      'sweety-control-zoom-in',
      () => map.zoomIn(undefined, { animate: true }),
    );
    this._zoomOutButton = this._createButton(
      this.options.zoomOutText,
      this.options.zoomOutTitle,
      'sweety-control-zoom-out',
      () => map.zoomOut(undefined, { animate: true }),
    );
    this._updateDisabled = () => this._update();
    map.on('zoomend', this._updateDisabled);
    map.on('zoomlimits', this._updateDisabled);
    this._update();
    return this._container;
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    map.off('zoomend', this._updateDisabled);
    map.off('zoomlimits', this._updateDisabled);
    super.onRemove(map);
  }

  /** @private */
  _createButton(text, title, className, callback) {
    const button = create('button', className, this._container);
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.textContent = text;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      callback();
    });
    return button;
  }

  /** @private */
  _update() {
    if (!this._map) return;
    if (this._zoomInButton)
      this._zoomInButton.disabled = this._map.getZoom() >= this._map.getMaxZoom();
    if (this._zoomOutButton) {
      this._zoomOutButton.disabled = this._map.getZoom() <= this._map.getMinZoom();
    }
  }
}
