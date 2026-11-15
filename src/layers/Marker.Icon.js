const MARKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path fill="#2f6fed" stroke="#ffffff" stroke-width="1.5" d="M12.5 1C6.15 1 1 6.05 1 12.28c0 8.24 11.5 26.72 11.5 26.72S24 20.52 24 12.28C24 6.05 18.85 1 12.5 1z"/><circle cx="12.5" cy="12.2" r="4.7" fill="#ffffff"/></svg>`;

/** Default marker image as an inline data URI, so no asset pipeline is needed. */
export const DEFAULT_ICON_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(MARKER_SVG)}`;

const ICON_DEFAULTS = {
  iconUrl: DEFAULT_ICON_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowUrl: null,
  shadowSize: null,
  shadowAnchor: null,
  className: '',
  crossOrigin: false,
};

/**
 * Image-based marker icon. Sizes and anchors are in CSS pixels.
 */
export class Icon {
  /** @param {object} [options] */
  constructor(options = {}) {
    this.options = { ...ICON_DEFAULTS, ...options };
  }

  /**
   * Create the icon element.
   * @returns {HTMLImageElement}
   */
  createIcon() {
    const image = document.createElement('img');
    image.className = `sweety-marker-icon-img ${this.options.className}`.trim();
    image.src = this.options.iconUrl;
    image.alt = '';
    image.draggable = false;
    this._applySize(image, this.options.iconSize, this.options.iconAnchor);
    return image;
  }

  /**
   * Create an optional shadow element.
   * @returns {HTMLImageElement|null}
   */
  createShadow() {
    if (!this.options.shadowUrl) return null;
    const image = document.createElement('img');
    image.className = 'sweety-marker-shadow-img';
    image.src = this.options.shadowUrl;
    image.alt = '';
    image.draggable = false;
    this._applySize(image, this.options.shadowSize, this.options.shadowAnchor);
    return image;
  }

  /** @private */
  _applySize(element, size, anchor) {
    element.style.position = 'absolute';
    if (size) {
      element.style.width = `${size[0]}px`;
      element.style.height = `${size[1]}px`;
    }
    if (anchor) {
      element.style.left = `${-anchor[0]}px`;
      element.style.top = `${-anchor[1]}px`;
    }
  }
}

/**
 * HTML-based marker icon, useful for labels, counters and custom designs.
 */
export class DivIcon extends Icon {
  /** @param {object} [options] */
  constructor(options = {}) {
    super({ ...options, iconUrl: null });
    this.options = {
      ...this.options,
      html: options.html || '',
      bgPos: options.bgPos || [0, 0],
      className: options.className || '',
      iconSize: options.iconSize || [12, 12],
      iconAnchor: options.iconAnchor || [6, 6],
    };
  }

  /** @returns {HTMLDivElement} */
  createIcon() {
    const element = document.createElement('div');
    element.className = `sweety-div-icon ${this.options.className}`.trim();
    if (this.options.html instanceof HTMLElement) {
      element.appendChild(this.options.html);
    } else {
      element.innerHTML = this.options.html || '';
    }
    element.style.position = 'absolute';
    if (this.options.iconSize) {
      element.style.width = `${this.options.iconSize[0]}px`;
      element.style.height = `${this.options.iconSize[1]}px`;
    }
    if (this.options.iconAnchor) {
      element.style.left = `${-this.options.iconAnchor[0]}px`;
      element.style.top = `${-this.options.iconAnchor[1]}px`;
    }
    if (this.options.bgPos) {
      element.style.backgroundPosition = `${-this.options.bgPos[0]}px ${-this.options.bgPos[1]}px`;
    }
    return element;
  }

  /** @returns {null} */
  createShadow() {
    return null;
  }
}

/** Shared default marker icon. */
export const defaultIcon = new Icon();
