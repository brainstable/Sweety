import { DivOverlay } from './DivOverlay.js';

const POPUP_DEFAULTS = {
  pane: 'popup',
  className: '',
  offset: [0, -8],
  autoClose: true,
  closeButton: true,
  closeOnEscapeKey: true,
  autoPan: true,
  interactive: true,
};

/**
 * HTML-всплывающее окно, привязанное к географической точке.
 *
 * @example
 * marker.bindPopup('<strong>Hello</strong>');
 */
export class Popup extends DivOverlay {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({ ...POPUP_DEFAULTS, ...options });
    this._kind = 'popup';
  }
}
