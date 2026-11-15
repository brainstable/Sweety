import { Control } from 'sweety-map';
import { DEFAULT_I18N, translate } from '../i18n.js';
import { icon } from './icons.js';

/**
 * Компактная панель активного рисования: подсказка, «Готово» и «Отмена».
 * Появляется только на время сессии `create`.
 */
export class DrawToolbar extends Control {
  /**
   * @param {import('../EditPlugin.js').EditPlugin} plugin
   * @param {{position?: string, i18n?: Record<string,string>}} [options]
   */
  constructor(plugin, options = {}) {
    super({ position: options.position || 'bottomleft' });
    this.plugin = plugin;
    this.messages = { ...DEFAULT_I18N, ...(options.i18n || {}) };
    this._onClick = (event) => this._handleClick(event);
    /** @type {HTMLButtonElement|null} */
    this._finishButton = null;
  }

  /** @param {any} _map */
  onAdd(_map) {
    const container = this._initLayout('map-edit-draw-toolbar');
    container.classList.add('map-edit-draw-toolbar');
    container.setAttribute('role', 'group');

    this._hint = document.createElement('span');
    this._hint.className = 'map-edit-draw-hint';
    container.appendChild(this._hint);

    const actions = document.createElement('span');
    actions.className = 'map-edit-draw-actions';

    this._finishButton = this._makeButton('finish', 'check', 'finish');
    this._finishButton.classList.add('map-edit-button-primary');
    const cancel = this._makeButton('cancel', 'close', 'cancel');
    actions.appendChild(this._finishButton);
    actions.appendChild(cancel);
    container.appendChild(actions);

    container.addEventListener('click', this._onClick);
    return container;
  }

  /** @param {any} map */
  onRemove(map) {
    this._container?.removeEventListener('click', this._onClick);
    super.onRemove(map);
    this._finishButton = null;
    this._hint = null;
  }

  /** @private */
  _makeButton(action, iconName, labelKey) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-edit-button';
    button.dataset.action = action;
    button.innerHTML = icon(iconName);
    button.title = translate(this.messages, labelKey);
    button.setAttribute('aria-label', translate(this.messages, labelKey));
    return button;
  }

  /** @param {string} text */
  setHint(text) {
    if (this._hint) this._hint.textContent = text;
  }

  /** @param {boolean} canFinish */
  setCanFinish(canFinish) {
    if (this._finishButton) this._finishButton.disabled = !canFinish;
  }

  /** @private */
  _handleClick(event) {
    const button = /** @type {HTMLElement|null} */ (event.target)?.closest?.('button[data-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.action === 'finish') this.plugin.finishDrawing();
    else this.plugin.cancelDrawing();
  }
}
