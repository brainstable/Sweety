import { DomUtil, Evented, Point, Util } from 'sweety-map';
import { EditMode, isEditMode } from './EditMode.js';
import { DEFAULT_I18N, translate } from './i18n.js';
import {
  closestPointOnSegment,
  findSelfIntersections,
  getLayerKind,
  getLayerVertices,
  getRings,
  pointAtDistance,
  pointInRing,
} from './core/GeometryUtils.js';
import { CommandStack } from './core/CommandStack.js';
import {
  AddVertexCommand,
  CreateLayerCommand,
  DeleteLayerCommand,
  DeleteVertexCommand,
  MoveLayerCommand,
  MoveVertexCommand,
} from './core/Command.js';
import { EditSession, GroupEditSession } from './core/EditSession.js';
import { HandleLayer } from './layers/HandleLayer.js';
import { GhostLayer } from './layers/GhostLayer.js';
import { BodyDragHandler } from './handlers/BodyDragHandler.js';
import { MidpointHandler } from './handlers/MidpointHandler.js';
import { VertexHandler } from './handlers/VertexHandler.js';
import { DrawHandler } from './handlers/DrawHandler.js';
import { EditControl } from './control/EditControl.js';
import { DrawToolbar } from './control/DrawToolbar.js';

const { stamp, requestAnimFrame, cancelAnimFrame } = Util;

/** Настройки по умолчанию. */
export const DEFAULT_OPTIONS = {
  position: 'topleft',
  toolbarPosition: 'bottomleft',
  modes: [
    'select',
    'edit',
    'draw:marker',
    'draw:polyline',
    'draw:polygon',
    'draw:circle',
    'draw:rectangle',
    'delete',
    'undo',
    'redo',
  ],
  control: true,
  toolbar: true,
  keyboard: true,
  undoRedo: true,
  maxHistory: 100,
  autoEdit: true,
  confirmDelete: null,
  snap: {
    enabled: false,
    gridSize: 10,
    toVertices: true,
    tolerance: 10,
  },
  limits: {
    polygon: { min: 3, max: Infinity },
    polyline: { min: 2, max: Infinity },
  },
  warnSelfIntersection: true,
  maxHandles: 400,
  midpoints: true,
  edgePan: {
    enabled: true,
    margin: 24,
    speed: 16,
  },
  style: {
    handleSize: 8,
    handleColor: '#ffffff',
    handleStroke: '#1f2937',
    midpointColor: '#93c5fd',
    stroke: '#2f6fed',
    fill: 'rgba(47, 111, 237, 0.15)',
    ghostOpacity: 0.65,
    selectedColor: '#f59e0b',
    selectedWeight: 4,
  },
  handles: {},
  vertexStyle: {},
  midpointStyle: {},
  selectedStyle: {},
  ghostStyle: {},
  i18n: {},
  theme: null,
  className: '',
  zIndex: 640,
  target: null,
};

/**
 * @param {object} base
 * @param {object} overrides
 * @returns {object}
 */
function mergeOptions(base, overrides = {}) {
  const result = { ...base, ...overrides };
  for (const key of [
    'snap',
    'style',
    'edgePan',
    'i18n',
    'handles',
    'vertexStyle',
    'midpointStyle',
    'selectedStyle',
    'ghostStyle',
  ]) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = { ...(base[key] || {}), ...overrides[key] };
    }
  }
  result.limits = {};
  for (const type of ['polygon', 'polyline']) {
    result.limits[type] = {
      ...(base.limits?.[type] || {}),
      ...(overrides.limits?.[type] || {}),
    };
  }
  return result;
}

/**
 * Собирает листовые редактируемые слои, разворачивая вложенные группы.
 * @param {any} layer
 * @param {any[]} [out]
 * @returns {any[]}
 */
function collectEditableLeaves(layer, out = []) {
  const kind = getLayerKind(layer);
  if (kind === 'group') {
    layer.eachLayer((child) => collectEditableLeaves(child, out));
  } else if (kind) {
    out.push(layer);
  }
  return out;
}

/** @param {any} layer */
function isCoarsePointer() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

/**
 * Плагин редактирования геометрии. Полностью использует публичный API Sweety и
 * не требует изменений ядра.
 *
 * @example
 * const editor = new EditPlugin(map, { position: 'topleft' });
 * editor.enableEdit(polygon);
 * editor.setMode('edit');
 */
export class EditPlugin extends Evented {
  /** @type {string} */
  static version = '0.1.0';

  /**
   * Устанавливает плагин на карту и возвращает существующий экземпляр, если он
   * уже создан.
   * @param {any} map
   * @param {object} [options]
   * @returns {EditPlugin}
   */
  static install(map, options = {}) {
    const existing = map?.editPlugin;
    if (existing && !existing._destroyed) return existing;
    return new EditPlugin(map, options);
  }

  /**
   * @param {any} map
   * @param {object} [options]
   */
  constructor(map, options = {}) {
    super();
    if (!map || typeof map.on !== 'function' || typeof map.getContainer !== 'function') {
      throw new TypeError('EditPlugin requires a Sweety Map instance');
    }
    this.map = map;
    this.options = mergeOptions(DEFAULT_OPTIONS, options);
    this.messages = { ...DEFAULT_I18N, ...(this.options.i18n || {}) };
    this._mode = new EditMode('idle');
    /** @type {Map<number, any>} */
    this._sessions = new Map();
    /** @type {Map<any, any>} */
    this._roots = new Map();
    /** @type {Set<any>} */
    this._selected = new Set();
    this._stack = new CommandStack({ limit: this.options.maxHistory });
    this._draw = null;
    this._toolbar = null;
    this._destroyed = false;
    this._destroying = false;
    this._suppressClick = false;
    this._suppressHandleClick = false;
    this._longPressTimer = null;
    this._drag = null;
    this._bodyDrag = null;
    this._activeHandler = null;
    this._pendingPointer = null;
    this._dragFrame = null;
    this._cssVars = [];
    this._intersectionState = new WeakMap();
    this._selectionDuringDraw = null;

    this._onMapClick = (event) => this._handleMapClick(event);
    this._onLayerRemove = (event) => this._handleLayerRemove(event);
    this._onKeyDown = (event) => this._handleKeyDown(event);
    this._onDocPointerMove = (event) => this._queuePointer(event);
    this._onDocPointerUp = (event) => this._handlePointerUp(event);
    this._onDocPointerCancel = () => this._cancelActiveDrag(true);

    this._applyStyles();

    this.handleLayer = new HandleLayer(this);
    this.map.addLayer(this.handleLayer);
    this.ghostLayer = null;

    this.control = null;
    if (this.options.control) {
      this.control = new EditControl(this, {
        position: this.options.position,
        modes: this.options.modes,
        i18n: this.messages,
      });
      this.map.addControl(this.control);
    }

    this.map.on('click', this._onMapClick, this);
    this.map.on('layerremove', this._onLayerRemove, this);
    if (this.options.keyboard) document.addEventListener('keydown', this._onKeyDown);

    this.map.editPlugin = this;
    if (typeof this.map.edit !== 'function') {
      this.map.edit = (opts) => EditPlugin.install(this.map, opts);
    }

    this.fire('ready', { plugin: this });
  }

  /* ----------------------------------------------------------------------- *
   * Режимы
   * ----------------------------------------------------------------------- */

  /** @returns {'idle'|'select'|'edit'|'create'|'delete'} */
  getMode() {
    return this._mode.mode;
  }

  /**
   * @param {'idle'|'select'|'edit'|'create'|'delete'} mode
   * @returns {this}
   */
  setMode(mode) {
    if (!isEditMode(mode)) throw new RangeError(`Unknown edit mode: ${String(mode)}`);
    if (this._destroyed) throw new Error('EditPlugin is destroyed');
    if (this._draw && mode !== 'create') {
      this._cancelDrawing(this._draw, 'modechange', { silentMode: true });
    }
    const result = this._mode.set(mode);
    if (result.changed) {
      this._refreshAll();
      this.fire('modechange', { mode: this._mode.mode, previousMode: result.previous });
    } else {
      this._refreshAll();
    }
    return this;
  }

  /* ----------------------------------------------------------------------- *
   * Выбор и подсветка
   * ----------------------------------------------------------------------- */

  /** @returns {any[]} */
  getSelected() {
    return [...this._selected];
  }

  /**
   * @param {any} layer
   * @param {boolean} [additive=false]
   * @returns {boolean}
   */
  selectLayer(layer, additive = false) {
    if (!layer || this._destroyed) return false;
    const root = this._resolveSelectionRoot(layer);
    const selectable = this._ensureSelectable(root, layer);
    if (!selectable) return false;

    if (!additive) {
      for (const selected of [...this._selected]) {
        if (selected !== selectable) this._removeSelectionRoot(selected, true);
      }
    }
    if (this._selected.has(selectable)) {
      this._refreshAll();
      return true;
    }

    this._selected.add(selectable);
    this._highlight(selectable);
    this._refreshAll();
    this.fire('select', {
      layer: selectable,
      layers: this.getSelected(),
      additive,
    });
    return true;
  }

  /**
   * @param {any} layer
   * @returns {boolean}
   */
  unselectLayer(layer) {
    const root = this._resolveSelectionRoot(layer);
    if (!this._selected.has(root)) return false;
    this._removeSelectionRoot(root, false);
    this._refreshAll();
    return true;
  }

  /**
   * Переключает выбор (Shift/Ctrl+клик).
   * @param {any} layer
   * @returns {boolean}
   */
  toggleSelection(layer) {
    const root = this._resolveSelectionRoot(layer);
    if (this._selected.has(root)) {
      this._removeSelectionRoot(root, false);
      this._refreshAll();
      return false;
    }
    return this.selectLayer(root, true);
  }

  /** @returns {boolean} */
  isSelected(layer) {
    return Boolean(layer && this._selected.has(layer));
  }

  clearSelection() {
    if (!this._selected.size) return this;
    const layers = this.getSelected();
    for (const root of layers) this._removeSelectionRoot(root, true);
    this.fire('unselect', { layers, layer: layers[0] || null });
    this._refreshAll();
    return this;
  }

  /** @private */
  _removeSelectionRoot(root, silent) {
    if (!this._selected.has(root)) return;
    this._selected.delete(root);
    this._unhighlight(root);
    if (!silent) {
      this.fire('unselect', { layer: root, layers: this.getSelected() });
    }
  }

  /** @private */
  _resolveSelectionRoot(layer) {
    let root = layer;
    let parent = this._parentGroup(root);
    while (parent && parent._map === this.map) {
      root = parent;
      parent = this._parentGroup(root);
    }
    return root;
  }

  /** @private */
  _parentGroup(layer) {
    // Сканируем только публичный список слоёв и публичный hasLayer, не заглядывая
    // в _eventParents ядра.
    let found = null;
    for (const candidate of this.map.getLayers()) {
      if (candidate === layer || getLayerKind(candidate) !== 'group') continue;
      if (typeof candidate.hasLayer !== 'function') continue;
      if (candidate.hasLayer(layer)) found = candidate;
    }
    if (!found) return null;
    // Поднимаемся к внешней группе, если группы вложены.
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of this.map.getLayers()) {
        if (candidate === found || getLayerKind(candidate) !== 'group') continue;
        if (typeof candidate.hasLayer === 'function' && candidate.hasLayer(found)) {
          found = candidate;
          changed = true;
          break;
        }
      }
    }
    return found;
  }

  /** @private */
  _ensureSelectable(root, source) {
    if (!root) return null;
    if (this._sessions.has(stamp(root))) return root;
    if (this.enableEdit(root)) return root;
    if (source && source !== root && this.enableEdit(source)) return source;
    return null;
  }

  /** @private */
  _highlight(layer) {
    const kind = getLayerKind(layer);
    if (kind === 'group') {
      layer.eachLayer((child) => this._highlight(child));
      return;
    }
    if (!kind) return;
    if (kind === 'marker') layer.getElement?.()?.classList.add('map-edit-selected');
    else layer._path?.classList.add('map-edit-selected');
  }

  /** @private */
  _unhighlight(layer) {
    const kind = getLayerKind(layer);
    if (kind === 'group') {
      layer.eachLayer((child) => this._unhighlight(child));
      return;
    }
    if (!kind) return;
    if (kind === 'marker') layer.getElement?.()?.classList.remove('map-edit-selected');
    else layer._path?.classList.remove('map-edit-selected');
  }

  /* ----------------------------------------------------------------------- *
   * Включение редактирования
   * ----------------------------------------------------------------------- */

  /**
   * @param {any} layer
   * @returns {EditSession|GroupEditSession|null}
   */
  enableEdit(layer) {
    if (!layer || this._destroyed) return null;
    const existing = this._sessions.get(stamp(layer));
    if (existing && existing.active) return existing;
    const kind = getLayerKind(layer);
    if (!kind) return null;

    if (kind === 'group') {
      const leaves = collectEditableLeaves(layer);
      if (!leaves.length) return null;
      const children = [];
      for (const leaf of leaves) {
        let session = this._sessions.get(stamp(leaf));
        if (!session || !session.active) {
          session = new EditSession(this, leaf);
          this._sessions.set(stamp(leaf), session);
        }
        children.push(session);
      }
      const groupSession = new GroupEditSession(this, layer, children);
      this._sessions.set(stamp(layer), groupSession);
      for (const child of children) this._roots.set(child.layer, groupSession);
      groupSession.bindBody();
      this.fire('edit:enabled', { layer });
      this._refreshAll();
      return groupSession;
    }

    const session = new EditSession(this, layer);
    this._sessions.set(stamp(layer), session);
    this._roots.set(layer, session);
    session.bindBody();
    this.fire('edit:enabled', { layer });
    this._refreshAll();
    return session;
  }

  /**
   * @param {any} layer
   * @returns {boolean}
   */
  disableEdit(layer) {
    const session = this._sessions.get(stamp(layer));
    if (!session) return false;
    this._teardownSession(session);
    this.fire('edit:disabled', { layer });
    this._refreshAll();
    return true;
  }

  /** @returns {boolean} */
  isEditable(layer) {
    return Boolean(layer && this._sessions.get(stamp(layer))?.active);
  }

  /** @returns {EditSession|GroupEditSession|null} */
  getSession(layer) {
    return layer ? this._sessions.get(stamp(layer)) || null : null;
  }

  /** @private */
  _teardownSession(session) {
    if (!session) return;
    if (session.isGroup()) {
      for (const child of session.children) {
        child.destroy();
        this._sessions.delete(stamp(child.layer));
        this._roots.delete(child.layer);
        if (this._selected.delete(child.layer)) this._unhighlight(child.layer);
      }
      this._sessions.delete(stamp(session.layer));
      if (this._selected.delete(session.layer)) this._unhighlight(session.layer);
      session.destroy();
      return;
    }
    const root = this._roots.get(session.layer);
    if (root && root.isGroup() && root.active && root !== session) {
      const index = root.children.indexOf(session);
      if (index !== -1) root.children.splice(index, 1);
      session.destroy();
      this._sessions.delete(stamp(session.layer));
      this._roots.delete(session.layer);
      if (this._selected.delete(session.layer)) this._unhighlight(session.layer);
      if (!root.children.length) this._teardownSession(root);
      return;
    }
    session.destroy();
    this._sessions.delete(stamp(session.layer));
    this._roots.delete(session.layer);
    if (this._selected.delete(session.layer)) this._unhighlight(session.layer);
  }

  /** @private */
  _rootSessionForLayer(layer) {
    const root = this._roots.get(layer);
    if (root && root.active) return root;
    const session = this._sessions.get(stamp(layer));
    return session && session.active ? session : null;
  }

  /** @private */
  _visibleSessions() {
    const sessions = [];
    const seen = new Set();
    for (const root of this._selected) {
      const session = this._sessions.get(stamp(root));
      if (!session || !session.active) continue;
      const list = session.isGroup() ? session.children : [session];
      for (const child of list) {
        if (child.active && !seen.has(child.id)) {
          seen.add(child.id);
          sessions.push(child);
        }
      }
    }
    return sessions;
  }

  /* ----------------------------------------------------------------------- *
   * Рисование
   * ----------------------------------------------------------------------- */

  /**
   * @param {'marker'|'polyline'|'polygon'|'circle'|'rectangle'} type
   * @param {{target?: any, toolbar?: boolean, style?: object}} [options]
   * @returns {DrawHandler}
   */
  startDrawing(type, options = {}) {
    if (this._destroyed) throw new Error('EditPlugin is destroyed');
    if (this._draw) this._cancelDrawing(this._draw, 'replaced', { silentMode: true });
    if (this._mode.mode !== 'create') this.setMode('create');
    if (!this.ghostLayer) this.ghostLayer = new GhostLayer(this);
    if (!this.map.hasLayer(this.ghostLayer)) this.map.addLayer(this.ghostLayer);
    this.ghostLayer.clear();

    if (this.options.toolbar && options.toolbar !== false && !this._toolbar) {
      this._toolbar = new DrawToolbar(this, {
        position: this.options.toolbarPosition,
        i18n: this.messages,
      });
      this.map.addControl(this._toolbar);
    }

    const handler = new DrawHandler(this, type, options);
    this._draw = handler;
    handler.start();
    this._refreshAll();
    return handler;
  }

  /** @returns {boolean} */
  finishDrawing() {
    return this._draw ? this._draw.finish() : false;
  }

  /** @returns {boolean} */
  cancelDrawing() {
    if (!this._draw) return false;
    const handler = this._draw;
    this._cancelDrawing(handler, 'api', { silentMode: false });
    return true;
  }

  /** @returns {string|null} */
  getDrawType() {
    return this._draw ? this._draw.type : null;
  }

  /** @returns {boolean} */
  isDrawing() {
    return Boolean(this._draw);
  }

  /** @private */
  _drawCompleted(handler, layer) {
    if (this._draw !== handler) return;
    handler.teardown();
    this._draw = null;
    this._removeDrawUi();

    const parent =
      handler.target &&
      typeof handler.target.addLayer === 'function' &&
      this.map.hasLayer(handler.target)
        ? handler.target
        : null;
    if (parent) parent.addLayer(layer);
    else this.map.addLayer(layer);

    const command = new CreateLayerCommand(layer, {
      map: this.map,
      parent,
      label: `Draw ${handler.type}`,
    });
    command.editable = true;
    if (this.options.undoRedo) this._stack.push(command, { apply: false });

    this.fire('draw:completed', { layer, type: handler.type, parent });
    this.fire('create', { layer, type: handler.type, parent });

    this.setMode('select');
    this.enableEdit(parent || layer);
    this.selectLayer(parent || layer, false);
    this._refreshAll();
  }

  /** @private */
  _cancelDrawing(handler, reason, { silentMode = false } = {}) {
    if (this._draw !== handler) return;
    handler.teardown();
    this._draw = null;
    this._removeDrawUi();
    this.fire('draw:canceled', { type: handler.type, reason });
    if (!silentMode && this._mode.mode === 'create') this.setMode('select');
    this._refreshAll();
  }

  /** @private */
  _removeDrawUi() {
    if (this._toolbar) {
      this.map.removeControl(this._toolbar);
      this._toolbar = null;
    }
    if (this.ghostLayer) {
      this.ghostLayer.clear();
      if (this.map.hasLayer(this.ghostLayer)) this.map.removeLayer(this.ghostLayer);
      this.ghostLayer = null;
    }
  }

  /** @private */
  _updateDrawToolbar(handler) {
    if (!this._toolbar) return;
    const key = {
      marker: 'hintMarker',
      polyline: 'hintPolyline',
      polygon: 'hintPolygon',
      circle: 'hintCircle',
      rectangle: 'hintRectangle',
    }[handler.type];
    let hint = this.t(key);
    if (handler.type === 'polyline' || handler.type === 'polygon') {
      hint += ` · ${this.t('vertices', { count: handler.vertices.length })}`;
    }
    this._toolbar.setHint(hint);
    this._toolbar.setCanFinish(handler.canFinish());
  }

  /** @private */
  getDrawStyle(type) {
    const base = {
      color: '#2f6fed',
      weight: 3,
      opacity: 1,
      fill: type === 'polygon' || type === 'circle' || type === 'rectangle',
      fillOpacity: 0.2,
    };
    const drawStyle = this.options.drawStyle;
    let style = {};
    if (typeof drawStyle === 'function') style = drawStyle(type) || {};
    else if (drawStyle && typeof drawStyle === 'object') {
      style = drawStyle[type] && typeof drawStyle[type] === 'object' ? drawStyle[type] : drawStyle;
    }
    return { ...base, ...this.options.layerOptions, ...style };
  }

  /* ----------------------------------------------------------------------- *
   * Удаление
   * ----------------------------------------------------------------------- */

  /**
   * @param {any} layer
   * @returns {boolean}
   */
  deleteLayer(layer) {
    if (!layer || this._destroyed) return false;
    const root = this._resolveSelectionRoot(layer);
    if (!clientConfirm(this.options.confirmDelete, root, this)) return false;
    const layers = getLayerKind(root) === 'group' ? collectEditableLeaves(root) : [root];
    if (!layers.length) return false;

    const command = new DeleteLayerCommand(root, {
      map: this.map,
      parent: this._parentGroup(root),
      label: 'Delete layer',
    });
    if (this.options.undoRedo) this._stack.push(command);
    else command.execute();

    this.fire('delete', { layer: root, layers, command });
    this._refreshAll();
    return true;
  }

  /** @returns {number} */
  deleteSelected() {
    const roots = this.getSelected();
    let count = 0;
    for (const root of roots) {
      if (this.deleteLayer(root)) count += 1;
    }
    return count;
  }

  /* ----------------------------------------------------------------------- *
   * Undo/Redo
   * ----------------------------------------------------------------------- */

  canUndo() {
    return this.options.undoRedo !== false && this._stack.canUndo();
  }

  canRedo() {
    return this.options.undoRedo !== false && this._stack.canRedo();
  }

  undo() {
    if (this._draw) return false;
    if (!this.canUndo()) return false;
    this._cancelActiveDrag(true);
    const command = this._stack.undo();
    if (!command) return false;
    this._afterCommand(command, 'undo');
    this.fire('undo', { command });
    this._refreshAll();
    return true;
  }

  redo() {
    if (this._draw) return false;
    if (!this.canRedo()) return false;
    this._cancelActiveDrag(true);
    const command = this._stack.redo();
    if (!command) return false;
    this._afterCommand(command, 'redo');
    this.fire('redo', { command });
    this._refreshAll();
    return true;
  }

  /** @private */
  _afterCommand(command, action) {
    if (!command) return;
    if (command.kind === 'composite') {
      for (const child of command.commands) this._afterCommand(child, action);
      return;
    }
    if (command.kind === 'geometry') {
      const layers = command.entries.map((entry) => entry.layer).filter(Boolean);
      this._emitUpdate(layers, action, { command });
      return;
    }
    if (command.kind === 'create' || command.kind === 'delete') {
      const layer = command.layer;
      const target = command.parent || layer;
      if (action === 'undo' && command.kind === 'delete') {
        if (this.map.hasLayer(target)) this.enableEdit(target);
        if (this.map.hasLayer(layer)) this.enableEdit(layer);
      }
      if (action === 'redo' && command.kind === 'create') {
        if (this.map.hasLayer(target)) this.enableEdit(target);
        if (this.map.hasLayer(layer)) this.enableEdit(layer);
      }
      this._refreshAll();
    }
  }

  /* ----------------------------------------------------------------------- *
   * Геометрия и drag
   * ----------------------------------------------------------------------- */

  /** @private */
  _onHandlePointerDown(handle, event) {
    if (this._destroyed || this._mode.mode !== 'edit' || !handle) return;
    if (event.ctrlKey || event.metaKey) {
      this._suppressHandleClick = true;
      this._deleteHandleVertex(handle, 'ctrl');
      setTimeout(() => {
        this._suppressHandleClick = false;
      }, 0);
      return;
    }
    const Handler = handle.kind === 'midpoint' ? MidpointHandler : VertexHandler;
    this._activeHandler = new Handler(this);
    this._activeHandler.start(handle, event);
  }

  /** @private */
  _beginVertexDrag(handle, event) {
    const session = handle.session;
    const before = session.getSnapshot();
    let targetHandle = handle;
    let inserted = null;
    if (handle.kind === 'midpoint') {
      const result = session.insertVertex(handle);
      if (!result) {
        this._activeHandler = null;
        this.fire('vertexlimit', { layer: session.layer, handle });
        return;
      }
      inserted = result;
      targetHandle = {
        ...handle,
        kind: 'vertex',
        localId: `v:${result.part}:${result.index}`,
        part: result.part,
        index: result.index,
        midpoint: false,
      };
      this._refreshHandles();
    }

    const point = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    this._drag = {
      handle: targetHandle,
      session,
      before,
      inserted: Boolean(inserted),
      startPoint: point,
      moved: false,
    };
    document.addEventListener('pointermove', this._onDocPointerMove);
    document.addEventListener('pointerup', this._onDocPointerUp);
    document.addEventListener('pointercancel', this._onDocPointerCancel);
    this._startLongPress(targetHandle);
    event.preventDefault?.();
  }

  /** @private */
  _onBodyPointerDown(session, event) {
    if (this._destroyed || this._mode.mode !== 'edit' || !session) return;
    this._activeHandler = new BodyDragHandler(this);
    this._activeHandler.start(session, event);
  }

  /** @private */
  _beginBodyDrag(session, event) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      this._activeHandler = null;
      return;
    }
    const root = this._rootSessionForLayer(session.layer) || session;
    if (!this._selected.has(root.layer) && !this._selected.has(session.layer)) {
      this._activeHandler = null;
      return;
    }

    event.preventDefault?.();
    event.stopPropagation?.();
    const startPoint = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    this._bodyDrag = {
      root,
      snapshot: root.getSnapshot(),
      startPoint,
      startLatLng: this.map.containerPointToLatLng(startPoint),
      moved: false,
    };
    document.addEventListener('pointermove', this._onDocPointerMove);
    document.addEventListener('pointerup', this._onDocPointerUp);
    document.addEventListener('pointercancel', this._onDocPointerCancel);
  }

  /** @private */
  _queuePointer(event) {
    this._pendingPointer = event;
    if (this._dragFrame) return;
    this._dragFrame = requestAnimFrame(() => {
      this._dragFrame = null;
      const pending = this._pendingPointer;
      this._pendingPointer = null;
      if (!pending) return;
      if (this._activeHandler) this._activeHandler.move(pending);
      else this._processPointerMove(pending);
    });
  }

  /** @private */
  _processPointerMove(event) {
    if (this._drag) this._processHandleMove(event);
    else if (this._bodyDrag) this._processBodyMove(event);
  }

  /** @private */
  _processHandleMove(event) {
    const drag = this._drag;
    if (!drag) return;
    let point = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    if (point.distanceTo(drag.startPoint) > 2) {
      drag.moved = true;
      this._clearLongPress();
    }
    this._edgePan(point);
    point = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    const latlng = this._snapLatLng(this.map.containerPointToLatLng(point), drag.session);
    drag.session.setVertex(drag.handle, latlng);
    drag.handle.latlng = latlng;
    this.handleLayer?.scheduleRender();
  }

  /** @private */
  _processBodyMove(event) {
    const drag = this._bodyDrag;
    if (!drag) return;
    let point = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    if (point.distanceTo(drag.startPoint) > 2) drag.moved = true;
    this._edgePan(point);
    point = new Point(DomUtil.getMousePosition(event, this.map.getContainer()));
    const current = this.map.containerPointToLatLng(point);
    const delta = this.map.project(current).subtract(this.map.project(drag.startLatLng));
    drag.after = drag.root.translateFrom(drag.snapshot, delta);
    this.handleLayer?.scheduleRender();
  }

  /** @private */
  _edgePan(point) {
    const edge = this.options.edgePan;
    if (!edge || edge.enabled === false) return;
    const size = this.map.getSize();
    if (!size.x || !size.y) return;
    const margin = Number(edge.margin) || 24;
    const speed = Number(edge.speed) || 16;
    let dx = 0;
    let dy = 0;
    if (point.x < margin) dx = -speed;
    else if (point.x > size.x - margin) dx = speed;
    if (point.y < margin) dy = -speed;
    else if (point.y > size.y - margin) dy = speed;
    if (dx || dy) this.map.panBy(new Point(dx, dy), { animate: false });
  }

  /** @private */
  _handlePointerUp() {
    if (this._activeHandler) {
      this._activeHandler.end();
      return;
    }
    if (this._drag) this._finishHandleDrag();
    else if (this._bodyDrag) this._finishBodyDrag();
  }

  /** @private */
  _finishHandleDrag() {
    this._activeHandler = null;
    const drag = this._drag;
    if (!drag) return;
    this._cleanupPointer();
    this._drag = null;
    this._clearLongPress();
    const layer = drag.session.layer;
    if (!this.map.hasLayer(layer)) {
      this._refreshAll();
      return;
    }
    if (drag.moved || drag.inserted) {
      const after = drag.session.getSnapshot();
      const command = drag.inserted
        ? new AddVertexCommand(layer, drag.before, after)
        : new MoveVertexCommand(layer, drag.before, after);
      if (this.options.undoRedo) this._stack.push(command, { apply: false });
      this._emitUpdate([layer], drag.inserted ? 'insert-vertex' : 'move-vertex', { command });
    }
    this._suppressNextClick();
    this._refreshAll();
  }

  /** @private */
  _finishBodyDrag() {
    this._activeHandler = null;
    const drag = this._bodyDrag;
    if (!drag) return;
    this._cleanupPointer();
    this._bodyDrag = null;
    if (!drag.moved) {
      this._refreshAll();
      return;
    }
    const layers = drag.root.isGroup()
      ? drag.root.children.map((child) => child.layer)
      : [drag.root.layer];
    if (!layers.every((layer) => this.map.hasLayer(layer))) {
      this._refreshAll();
      return;
    }
    const after = drag.root.getSnapshot();
    const command = new MoveLayerCommand(
      drag.root.isGroup()
        ? drag.snapshot.map((entry, index) => ({
            layer: entry.layer,
            before: entry.snapshot,
            after: after[index]?.snapshot,
          }))
        : [{ layer: drag.root.layer, before: drag.snapshot, after }],
    );
    if (this.options.undoRedo) this._stack.push(command, { apply: false });
    this._emitUpdate(layers, 'move-layer', { command });
    this._suppressNextClick();
    this._refreshAll();
  }

  /** @private */
  _cleanupPointer() {
    document.removeEventListener('pointermove', this._onDocPointerMove);
    document.removeEventListener('pointerup', this._onDocPointerUp);
    document.removeEventListener('pointercancel', this._onDocPointerCancel);
    if (this._dragFrame) {
      cancelAnimFrame(this._dragFrame);
      this._dragFrame = null;
    }
    this._pendingPointer = null;
  }

  /** @private */
  _cancelActiveDrag(restore) {
    if (this._activeHandler) {
      this._activeHandler.active = false;
      this._activeHandler = null;
    }
    if (this._drag) {
      const drag = this._drag;
      this._drag = null;
      this._clearLongPress();
      if (restore && drag.before) drag.session.restore(drag.before);
    }
    if (this._bodyDrag) {
      const drag = this._bodyDrag;
      this._bodyDrag = null;
      if (restore) drag.root.restore(drag.snapshot);
    }
    this._cleanupPointer();
    this.handleLayer?.scheduleRender();
  }

  /** @private */
  _startLongPress(handle) {
    if (!isCoarsePointer()) return;
    this._clearLongPress();
    this._longPressTimer = setTimeout(() => {
      this._longPressTimer = null;
      if (!this._drag || this._drag.moved) return;
      this._deleteHandleVertex(handle, 'longpress');
      this._cancelActiveDrag(false);
    }, 600);
  }

  /** @private */
  _clearLongPress() {
    if (this._longPressTimer) clearTimeout(this._longPressTimer);
    this._longPressTimer = null;
  }

  /** @private */
  _onHandleContextMenu(handle) {
    if (this._destroyed) return;
    this._deleteHandleVertex(handle, 'contextmenu');
  }

  /** @private */
  _onHandleCtrlClick(handle) {
    if (this._suppressHandleClick) return;
    this._deleteHandleVertex(handle, 'ctrl');
  }

  /** @private */
  _deleteHandleVertex(handle, action) {
    if (!handle || handle.kind === 'midpoint') return false;
    const session = handle.session;
    const before = session.getSnapshot();
    if (!session.deleteVertex(handle)) {
      this.fire('vertexlimit', { layer: session.layer, handle });
      return false;
    }
    const after = session.getSnapshot();
    const command = new DeleteVertexCommand(session.layer, before, after);
    if (this.options.undoRedo) this._stack.push(command, { apply: false });
    this._emitUpdate([session.layer], `delete-vertex:${action}`, { command });
    this._suppressNextClick();
    this._refreshAll();
    return true;
  }

  /** @private */
  _suppressNextClick() {
    this._suppressClick = true;
    setTimeout(() => {
      this._suppressClick = false;
    }, 0);
  }

  /* ----------------------------------------------------------------------- *
   * Клики, hit-test и слои
   * ----------------------------------------------------------------------- */

  /** @private */
  _handleMapClick(event) {
    if (this._destroyed) return;
    if (this._suppressClick) {
      this._suppressClick = false;
      return;
    }
    if (this._draw) {
      this._draw.handleClick(event);
      return;
    }

    const layer = this._resolveEventLayer(event);
    const mode = this._mode.mode;
    if (mode === 'idle' || mode === 'create') return;

    if (mode === 'select') {
      if (!layer) {
        this.clearSelection();
        return;
      }
      const additive = Boolean(
        event.originalEvent?.shiftKey ||
        event.originalEvent?.ctrlKey ||
        event.originalEvent?.metaKey,
      );
      if (additive) this.toggleSelection(layer);
      else this.selectLayer(layer, false);
      return;
    }

    if (mode === 'edit') {
      if (!layer) {
        this.clearSelection();
        return;
      }
      const additive = Boolean(
        event.originalEvent?.shiftKey ||
        event.originalEvent?.ctrlKey ||
        event.originalEvent?.metaKey,
      );
      if (additive) this.toggleSelection(layer);
      else this.selectLayer(layer, false);
      return;
    }

    if (mode === 'delete' && layer) this.deleteLayer(layer);
  }

  /** @private */
  _resolveEventLayer(event) {
    const source = event.sourceTarget;
    if (source && source !== this.map && this.map.hasLayer(source) && getLayerKind(source)) {
      return this._resolveSelectionRoot(source);
    }
    if (event.containerPoint) return this._hitTest(event.containerPoint);
    if (event.latlng) return this._hitTest(this.map.latLngToContainerPoint(event.latlng));
    return null;
  }

  /** @private */
  _hitTest(point) {
    const roots = this._candidateRoots();
    for (const root of roots) {
      if (this._hitTestLayer(root, point)) return root;
    }
    return null;
  }

  /** @private */
  _candidateRoots() {
    const seen = new Set();
    const roots = [];
    for (const layer of this.map.getLayers()) {
      if (this._isInternal(layer)) continue;
      if (!getLayerKind(layer)) continue;
      const root = this._resolveSelectionRoot(layer);
      if (!root || seen.has(root)) continue;
      seen.add(root);
      roots.push(root);
    }
    return roots.reverse();
  }

  /** @private */
  _hitTestLayer(layer, point) {
    if (!layer || layer.options?.interactive === false) return false;
    const kind = getLayerKind(layer);
    if (!kind) return false;
    if (kind === 'group') {
      const children = layer.getLayers().slice().reverse();
      return children.some((child) => this._hitTestLayer(child, point));
    }
    if (kind === 'marker') {
      const target = this.map.latLngToContainerPoint(layer.getLatLng());
      return target.distanceTo(point) <= 14;
    }

    const tolerance = (Number(layer.options?.weight) || 3) / 2 + 3;
    if (kind === 'circle') {
      const center = this.map.latLngToContainerPoint(layer.getLatLng());
      const edge =
        layer.getRadius() > 0
          ? this.map.latLngToContainerPoint(
              pointAtDistance(layer.getLatLng(), layer.getRadius(), 90),
            )
          : center;
      const radius = edge.distanceTo(center);
      const distance = center.distanceTo(point);
      if (layer.options?.fill !== false && distance <= radius) return true;
      return Math.abs(distance - radius) <= tolerance;
    }

    const rings = getRings(layer);
    if (kind === 'polygon' || kind === 'rectangle') {
      let inside = false;
      for (const ring of rings) {
        if (ring.length < 3) continue;
        if (pointInRing(point, ring, (latlng) => this.map.latLngToContainerPoint(latlng))) {
          inside = !inside;
        }
      }
      if (inside && layer.options?.fill !== false) return true;
    }

    for (const ring of rings) {
      if (ring.length === 1) {
        if (this.map.latLngToContainerPoint(ring[0]).distanceTo(point) <= tolerance) return true;
        continue;
      }
      for (let index = 0; index < ring.length - 1; index += 1) {
        const start = this.map.latLngToContainerPoint(ring[index]);
        const end = this.map.latLngToContainerPoint(ring[index + 1]);
        if (closestPointOnSegment(point, start, end).distance <= tolerance) return true;
      }
      if (kind === 'polygon' && ring.length > 2) {
        const start = this.map.latLngToContainerPoint(ring[ring.length - 1]);
        const end = this.map.latLngToContainerPoint(ring[0]);
        if (closestPointOnSegment(point, start, end).distance <= tolerance) return true;
      }
    }
    return false;
  }

  /** @private */
  _isInternal(layer) {
    return layer === this.handleLayer || layer === this.ghostLayer;
  }

  /** @private */
  _handleLayerRemove(event) {
    if (this._destroying || this._destroyed) return;
    const layer = event.layer;
    if (!layer || this._isInternal(layer)) return;
    const session = this._sessions.get(stamp(layer));
    if (!session) return;

    if (session.isGroup()) {
      this._teardownSession(session);
      this.fire('edit:disabled', { layer });
      this._refreshAll();
      return;
    }

    const root = this._roots.get(layer);
    if (root && root.isGroup() && root.active) {
      const index = root.children.indexOf(session);
      if (index !== -1) root.children.splice(index, 1);
      this._teardownSession(session);
    } else {
      this._teardownSession(session);
    }
    this.fire('edit:disabled', { layer });
    this._refreshAll();
  }

  /* ----------------------------------------------------------------------- *
   * Снимки/события/утилиты
   * ----------------------------------------------------------------------- */

  /** @private */
  _emitUpdate(layers, action, extra = {}) {
    const list = [...new Set(layers.filter(Boolean))];
    if (!list.length) return;
    this.fire('update', { layer: list[0], layers: list, action, ...extra });
    for (const layer of list) this._checkSelfIntersections(layer);
  }

  /** @private */
  _checkSelfIntersections(layer) {
    if (!this.options.warnSelfIntersection || !layer) return;
    const kind = getLayerKind(layer);
    if (kind === 'group') {
      layer.eachLayer((child) => this._checkSelfIntersections(child));
      return;
    }
    if (kind !== 'polygon') return;
    const rings = getRings(layer);
    const found = [];
    rings.forEach((ring, index) => {
      if (ring.length < 4 || ring.length > 800) return;
      const intersections = findSelfIntersections(ring, {
        project: (latlng) => this.map.project(latlng),
        closed: true,
      });
      if (intersections.length) found.push({ ring: index, intersections });
    });
    const previous = this._intersectionState.get(layer);
    const signature = JSON.stringify(found);
    if (found.length && signature !== previous) {
      this._intersectionState.set(layer, signature);
      this.fire('selfintersection', { layer, rings: found });
    } else if (!found.length) {
      this._intersectionState.delete(layer);
    }
  }

  /**
   * Привязка к сетке и к вершинам других объектов.
   * @param {any} latlng
   * @param {any} [exclude]
   * @returns {any}
   */
  _snapLatLng(latlng, exclude = null) {
    const snap = this.options.snap;
    if (!snap || !snap.enabled) return latlng;
    const point = this.map.latLngToContainerPoint(latlng);
    const excludeRoot = exclude ? this._resolveSelectionRoot(exclude) : null;

    if (snap.toVertices !== false) {
      let best = null;
      let bestDistance = Number(snap.tolerance) || 10;
      for (const layer of this.map.getLayers()) {
        if (this._isInternal(layer) || !getLayerKind(layer)) continue;
        if (excludeRoot && this._resolveSelectionRoot(layer) === excludeRoot) continue;
        for (const vertex of getLayerVertices(layer)) {
          const candidate = this.map.latLngToContainerPoint(vertex);
          const distance = candidate.distanceTo(point);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        }
      }
      if (best) return this.map.containerPointToLatLng(best);
    }

    const grid = Number(snap.gridSize);
    if (grid > 0) {
      return this.map.containerPointToLatLng(
        new Point(Math.round(point.x / grid) * grid, Math.round(point.y / grid) * grid),
      );
    }
    return latlng;
  }

  /** @returns {number} */
  getMinVertices(kind) {
    const value = this.options.limits?.[kind]?.min;
    return Number.isFinite(value) ? value : kind === 'polygon' ? 3 : 2;
  }

  /** @returns {number} */
  getMaxVertices(kind) {
    const value = this.options.limits?.[kind]?.max;
    return Number.isFinite(value) ? value : Infinity;
  }

  /** @returns {number} */
  getHandleSize() {
    if (this.map && typeof getComputedStyle === 'function') {
      const raw = getComputedStyle(this.map.getContainer())
        .getPropertyValue('--map-edit-handle-size')
        .trim();
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    const handles = this.options.handles || {};
    const style = this.options.style || {};
    const size = Number(handles.size ?? handles.handleSize ?? style.handleSize ?? 8);
    return size + (isCoarsePointer() ? 4 : 0);
  }

  /** @param {string} key @param {object} [vars] */
  t(key, vars = {}) {
    return translate(this.messages, key, vars);
  }

  /* ----------------------------------------------------------------------- *
   * Стили и жизненный цикл
   * ----------------------------------------------------------------------- */

  /** @private */
  _applyStyles() {
    const container = this.map.getContainer();
    const style = this.options.style || {};
    const handles = { ...style, ...(this.options.handles || {}) };
    const selected = this.options.selectedStyle || {};
    const ghost = this.options.ghostStyle || {};
    const vertex = this.options.vertexStyle || {};
    const midpoint = this.options.midpointStyle || {};

    const baseHandleSize = Number(handles.size ?? handles.handleSize ?? 8);
    const variables = [
      [
        '--map-edit-handle-size',
        baseHandleSize + (isCoarsePointer() ? 4 : 0),
        (value) => `${value}px`,
      ],
      ['--map-edit-handle-color', vertex.fill ?? handles.color ?? handles.handleColor, String],
      ['--map-edit-handle-stroke', vertex.stroke ?? handles.stroke ?? handles.handleStroke, String],
      [
        '--map-edit-midpoint-color',
        midpoint.fill ?? midpoint.color ?? handles.midpointColor,
        String,
      ],
      ['--map-edit-stroke', ghost.stroke ?? style.stroke, String],
      ['--map-edit-fill', ghost.fill ?? style.fill, String],
      ['--map-edit-ghost-opacity', ghost.opacity ?? style.ghostOpacity, String],
      ['--map-edit-selected-stroke', selected.color, String],
      ['--map-edit-selected-weight', selected.weight, String],
    ];

    for (const [name, value, format] of variables) {
      if (value === undefined || value === null || value === '') continue;
      container.style.setProperty(name, format(value));
      this._cssVars.push(name);
    }

    if (this.options.theme) {
      container.setAttribute('data-map-edit-theme', this.options.theme);
      this._themeSet = this.options.theme;
    }
    const classNames = String(this.options.className || '')
      .split(/\s+/)
      .filter(Boolean);
    container.classList.add('map-edit-plugin', ...classNames);
    this._pluginClassNames = ['map-edit-plugin', ...classNames];
  }

  /** @private */
  _removeStyles() {
    const container = this.map.getContainer();
    for (const name of this._cssVars) container.style.removeProperty(name);
    this._cssVars = [];
    if (this._themeSet) {
      container.removeAttribute('data-map-edit-theme');
      this._themeSet = null;
    }
    if (this._pluginClassNames) {
      container.classList.remove(...this._pluginClassNames);
      this._pluginClassNames = null;
    }
  }

  /** @private */
  _refreshAll() {
    this._refreshHandles();
    this._refreshControl();
  }

  /** @private */
  _refreshHandles() {
    if (!this.handleLayer) return;
    const sessions = this._mode.mode === 'edit' && !this._draw ? this._visibleSessions() : [];
    this.handleLayer.setSessions(sessions);
  }

  /** @private */
  _refreshControl() {
    this.control?.refresh();
  }

  /** @private */
  _handleKeyDown(event) {
    if (this._destroyed) return;
    const target = /** @type {HTMLElement|null} */ (event.target);
    if (
      target?.closest?.('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
    ) {
      return;
    }
    const key = event.key;
    const modifier = event.ctrlKey || event.metaKey;

    if (this._draw) {
      if (key === 'Escape') {
        event.preventDefault();
        this._draw.escape();
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        this._draw.finish();
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        this._draw.escape();
        return;
      }
      if (modifier && key.toLowerCase() === 'z') {
        event.preventDefault();
        this._draw.escape();
        return;
      }
    }

    if (modifier && key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (modifier && key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redo();
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      if (this._selected.size) this.clearSelection();
      else if (this._mode.mode !== 'idle') this.setMode('idle');
      return;
    }

    if ((key === 'Delete' || key === 'Backspace') && this._selected.size) {
      event.preventDefault();
      this.deleteSelected();
    }
  }

  /**
   * Полная очистка: снимает обработчики, удаляет handles, ghost, контролы и
   * сессии. Повторный вызов безопасен.
   */
  destroy() {
    if (this._destroyed) return;
    this._destroying = true;

    this._cancelActiveDrag(false);
    if (this._draw) {
      const handler = this._draw;
      handler.teardown();
      this._draw = null;
      this._removeDrawUi();
      this.fire('draw:canceled', { type: handler.type, reason: 'destroy' });
    }
    this._removeDrawUi();

    for (const session of new Set(this._sessions.values())) session.destroy();
    this._sessions.clear();
    this._roots.clear();
    for (const root of this._selected) this._unhighlight(root);
    this._selected.clear();
    this._stack.clear();

    if (this.control) {
      this.map.removeControl(this.control);
      this.control = null;
    }
    if (this.handleLayer) {
      this.map.removeLayer(this.handleLayer);
      this.handleLayer = null;
    }

    this.map.off('click', this._onMapClick, this);
    this.map.off('layerremove', this._onLayerRemove, this);
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._dragFrame) {
      cancelAnimFrame(this._dragFrame);
      this._dragFrame = null;
    }
    this._removeStyles();
    if (this.map.editPlugin === this) delete this.map.editPlugin;
    this._destroyed = true;
    this._destroying = false;
    this.fire('destroy');
  }
}

/**
 * Опциональное подтверждение удаления.
 * @param {boolean|Function|null} confirm
 * @param {any} layer
 * @param {EditPlugin} plugin
 * @returns {boolean}
 */
function clientConfirm(confirm, layer, plugin) {
  if (!confirm) return true;
  if (typeof confirm === 'function') return confirm(layer, plugin) !== false;
  if (confirm === true && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(plugin.t('confirmDelete'));
  }
  return true;
}

export default EditPlugin;
