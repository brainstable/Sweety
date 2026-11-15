import { DivOverlay } from './DivOverlay.js';

const TOOLTIP_DEFAULTS = {
  pane: 'tooltip',
  className: '',
  offset: [0, -8],
  direction: 'top',
  opacity: 0.9,
  autoClose: false,
  closeButton: false,
  closeOnEscapeKey: false,
  autoPan: false,
  interactive: false,
  permanent: false,
};

/**
 * Легковесная подпись, привязанная к слою. Подсказки обычно открываются при
 * наведении и могут быть постоянными.
 */
export class Tooltip extends DivOverlay {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({ ...TOOLTIP_DEFAULTS, ...options });
    this._kind = 'tooltip';
  }
}
