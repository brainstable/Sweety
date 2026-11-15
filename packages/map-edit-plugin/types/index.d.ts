/**
 * Типы плагина редактирования геометрии Sweety.
 * Ядро не поставляет .d.ts, поэтому контракт карты описан минимально и
 * структурно: подходит любой объект с публичным API Map.
 */

export type EditModeName = 'idle' | 'select' | 'edit' | 'create' | 'delete';

export interface PointLike {
  x: number;
  y: number;
}

export interface LatLngLike {
  lat: number;
  lng: number;
  alt?: number;
}

export interface BoundsLike {
  isValid(): boolean;
  getSouthWest(): LatLngLike;
  getNorthEast(): LatLngLike;
  getWest(): number;
  getSouth(): number;
  getEast(): number;
  getNorth(): number;
  clone(): BoundsLike;
}

/** Минимальный контракт карты Sweety. */
export interface EditMap {
  getContainer(): HTMLElement;
  getSize(): PointLike;
  getZoom(): number;
  project(latlng: LatLngLike | number[]): PointLike;
  unproject(point: PointLike): LatLngLike;
  latLngToContainerPoint(latlng: LatLngLike | number[]): PointLike;
  containerPointToLatLng(point: PointLike): LatLngLike;
  distance(from: LatLngLike | number[], to: LatLngLike | number[]): number;
  hasLayer(layer: any): boolean;
  addLayer(layer: any): this;
  removeLayer(layer: any): this;
  getLayers(): any[];
  addControl(control: any): this;
  removeControl(control: any): this;
  on(types: string, handler: (event: any) => void, context?: any): this;
  off(types: string, handler?: (event: any) => void, context?: any): this;
  panBy(offset: PointLike, options?: object): this;
  [key: string]: any;
}

/** Минимальный контракт слоя. */
export interface EditLayer {
  addTo(map: EditMap): this;
  remove(): this;
  on(types: string, handler: (event: any) => void, context?: any): this;
  off(types: string, handler?: (event: any) => void, context?: any): this;
  fire(type: string, data?: object): this;
  toGeoJSON?(): any;
  getLatLng?(): LatLngLike;
  setLatLng?(latlng: LatLngLike | number[]): this;
  getLatLngs?(): any;
  setLatLngs?(latlngs: any): this;
  getRadius?(): number;
  setRadius?(radius: number): this;
  getBounds?(): BoundsLike;
  setBounds?(bounds: BoundsLike | number[][]): this;
  getLayers?(): any[];
  eachLayer?(fn: (layer: any) => void): this;
  hasLayer?(layer: any): boolean;
  options?: any;
  [key: string]: any;
}

export interface SnapOptions {
  enabled?: boolean;
  gridSize?: number;
  toVertices?: boolean;
  tolerance?: number;
}

export interface EdgePanOptions {
  enabled?: boolean;
  margin?: number;
  speed?: number;
}

export interface VertexLimitOptions {
  min?: number;
  max?: number;
}

export interface EditStyleOptions {
  handleSize?: number;
  handleColor?: string;
  handleStroke?: string;
  midpointColor?: string;
  stroke?: string;
  fill?: string;
  ghostOpacity?: number;
  selectedColor?: string;
  selectedWeight?: number;
  [key: string]: any;
}

export interface HandleStyleOptions {
  size?: number;
  handleSize?: number;
  color?: string;
  handleColor?: string;
  stroke?: string;
  handleStroke?: string;
  midpointColor?: string;
  [key: string]: any;
}

export interface EditPluginOptions {
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  toolbarPosition?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  modes?: string[];
  control?: boolean;
  toolbar?: boolean;
  keyboard?: boolean;
  undoRedo?: boolean;
  maxHistory?: number;
  autoEdit?: boolean;
  confirmDelete?: boolean | ((layer: any, plugin: EditPlugin) => boolean);
  snap?: SnapOptions;
  limits?: {
    polygon?: VertexLimitOptions;
    polyline?: VertexLimitOptions;
  };
  warnSelfIntersection?: boolean;
  maxHandles?: number;
  midpoints?: boolean;
  edgePan?: EdgePanOptions;
  style?: EditStyleOptions;
  handles?: HandleStyleOptions;
  vertexStyle?: Record<string, any>;
  midpointStyle?: Record<string, any>;
  selectedStyle?: Record<string, any>;
  ghostStyle?: Record<string, any>;
  i18n?: Record<string, string>;
  theme?: 'light' | 'dark' | null;
  className?: string;
  zIndex?: number;
  target?: any;
  drawStyle?: Record<string, any> | ((type: string) => Record<string, any>);
  layerOptions?: Record<string, any>;
  [key: string]: any;
}

export interface EditEvent<T = any> {
  type: string;
  target: any;
  sourceTarget: any;
  layer: T;
  layers: T[];
  originalEvent?: Event;
  [key: string]: any;
}

export interface ModeChangeEvent extends EditEvent {
  mode: EditModeName;
  previousMode: EditModeName;
}

export interface UpdateEvent extends EditEvent {
  action: string;
  command?: Command;
}

export interface DrawEvent extends EditEvent {
  drawType: 'marker' | 'polyline' | 'polygon' | 'circle' | 'rectangle';
  parent?: any;
  reason?: string;
}

export declare class EditMode {
  constructor(initial?: EditModeName);
  readonly mode: EditModeName;
  readonly previous: EditModeName | null;
  canTransition(next: EditModeName): boolean;
  set(next: EditModeName): { changed: boolean; previous: EditModeName; mode: EditModeName };
  reset(): EditModeName;
}

export declare class Command {
  constructor(label?: string);
  label: string;
  kind: string;
  execute(): void;
  undo(): void;
}

export declare class GeometryCommand extends Command {
  constructor(label: string, entries: Array<{ layer: any; before: object; after: object }>);
  entries: Array<{ layer: any; before: object; after: object }>;
}

export declare class MoveVertexCommand extends GeometryCommand {
  constructor(layer: any, before: object, after: object);
}
export declare class AddVertexCommand extends GeometryCommand {
  constructor(layer: any, before: object, after: object);
}
export declare class DeleteVertexCommand extends GeometryCommand {
  constructor(layer: any, before: object, after: object);
}
export declare class ResizeCircleCommand extends GeometryCommand {
  constructor(layer: any, before: object, after: object);
}
export declare class MoveLayerCommand extends GeometryCommand {
  constructor(entries: Array<{ layer: any; before: object; after: object }>);
}
export declare class CreateLayerCommand extends Command {
  constructor(layer: any, options: { map: EditMap; parent?: any; label?: string });
  layer: any;
  parent: any;
}
export declare class DeleteLayerCommand extends Command {
  constructor(layer: any, options: { map: EditMap; parent?: any; label?: string });
  layer: any;
  parent: any;
}
export declare class CompositeCommand extends Command {
  constructor(commands: Command[], label?: string);
  commands: Command[];
}

export declare class CommandStack {
  constructor(options?: { limit?: number });
  readonly undoLength: number;
  readonly redoLength: number;
  canUndo(): boolean;
  canRedo(): boolean;
  push(command: Command, options?: { apply?: boolean }): Command;
  undo(): Command | null;
  redo(): Command | null;
  clear(): void;
  getUndoStack(): Command[];
  getRedoStack(): Command[];
}

export interface EditHandle {
  id: string;
  localId: string;
  kind: 'vertex' | 'midpoint' | 'center' | 'radius' | 'corner';
  latlng: LatLngLike;
  session: EditSession;
  part?: number;
  index?: number;
  segment?: number;
  midpoint?: boolean;
  opposite?: LatLngLike | null;
  group?: GroupEditSession;
}

export declare class EditSession {
  constructor(plugin: EditPlugin, layer: any);
  readonly plugin: EditPlugin;
  readonly layer: any;
  readonly kind: string;
  readonly id: string;
  active: boolean;
  isGroup(): false;
  getHandleSignature(): string;
  getHandles(): EditHandle[];
  setVertex(handle: EditHandle, latlng: LatLngLike): void;
  insertVertex(handle: EditHandle): { part: number; index: number; handleId: string } | null;
  deleteVertex(handle: EditHandle): boolean;
  getSnapshot(): object | null;
  restore(snapshot: object | null): void;
  translateFrom(snapshot: object, delta: PointLike): object;
  bindBody(): void;
  unbindBody(): void;
  destroy(): void;
  hasMinimumVertices(): boolean;
}

export declare class GroupEditSession {
  constructor(plugin: EditPlugin, layer: any, children: EditSession[]);
  readonly plugin: EditPlugin;
  readonly layer: any;
  readonly kind: 'group';
  readonly id: string;
  active: boolean;
  children: EditSession[];
  isGroup(): true;
  getHandleSignature(): string;
  getHandles(): EditHandle[];
  setVertex(handle: EditHandle, latlng: LatLngLike): void;
  insertVertex(handle: EditHandle): { part: number; index: number; handleId: string } | null;
  deleteVertex(handle: EditHandle): boolean;
  getSnapshot(): Array<{ layer: any; snapshot: object }>;
  restore(snapshot: Array<{ layer: any; snapshot: object }>): void;
  translateFrom(
    snapshot: Array<{ layer: any; snapshot: object }>,
    delta: PointLike,
  ): Array<{ layer: any; snapshot: object }>;
  bindBody(): void;
  unbindBody(): void;
  destroy(): void;
  getLayers(): any[];
  hasLayer(layer: any): boolean;
}

export declare class EditHandler {
  constructor(plugin: EditPlugin);
  plugin: EditPlugin;
  map: EditMap;
  active: boolean;
  start(handle: any, event: PointerEvent): this;
  move(event: PointerEvent): void;
  end(): void;
  cancel(): void;
}

export declare class VertexHandler extends EditHandler {
  handle: EditHandle;
  start(handle: EditHandle, event: PointerEvent): this;
}
export declare class MidpointHandler extends VertexHandler {}
export declare class BodyDragHandler extends EditHandler {
  session: EditSession | GroupEditSession;
  start(session: EditSession | GroupEditSession, event: PointerEvent): this;
}

export declare class DrawHandler extends EditHandler {
  constructor(plugin: EditPlugin, type: string, options?: { target?: any });
  type: 'marker' | 'polyline' | 'polygon' | 'circle' | 'rectangle';
  target: any;
  vertices: LatLngLike[];
  cursor: LatLngLike | null;
  first: LatLngLike | null;
  second: LatLngLike | null;
  finished: boolean;
  start(): this;
  handleClick(event: any): void;
  finish(): boolean;
  canFinish(): boolean;
  escape(): boolean;
  teardown(): void;
}

export declare class HandleLayer {
  constructor(plugin: EditPlugin);
  setSessions(sessions: Array<EditSession | GroupEditSession>): void;
  scheduleRender(): void;
  render(): void;
}

export declare class GhostLayer {
  constructor(plugin: EditPlugin);
  show(state: object): void;
  clear(): void;
  render(): void;
}

export declare class EditControl {
  constructor(plugin: EditPlugin, options?: { position?: string; modes?: string[]; i18n?: object });
  refresh(): void;
  setPosition(position: string): this;
  remove(): this;
}

export declare class DrawToolbar {
  constructor(plugin: EditPlugin, options?: { position?: string; i18n?: object });
  setHint(text: string): void;
  setCanFinish(canFinish: boolean): void;
  remove(): this;
}

export declare class EditPlugin {
  static version: string;
  static install(map: EditMap, options?: EditPluginOptions): EditPlugin;
  constructor(map: EditMap, options?: EditPluginOptions);
  readonly map: EditMap;
  readonly options: EditPluginOptions;
  handleLayer: HandleLayer;
  ghostLayer: GhostLayer | null;
  control: EditControl | null;
  getMode(): EditModeName;
  setMode(mode: EditModeName): this;
  getSelected(): any[];
  selectLayer(layer: any, additive?: boolean): boolean;
  unselectLayer(layer: any): boolean;
  toggleSelection(layer: any): boolean;
  isSelected(layer: any): boolean;
  clearSelection(): this;
  enableEdit(layer: any): EditSession | GroupEditSession | null;
  disableEdit(layer: any): boolean;
  isEditable(layer: any): boolean;
  getSession(layer: any): EditSession | GroupEditSession | null;
  startDrawing(
    type: 'marker' | 'polyline' | 'polygon' | 'circle' | 'rectangle' | string,
    options?: { target?: any; toolbar?: boolean; style?: object },
  ): DrawHandler;
  finishDrawing(): boolean;
  cancelDrawing(): boolean;
  getDrawType(): string | null;
  isDrawing(): boolean;
  deleteLayer(layer: any): boolean;
  deleteSelected(): number;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): boolean;
  redo(): boolean;
  getMinVertices(kind: string): number;
  getMaxVertices(kind: string): number;
  getHandleSize(): number;
  t(key: string, vars?: Record<string, string | number>): string;
  on(types: string, handler: (event: any) => void, context?: any): this;
  off(types: string, handler?: (event: any) => void, context?: any): this;
  once(types: string, handler: (event: any) => void, context?: any): this;
  fire(type: string, data?: object): this;
  destroy(): void;
}

export declare const EDIT_MODES: EditModeName[];
export declare const MODE_TRANSITIONS: Record<EditModeName, EditModeName[]>;
export declare function isEditMode(mode: unknown): mode is EditModeName;
export declare function isDrawingMode(mode: EditModeName): boolean;
export declare function normalizeDrawType(type: string): string;
export declare const DEFAULT_OPTIONS: EditPluginOptions;
export declare const DEFAULT_I18N: Record<string, string>;
export declare function translate(
  messages: Record<string, string>,
  key: string,
  vars?: Record<string, string | number>,
): string;
export declare function interpolate(text: string, vars?: Record<string, string | number>): string;

export declare namespace GeometryUtils {
  function getLayerKind(layer: any): string | null;
  function isEditableLayer(layer: any): boolean;
  function isGroupLayer(layer: any): boolean;
  function cloneLatLng(latlng: LatLngLike): LatLngLike;
  function cloneLatLngs(latlngs: any): any;
  function getRings(layer: any): LatLngLike[][];
  function boundsToRing(bounds: BoundsLike): LatLngLike[];
  function getLayerVertices(layer: any): LatLngLike[];
  function snapshotGeometry(layer: any): object | null;
  function restoreGeometry(layer: any, snapshot: object | null): void;
  function translateLatLng(map: EditMap, latlng: LatLngLike, delta: PointLike): LatLngLike;
  function translateSnapshot(map: EditMap, snapshot: object, delta: PointLike): object;
  function midpointLatLng(map: EditMap, a: LatLngLike, b: LatLngLike): LatLngLike;
  function pointAtDistance(center: LatLngLike, distance: number, bearing: number): LatLngLike;
  function closestPointOnSegment(
    point: PointLike,
    start: PointLike,
    end: PointLike,
  ): { x: number; y: number; t: number; distance: number };
  function insertVertexInSegment(
    ring: LatLngLike[],
    segmentIndex: number,
    latlng: LatLngLike,
  ): LatLngLike[];
  function removeVertexAt(ring: LatLngLike[], index: number): LatLngLike[];
  function isSelfIntersecting(ring: LatLngLike[], options?: object): boolean;
  function findSelfIntersections(ring: LatLngLike[], options?: object): Array<[number, number]>;
  function segmentsIntersect(a: PointLike, b: PointLike, c: PointLike, d: PointLike): boolean;
  function pointInRing(
    point: PointLike,
    ring: LatLngLike[],
    project?: (latlng: LatLngLike) => PointLike,
  ): boolean;
  function ringArea(ring: LatLngLike[]): number;
  function minimumVertices(kind: string, fallback?: number): number;
}

export default EditPlugin;
