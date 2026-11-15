import { Control } from './Control.js';
import { create, empty, on, stopPropagation } from '../util/dom.js';
import { stamp } from '../util/index.js';

/**
 * Переключатель слоёв: радиокнопки для базовых слоёв и флажки для
 * дополнительных.
 *
 * @example
 * new LayersControl(
 *   { Streets: osm, Satellite: imagery },
 *   { Boundaries: boundaryLayer },
 * ).addTo(map);
 */
export class LayersControl extends Control {
  /**
   * @param {Record<string, import('../layers/Layer.js').Layer>} [baseLayers]
   * @param {Record<string, import('../layers/Layer.js').Layer>} [overlays]
   * @param {object} [options]
   */
  constructor(baseLayers = {}, overlays = {}, options = {}) {
    super({
      position: 'topright',
      collapsed: true,
      hideSingleBase: false,
      sortLayers: false,
      ...options,
    });
    /** @type {Record<string, import('../layers/Layer.js').Layer>} */
    this._baseLayers = { ...baseLayers };
    /** @type {Record<string, import('../layers/Layer.js').Layer>} */
    this._overlays = { ...overlays };
    this._layerControls = Object.create(null);
    this._expanded = !this.options.collapsed;
    this._onLayerChange = () => this._update();
  }

  /** @param {import('../core/Map.js').Map} map */
  onAdd(map) {
    this._container = this._initLayout('sweety-control-layers');
    this._container.classList.toggle('sweety-control-layers-expanded', this._expanded);

    this._toggleButton = create('button', 'sweety-control-layers-toggle', this._container);
    this._toggleButton.type = 'button';
    this._toggleButton.title = 'Layers';
    this._toggleButton.setAttribute('aria-label', 'Layers');
    this._toggleButton.setAttribute('aria-expanded', String(this._expanded));
    this._toggleButton.innerHTML = '<span aria-hidden="true">☰</span>';
    this._toggleButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this._expanded = !this._expanded;
      this._container.classList.toggle('sweety-control-layers-expanded', this._expanded);
      this._toggleButton.setAttribute('aria-expanded', String(this._expanded));
    });

    this._panel = create('div', 'sweety-control-layers-panel', this._container);
    on(this._panel, 'mousedown dblclick contextmenu wheel', stopPropagation);
    this._buildPanel();

    map.on('layeradd layerremove', this._onLayerChange);
    return this._container;
  }

  /** @param {import('../core/Map.js').Map} map */
  onRemove(map) {
    map.off('layeradd layerremove', this._onLayerChange);
    super.onRemove(map);
  }

  /**
   * Добавляет запись базового слоя.
   * @param {import('../layers/Layer.js').Layer} layer
   * @param {string} name
   * @returns {this}
   */
  addBaseLayer(layer, name) {
    this._baseLayers[name] = layer;
    if (this._panel) this._buildPanel();
    return this;
  }

  /**
   * Добавляет запись дополнительного слоя.
   * @param {import('../layers/Layer.js').Layer} layer
   * @param {string} name
   * @returns {this}
   */
  addOverlay(layer, name) {
    this._overlays[name] = layer;
    if (this._panel) this._buildPanel();
    return this;
  }

  /**
   * Удаляет запись слоя по объекту.
   * @param {import('../layers/Layer.js').Layer} layer
   * @returns {this}
   */
  removeLayer(layer) {
    for (const [name, candidate] of Object.entries(this._baseLayers)) {
      if (candidate === layer) delete this._baseLayers[name];
    }
    for (const [name, candidate] of Object.entries(this._overlays)) {
      if (candidate === layer) delete this._overlays[name];
    }
    if (this._panel) this._buildPanel();
    return this;
  }

  /** @private */
  _buildPanel() {
    if (!this._panel) return;
    empty(this._panel);
    this._layerControls = Object.create(null);

    const baseNames = Object.keys(this._baseLayers);
    if (baseNames.length && !(this.options.hideSingleBase && baseNames.length === 1)) {
      const section = create('div', 'sweety-control-layers-section', this._panel);
      create('div', 'sweety-control-layers-title', section).textContent = 'Base layers';
      for (const name of baseNames) {
        this._addInput(section, name, this._baseLayers[name], false);
      }
    }

    const overlayNames = Object.keys(this._overlays);
    if (overlayNames.length) {
      const section = create('div', 'sweety-control-layers-section', this._panel);
      create('div', 'sweety-control-layers-title', section).textContent = 'Overlays';
      for (const name of overlayNames) {
        this._addInput(section, name, this._overlays[name], true);
      }
    }
    this._update();
  }

  /** @private */
  _addInput(container, name, layer, overlay) {
    const label = create('label', 'sweety-control-layers-option', container);
    const input = create('input', '', label);
    input.type = overlay ? 'checkbox' : 'radio';
    input.name = overlay ? `sweety-overlays-${stamp(this)}` : `sweety-base-${stamp(this)}`;
    input.value = name;
    input.checked = Boolean(layer._map === this._map);
    input.addEventListener('change', () => {
      if (input.checked) {
        if (overlay) this._selectOverlay(name, layer);
        else this._selectBase(name, layer);
      } else if (overlay) {
        this._map.removeLayer(layer);
        this._map.fire('overlayremove', { layer, name });
      }
    });
    const span = create('span', '', label);
    span.textContent = name;
    this._layerControls[name] = { input, layer, overlay };
  }

  /** @private */
  _selectBase(name, layer) {
    for (const candidate of Object.values(this._baseLayers)) {
      if (candidate !== layer && candidate._map) this._map.removeLayer(candidate);
    }
    if (!layer._map) this._map.addLayer(layer);
    this._map.fire('baselayerchange', { layer, name });
    this._update();
  }

  /** @private */
  _selectOverlay(name, layer) {
    if (!layer._map) this._map.addLayer(layer);
    this._map.fire('overlayadd', { layer, name });
    this._update();
  }

  /** @private */
  _update() {
    if (!this._map) return;
    for (const { input, layer } of Object.values(this._layerControls)) {
      if (input) input.checked = Boolean(layer._map === this._map);
    }
  }
}
