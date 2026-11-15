import { Layer } from 'sweety-map';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Ghost-слой предпросмотра при рисовании. Использует собственную SVG-панель,
 * поэтому не меняет стили реальных слоёв и не вызывает их перерисовку.
 */
export class GhostLayer extends Layer {
  /** @param {import('../EditPlugin.js').EditPlugin} plugin */
  constructor(plugin) {
    super({ pane: 'map-edit-ghost' });
    this.plugin = plugin;
    /** @type {object|null} */
    this.state = null;
  }

  /** @param {any} map */
  onAdd(map) {
    this._pane = map.getPane('map-edit-ghost');
    if (!this._pane) return;
    this._pane.classList.add('map-edit-ghost-pane');
    this._pane.style.zIndex = String((this.plugin.options.zIndex ?? 640) - 20);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'map-edit-ghost');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.overflow = 'visible';
    svg.style.pointerEvents = 'none';
    this._svg = svg;
    this._root = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(this._root);
    this._pane.appendChild(svg);
    this._onMapChange = () => this.render();
    map.on('move zoom resize viewreset zoomend', this._onMapChange, this);
    this.render();
  }

  /** */
  onRemove() {
    if (this._map) this._map.off('move zoom resize viewreset zoomend', this._onMapChange, this);
    this._svg?.remove();
    this._svg = null;
    this._root = null;
    this._pane?.remove();
    this._pane = null;
  }

  /**
   * @param {object|null} state
   * @param {'marker'|'line'|'polygon'|'rectangle'|'circle'} [state.type]
   * @param {any[]} [state.points] подтверждённые вершины
   * @param {any} [state.cursor] текущая позиция курсора
   * @param {any} [state.center]
   * @param {any} [state.edge]
   */
  show(state) {
    this.state = state;
    this.render();
  }

  /** Очищает предпросмотр, оставляя слой на карте. */
  clear() {
    this.state = null;
    if (this._root) this._root.textContent = '';
  }

  /** Перерисовывает предпросмотр в экранных координатах. */
  render() {
    if (!this._root || !this._map) return;
    this._updateSize();
    this._root.textContent = '';
    if (!this.state) return;

    const state = this.state;
    if (state.type === 'marker') {
      if (!state.cursor) return;
      this._appendCircle(state.cursor, 9, 'map-edit-ghost-marker');
      return;
    }

    if (state.type === 'circle') {
      if (!state.center) return;
      const center = this._map.latLngToContainerPoint(state.center);
      const edge = state.edge ? this._map.latLngToContainerPoint(state.edge) : null;
      const radius = edge ? Math.hypot(edge.x - center.x, edge.y - center.y) : 0;
      this._appendCircle(state.center, radius, 'map-edit-ghost-circle');
      if (radius > 0)
        this._appendLine(
          [
            [center.x, center.y],
            [edge.x, edge.y],
          ],
          true,
        );
      return;
    }

    if (state.type === 'rectangle') {
      const points = (state.points || []).concat(state.cursor ? [state.cursor] : []);
      if (points.length < 2) {
        if (state.cursor) this._appendCircle(state.cursor, 4, 'map-edit-ghost-vertex');
        return;
      }
      const a = this._map.latLngToContainerPoint(points[0]);
      const b = this._map.latLngToContainerPoint(points[1]);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const width = Math.abs(a.x - b.x);
      const height = Math.abs(a.y - b.y);
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
      rect.setAttribute('class', 'map-edit-ghost-path');
      this._root.appendChild(rect);
      for (const point of [a, b]) this._appendPixelCircle(point, 4, 'map-edit-ghost-vertex');
      return;
    }

    const points = (state.points || []).concat(state.cursor ? [state.cursor] : []);
    if (!points.length) return;
    const pixels = points.map((latlng) => this._map.latLngToContainerPoint(latlng));
    const closed = state.type === 'polygon' && points.length > 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', this._pathData(pixels, closed));
    path.setAttribute('class', 'map-edit-ghost-path');
    this._root.appendChild(path);
    for (const point of pixels.slice(0, -1)) {
      this._appendPixelCircle(point, 4, 'map-edit-ghost-vertex');
    }
    if (state.cursor) {
      this._appendPixelCircle(pixels[pixels.length - 1], 5, 'map-edit-ghost-cursor');
    }
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

  /** @private */
  _pathData(points, closed) {
    let data = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let index = 1; index < points.length; index += 1) {
      data += `L${points[index].x.toFixed(1)} ${points[index].y.toFixed(1)}`;
    }
    return closed ? `${data}Z` : data;
  }

  /** @private */
  _appendLine(points, dashed) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', this._pathData(points, false));
    path.setAttribute('class', dashed ? 'map-edit-ghost-line' : 'map-edit-ghost-path');
    this._root.appendChild(path);
  }

  /** @private */
  _appendCircle(latlng, radius, className) {
    const point = this._map.latLngToContainerPoint(latlng);
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.setAttribute('r', String(Math.max(0, radius)));
    circle.setAttribute('class', className);
    this._root.appendChild(circle);
    return circle;
  }

  /** @private */
  _appendPixelCircle(point, radius, className) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(point.x));
    circle.setAttribute('cy', String(point.y));
    circle.setAttribute('r', String(radius));
    circle.setAttribute('class', className);
    this._root.appendChild(circle);
    return circle;
  }
}
