import { Bounds } from 'sweety-map';
import {
  cloneLatLng,
  cloneLatLngs,
  getLayerKind,
  getRings,
  midpointLatLng,
  minimumVertices,
  pointAtDistance,
  restoreGeometry,
  snapshotGeometry,
  translateSnapshot,
} from './GeometryUtils.js';

let sessionCounter = 0;

/**
 * Сессия редактирования одного листового объекта. Хранит активность, строит
 * дескрипторы вершин и применяет изменения к геометрии. Никаких ссылок на
 * глобальное состояние: всё живёт в экземпляре сессии и плагина.
 */
export class EditSession {
  /**
   * @param {import('../EditPlugin.js').EditPlugin} plugin
   * @param {any} layer
   */
  constructor(plugin, layer) {
    this.plugin = plugin;
    this.layer = layer;
    this.kind = getLayerKind(layer);
    this.id = `s${(sessionCounter += 1)}`;
    this.active = true;
    /** @type {Element|null} */
    this._bodyTarget = null;
    this._bodyBound = false;
    this._onBodyPointerDown = (event) => this.plugin._onBodyPointerDown(this, event);
    this._onLayerAdd = () => this.bindBody();
    this._onLayerRemove = () => this.unbindBody();
    layer.on('add', this._onLayerAdd);
    layer.on('remove', this._onLayerRemove);
  }

  /** @returns {any} */
  get map() {
    return this.plugin.map;
  }

  /** @returns {boolean} */
  isGroup() {
    return false;
  }

  /**
   * Подпись набора вершин для сравнения при перерисовке SVG-слоя.
   * @returns {string}
   */
  getHandleSignature() {
    const rings = getRings(this.layer);
    return `${this.kind}:${rings.map((ring) => ring.length).join('.')}`;
  }

  /**
   * Строит дескрипторы вершин. Для больших геометрий прореживает вершины,
   * чтобы не создавать тысячи DOM-узлов.
   * @returns {object[]}
   */
  getHandles() {
    if (!this.active || !this.map) return [];
    const options = this.plugin.options;
    const maxHandles = Math.max(20, Number(options.maxHandles) || 400);
    const midpointsEnabled = options.midpoints !== false;

    if (this.kind === 'marker') {
      return [this._handle('p', 'vertex', this.layer.getLatLng(), { index: 0 })];
    }

    if (this.kind === 'circle') {
      const center = this.layer.getLatLng();
      const radius = this.layer.getRadius();
      return [
        this._handle('center', 'center', center, { index: 0 }),
        this._handle('radius', 'radius', pointAtDistance(center, radius, 90), { index: 0 }),
      ];
    }

    if (this.kind === 'rectangle') {
      const ring = getRings(this.layer)[0] || [];
      return ring.map((latlng, index) =>
        this._handle(`c:${index}`, 'corner', latlng, {
          index,
          opposite: ring[(index + 2) % ring.length]
            ? cloneLatLng(ring[(index + 2) % ring.length])
            : null,
        }),
      );
    }

    const rings = getRings(this.layer);
    const handles = [];
    rings.forEach((ring, part) => {
      if (!ring.length) return;
      const step = Math.max(1, Math.ceil(ring.length / maxHandles));
      for (let index = 0; index < ring.length; index += step) {
        handles.push(this._handle(`v:${part}:${index}`, 'vertex', ring[index], { part, index }));
      }
      // Последняя вершина важна для замыкания, даже если попала под прореживание.
      const last = ring.length - 1;
      if (last > 0 && last % step !== 0) {
        handles.push(
          this._handle(`v:${part}:${last}`, 'vertex', ring[last], { part, index: last }),
        );
      }

      if (!midpointsEnabled || ring.length > 200) return;
      const segmentCount = this.kind === 'polygon' ? ring.length : ring.length - 1;
      for (let index = 0; index < segmentCount; index += 1) {
        const next = ring[(index + 1) % ring.length];
        handles.push(
          this._handle(
            `m:${part}:${index}`,
            'midpoint',
            midpointLatLng(this.map, ring[index], next),
            {
              part,
              index,
              segment: index,
              midpoint: true,
            },
          ),
        );
      }
    });
    return handles;
  }

  /** @private */
  _handle(id, kind, latlng, extra = {}) {
    return {
      id: `${this.id}:${id}`,
      localId: id,
      kind,
      session: this,
      latlng: cloneLatLng(latlng),
      ...extra,
    };
  }

  /**
   * Применяет новую координату к вершине/центру/радиусу.
   * @param {object} handle
   * @param {import('sweety-map').LatLng} latlng
   */
  setVertex(handle, latlng) {
    if (!this.active) return;
    if (this.kind === 'marker') {
      this.layer.setLatLng(latlng);
      return;
    }
    if (this.kind === 'circle') {
      if (handle.kind === 'radius') {
        const radius = this.map.distance(this.layer.getLatLng(), latlng);
        this.layer.setRadius(Math.max(0, radius));
      } else {
        this.layer.setLatLng(latlng);
      }
      return;
    }
    if (this.kind === 'rectangle') {
      const opposite = handle.opposite || this._oppositeCorner(handle.index);
      if (!opposite) return;
      this.layer.setBounds(new Bounds(opposite, latlng));
      return;
    }
    const rings = cloneLatLngs(getRings(this.layer));
    const ring = rings[handle.part];
    if (!ring || !ring[handle.index]) return;
    ring[handle.index] = latlng;
    this.layer.setLatLngs(rings);
  }

  /** @private */
  _oppositeCorner(index) {
    const ring = getRings(this.layer)[0] || [];
    return ring[(index + 2) % ring.length] || null;
  }

  /**
   * Вставляет вершину в середину сегмента.
   * @param {object} handle midpoint-дескриптор
   * @returns {{part: number, index: number, handleId: string}|null}
   */
  insertVertex(handle) {
    if (this.kind !== 'polyline' && this.kind !== 'polygon') return null;
    const rings = cloneLatLngs(getRings(this.layer));
    const ring = rings[handle.part];
    if (!ring) return null;
    const max = this.plugin.getMaxVertices(this.kind);
    if (ring.length >= max) return null;

    const next = ring[(handle.index + 1) % ring.length];
    const latlng = midpointLatLng(this.map, ring[handle.index], next);
    ring.splice(handle.index + 1, 0, latlng);
    this.layer.setLatLngs(rings);
    return {
      part: handle.part,
      index: handle.index + 1,
      handleId: `${this.id}:v:${handle.part}:${handle.index + 1}`,
    };
  }

  /**
   * Удаляет вершину с проверкой минимума.
   * @param {object} handle
   * @returns {boolean} удалось ли удалить
   */
  deleteVertex(handle) {
    if (this.kind !== 'polyline' && this.kind !== 'polygon') return false;
    const rings = cloneLatLngs(getRings(this.layer));
    const ring = rings[handle.part];
    if (!ring) return false;
    const min = this.plugin.getMinVertices(this.kind);
    if (ring.length <= min) return false;
    ring.splice(handle.index, 1);
    this.layer.setLatLngs(rings);
    return true;
  }

  /** @returns {object|null} */
  getSnapshot() {
    return snapshotGeometry(this.layer);
  }

  /**
   * Восстанавливает геометрию из снимка.
   * @param {object|null} snapshot
   */
  restore(snapshot) {
    restoreGeometry(this.layer, snapshot);
  }

  /**
   * Сдвигает геометрию из исходного снимка на пиксельное смещение.
   * @param {object} snapshot
   * @param {import('sweety-map').Point|{x:number,y:number}} delta
   * @returns {object} новый снимок
   */
  translateFrom(snapshot, delta) {
    const next = translateSnapshot(this.map, snapshot, delta);
    restoreGeometry(this.layer, next);
    return next;
  }

  /**
   * Включает перетаскивание тела геометрии. Для маркера — его иконки, для
   * путей — SVG-path. Нативный capture-слушатель перехватывает жест раньше
   * обработчика панорамирования карты.
   */
  bindBody() {
    if (this._bodyBound || !this.active || !this.map || !this.map.hasLayer(this.layer)) return;
    const target =
      this.layer._path || (this.kind === 'marker' ? this.layer.getElement?.() : null) || null;
    if (!target) return;
    this._bodyTarget = target;
    target.classList.add('map-edit-body-target');
    target.addEventListener('pointerdown', this._onBodyPointerDown, true);
    this._bodyBound = true;
  }

  unbindBody() {
    if (!this._bodyBound || !this._bodyTarget) return;
    this._bodyTarget.removeEventListener('pointerdown', this._onBodyPointerDown, true);
    this._bodyTarget.classList.remove('map-edit-body-target');
    this._bodyTarget = null;
    this._bodyBound = false;
  }

  destroy() {
    this.unbindBody();
    this.layer.off('add', this._onLayerAdd);
    this.layer.off('remove', this._onLayerRemove);
    this.active = false;
  }

  /**
   * @param {number} part
   * @param {number} segmentIndex
   * @returns {any|null}
   */
  getSegment(part, segmentIndex) {
    const ring = getRings(this.layer)[part];
    if (!ring) return null;
    return {
      start: ring[segmentIndex],
      end: ring[(segmentIndex + 1) % ring.length],
    };
  }

  /**
   * Проверяет, достаточно ли вершин для типа.
   * @returns {boolean}
   */
  hasMinimumVertices() {
    if (this.kind === 'rectangle') return true;
    if (this.kind === 'marker' || this.kind === 'circle') return true;
    const rings = getRings(this.layer);
    const min = minimumVertices(this.kind, this.plugin.getMinVertices(this.kind));
    return rings.every((ring) => ring.length >= min);
  }
}

/**
 * Сессия группы (GeoJSONLayer/FeatureGroup/MultiPolygon): агрегирует дочерние
 * сессии, показывает их вершины и двигает все части как один объект.
 */
export class GroupEditSession {
  /**
   * @param {import('../EditPlugin.js').EditPlugin} plugin
   * @param {any} layer
   * @param {EditSession[]} children
   */
  constructor(plugin, layer, children) {
    this.plugin = plugin;
    this.layer = layer;
    this.children = children;
    this.kind = 'group';
    this.id = `g${(sessionCounter += 1)}`;
    this.active = true;
  }

  get map() {
    return this.plugin.map;
  }

  isGroup() {
    return true;
  }

  getHandleSignature() {
    return `group:${this.children.map((child) => child.getHandleSignature()).join('|')}`;
  }

  getHandles() {
    if (!this.active) return [];
    return this.children.flatMap((child) =>
      child.getHandles().map((handle) => ({ ...handle, group: this })),
    );
  }

  setVertex(handle, latlng) {
    handle.session.setVertex(handle, latlng);
  }

  insertVertex(handle) {
    return handle.session.insertVertex(handle);
  }

  deleteVertex(handle) {
    return handle.session.deleteVertex(handle);
  }

  getSnapshot() {
    return this.children.map((child) => ({ layer: child.layer, snapshot: child.getSnapshot() }));
  }

  restore(snapshot) {
    if (!Array.isArray(snapshot)) return;
    for (const entry of snapshot) restoreGeometry(entry.layer, entry.snapshot);
  }

  /**
   * Сдвигает все части группы.
   * @param {Array<{layer:any, snapshot:object}>} snapshot
   * @param {import('sweety-map').Point|{x:number,y:number}} delta
   * @returns {Array<{layer:any, snapshot:object}>}
   */
  translateFrom(snapshot, delta) {
    return snapshot.map((entry) => {
      const next = translateSnapshot(this.map, entry.snapshot, delta);
      restoreGeometry(entry.layer, next);
      return { layer: entry.layer, snapshot: next };
    });
  }

  bindBody() {
    for (const child of this.children) child.bindBody();
  }

  unbindBody() {
    for (const child of this.children) child.unbindBody();
  }

  destroy() {
    for (const child of this.children) child.destroy();
    this.active = false;
  }

  getLayers() {
    return this.children.map((child) => child.layer);
  }

  hasLayer(layer) {
    return this.children.some((child) => child.layer === layer);
  }
}
