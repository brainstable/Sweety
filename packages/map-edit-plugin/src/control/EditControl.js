import { Control } from 'sweety-map';
import { DEFAULT_I18N, translate } from '../i18n.js';
import { icon } from './icons.js';

const ACTION_ICONS = {
  select: 'select',
  edit: 'edit',
  delete: 'trash',
  undo: 'undo',
  redo: 'redo',
  'draw:marker': 'marker',
  'draw:polyline': 'polyline',
  'draw:polygon': 'polygon',
  'draw:circle': 'circle',
  'draw:rectangle': 'rectangle',
};

const ACTION_LABELS = {
  select: 'select',
  edit: 'edit',
  delete: 'delete',
  undo: 'undo',
  redo: 'redo',
  'draw:marker': 'drawMarker',
  'draw:polyline': 'drawPolyline',
  'draw:polygon': 'drawPolygon',
  'draw:circle': 'drawCircle',
  'draw:rectangle': 'drawRectangle',
};

/**
 * Панель инструментов редактора. Кнопки с inline-SVG, активным состоянием,
 * тултипами и локализацией.
 */
export class EditControl extends Control {
  /**
   * @param {import('../EditPlugin.js').EditPlugin} plugin
   * @param {{position?: string, modes?: string[], i18n?: Record<string,string>}} [options]
   */
  constructor(plugin, options = {}) {
    super({ position: options.position || 'topleft' });
    this.plugin = plugin;
    this.messages = { ...DEFAULT_I18N, ...(options.i18n || {}) };
    /** @type {string[]} */
    this.actions = options.modes || [];
    /** @type {HTMLButtonElement[]} */
    this._buttons = [];
    this._onClick = (event) => this._handleClick(event);
  }

  /** @param {any} _map */
  onAdd(_map) {
    const container = this._initLayout('map-edit-control');
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', this._t('toolbar'));
    container.classList.add('map-edit-control');

    let previousWasDraw = false;
    for (const action of this.actions) {
      if (action === 'undo' || action === 'redo') continue;
      const isDraw = action.startsWith('draw:');
      if (isDraw && !previousWasDraw && this._buttons.length) this._appendSeparator(container);
      const button = this._makeButton(action);
      if (button) container.appendChild(button);
      previousWasDraw = isDraw;
    }
    if (this.actions.includes('undo') || this.actions.includes('redo')) {
      this._appendSeparator(container);
    }
    for (const action of ['undo', 'redo']) {
      if (!this.actions.includes(action)) continue;
      const button = this._makeButton(action);
      if (button) container.appendChild(button);
    }

    container.addEventListener('click', this._onClick);
    this.refresh();
    return container;
  }

  /** @param {any} map */
  onRemove(map) {
    this._container?.removeEventListener('click', this._onClick);
    super.onRemove(map);
    this._buttons = [];
  }

  /** @private */
  _makeButton(action) {
    const label = ACTION_LABELS[action];
    const iconName = ACTION_ICONS[action];
    if (!label || !iconName) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-edit-button';
    button.dataset.action = action;
    button.innerHTML = icon(iconName);
    button.title = this._t(label);
    button.setAttribute('aria-label', this._t(label));
    button.setAttribute('aria-pressed', 'false');
    this._buttons.push(button);
    return button;
  }

  /** @private */
  _appendSeparator(container) {
    const separator = document.createElement('span');
    separator.className = 'map-edit-separator';
    separator.setAttribute('aria-hidden', 'true');
    container.appendChild(separator);
  }

  /** @private */
  _handleClick(event) {
    const button = /** @type {HTMLElement|null} */ (event.target)?.closest?.('button[data-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const action = button.dataset.action;
    if (action === 'undo') this.plugin.undo();
    else if (action === 'redo') this.plugin.redo();
    else if (action.startsWith('draw:')) this.plugin.startDrawing(action.slice(5));
    else this.plugin.setMode(action);
    this.refresh();
  }

  /** Обновляет активные и недоступные кнопки. */
  refresh() {
    if (!this._buttons.length) return;
    const mode = this.plugin.getMode();
    const drawType = this.plugin.getDrawType();
    for (const button of this._buttons) {
      const action = button.dataset.action;
      const active = action.startsWith('draw:')
        ? mode === 'create' && drawType === action.slice(5)
        : mode === action;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (action === 'undo') button.disabled = !this.plugin.canUndo();
      else if (action === 'redo') button.disabled = !this.plugin.canRedo();
    }
  }

  /** @private */
  _t(key) {
    return translate(this.messages, key);
  }
}
