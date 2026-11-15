import { Layer, Util } from 'sweety-map';

const SVG_NS = 'http://www.w3.org/2000/svg';
const { cancelAnimFrame, requestAnimFrame } = Util;

/**
 * Отдельный SVG-слой для вершин, середин сегментов и углов. Он живёт в
 * собственной панели карты и не перерисовывает геометрию или тайлы: при
 * панорамировании меняются только координаты кружков.
 */
export class HandleLayer extends Layer {
  /** @param {import('../EditPlugin.js').EditPlugin} plugin */
  constructor(plugin) {
    super({ pane: 'map-edit-handles' });
    this.plugin = plugin;
    /** @type {any[]} */
    this._sessions = [];
    /** @type {Map<string, object>} */
    this._handlesById = new Map();
    /** @type {Map<string, SVGCircleElement>} */
    this._nodes = new Map();
    this._keys = '';
    this._frame = null;
    this._onMapChange = () => this.scheduleRender();
    this._onPointerDown = (event) => this._handlePointerDown(event);
    this._onContextMenu = (event) => this._handleContextMenu(event);
    this._onClick = (event) => this._handleClick(event);
    this._onDblClick = (event) => event.stopPropagation();
  }

  /** @param {any} map */
  onAdd(map) {
    this._pane = map.getPane('map-edit-handles');
    if (!this._pane) return;
    this._pane.classList.add('map-edit-handle-pane');
    this._pane.style.zIndex = String(this.plugin.options.zIndex ?? 640);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'map-edit-handles');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.overflow = 'visible';
    svg.style.pointerEvents = 'none';
    this._svg = svg;
    this._root = document.createElementNS(SVG_NS, 'g');
    this._root.setAttribute('class', 'map-edit-handle-group');
    svg.appendChild(this._root);
    this._pane.appendChild(svg);

    svg.addEventListener('pointerdown', this._onPointerDown);
    svg.addEventListener('contextmenu', this._onContextMenu);
    svg.addEventListener('click', this._onClick);
    svg.addEventListener('dblclick', this._onDblClick);

    map.on('move zoom resize viewreset zoomend', this._onMapChange, this);
    this._updateSize();
    this.render();
  }

  /** */
  onRemove() {
    if (this._svg) {
      this._svg.removeEventListener('pointerdown', this._onPointerDown);
      this._svg.removeEventListener('contextmenu', this._onContextMenu);
      this._svg.removeEventListener('click', this._onClick);
      this._svg.removeEventListener('dblclick', this._onDblClick);
      this._svg.remove();
      this._svg = null;
    }
    if (this._frame) {
      cancelAnimFrame(this._frame);
      this._frame = null;
    }
    if (this._map) this._map.off('move zoom resize viewreset zoomend', this._onMapChange, this);
    this._nodes.clear();
    this._handlesById.clear();
    this._keys = '';
    this._pane?.remove();
    this._pane = null;
  }

  /**
   * @param {any[]} sessions
   */
  setSessions(sessions) {
    this._sessions = sessions || [];
    this.render();
  }

  /** @private */
  _updateSize() {
    if (!this._svg || !this._map) return;
    const size = this._map.getSize();
    this._svg.setAttribute('width', String(size.x));
    this._svg.setAttribute('height', String(size.y));
    this._svg.style.width = `${size.x}px`;
    this._svg.style.height = `${size.y}px`;
  }

  /** Планирует перерисовку на следующий кадр. */
  scheduleRender() {
    if (this._frame) return;
    this._frame = requestAnimFrame(() => {
      this._frame = null;
      this.render();
    });
  }

  /** Пересчитывает позиции вершин или пересобирает слой при изменении набора. */
  render() {
    if (!this._root || !this._map) return;
    this._updateSize();

    const handles = [];
    for (const session of this._sessions) {
      if (!session.active) continue;
      handles.push(...session.getHandles());
    }

    const nextKeys = handles.map((handle) => handle.id).join('|');
    this._handlesById = new Map(handles.map((handle) => [handle.id, handle]));

    if (nextKeys !== this._keys) {
      this._keys = nextKeys;
      this._root.textContent = '';
      this._nodes.clear();
      for (const handle of handles) {
        const node = document.createElementNS(SVG_NS, 'circle');
        node.setAttribute('class', `map-edit-handle map-edit-handle-${handle.kind}`);
        node.setAttribute('data-edit-handle', handle.id);
        node.setAttribute('data-handle-kind', handle.kind);
        node.setAttribute('r', String(this._radius(handle)));
        node.setAttribute('vector-effect', 'non-scaling-stroke');
        if (handle.kind === 'midpoint') {
          node.setAttribute('data-handle-midpoint', 'true');
        }
        this._root.appendChild(node);
        this._nodes.set(handle.id, node);
      }
    }

    for (const handle of handles) {
      const node = this._nodes.get(handle.id);
      if (!node) continue;
      const point = this._map.latLngToContainerPoint(handle.latlng);
      node.setAttribute('cx', String(point.x));
      node.setAttribute('cy', String(point.y));
      node.setAttribute('r', String(this._radius(handle)));
    }
  }

  /** @private */
  _radius(handle) {
    if (handle.kind === 'midpoint') return Math.max(3, this.plugin.getHandleSize() * 0.45);
    return this.plugin.getHandleSize();
  }

  /** @private */
  _findHandle(event) {
    const target = /** @type {Element|null} */ (event.target);
    const node = target?.closest?.('[data-edit-handle]');
    const id = node?.getAttribute('data-edit-handle');
    return id ? this._handlesById.get(id) || null : null;
  }

  /** @private */
  _handlePointerDown(event) {
    const handle = this._findHandle(event);
    if (!handle) return;
    if (event.button !== undefined && event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    this.plugin._onHandlePointerDown(handle, event);
  }

  /** @private */
  _handleContextMenu(event) {
    const handle = this._findHandle(event);
    if (!handle) return;
    event.preventDefault();
    event.stopPropagation();
    this.plugin._onHandleContextMenu(handle, event);
  }

  /** @private */
  _handleClick(event) {
    const handle = this._findHandle(event);
    if (!handle) return;
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      this.plugin._onHandleCtrlClick(handle, event);
    }
  }
}
