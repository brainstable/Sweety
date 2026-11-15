/**
 * Типы пакета подложек Sweety.
 * Ядро не поставляет .d.ts, поэтому контракт карты описан структурно.
 */

export interface PointLike {
  x: number;
  y: number;
}

export interface MapLike {
  options?: { crs?: { code?: string }; [key: string]: any };
  getContainer(): HTMLElement;
  getZoom(): number;
  getCenter(): any;
  getBounds(): any;
  project(latlng: any): PointLike;
  unproject(point: PointLike): any;
  setView(center: any, zoom?: number, options?: object): this;
  addLayer(layer: any): this;
  removeLayer(layer: any): this;
  hasLayer(layer: any): boolean;
  getLayers(): any[];
  addControl(control: any): this;
  removeControl(control: any): this;
  on(types: string, handler: (event: any) => void, context?: any): this;
  off(types: string, handler?: (event: any) => void, context?: any): this;
  fire(type: string, data?: object): this;
  basemaps?: BasemapsManager;
  [key: string]: any;
}

export type ProviderCategory =
  'streets' | 'satellite' | 'terrain' | 'dark' | 'transport' | 'humanitarian' | 'custom';

export type TileSourceType =
  'xyz' | 'xyz-json' | 'wms' | 'wmts' | 'google' | 'yandex' | 'bing' | string;

export interface ProviderVariant {
  url?: string;
  variant?: string;
  value?: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  maxNativeZoom?: number;
  minNativeZoom?: number;
  tileSize?: number;
  subdomains?: string[];
  type?: TileSourceType;
  category?: ProviderCategory;
  adapterOptions?: Record<string, any>;
  [key: string]: any;
}

export interface ProviderDef {
  id: string;
  name: string;
  url: string;
  type?: TileSourceType;
  category?: ProviderCategory;
  subdomains?: string[] | string;
  minZoom?: number;
  maxZoom?: number;
  maxNativeZoom?: number;
  minNativeZoom?: number;
  tileSize?: number;
  attribution?: string;
  termsUrl?: string;
  license?: string;
  requiresKey?: boolean;
  keyParam?: string | null;
  defaultVariant?: string;
  variants?: Record<string, string | ProviderVariant>;
  projections?: string[];
  preview?: string;
  notes?: string;
  retina?: boolean;
  envKey?: string;
  adapterOptions?: Record<string, any>;
  layers?: string | string[];
  layer?: string;
  styles?: string;
  format?: string;
  version?: string;
  transparent?: boolean;
  crs?: string;
  tileMatrixSet?: string;
  tileMatrixPrefix?: string;
  params?: Record<string, string | number | boolean>;
  [key: string]: any;
}

export interface BasemapsOptions {
  default?: string | { id: string; [key: string]: any } | null;
  basemap?: string | object;
  multiple?: boolean;
  persist?: boolean;
  storageKey?: string;
  storage?: Storage | null;
  fallback?: string | null;
  maxTileErrors?: number;
  zIndex?: number | null;
  opacity?: number;
  retina?: boolean | 'auto';
  variant?: string;
  keys?: Record<string, string> & { global?: string };
  proxy?: string | ((url: string) => string) | null;
  env?: Record<string, any> | null;
  control?: boolean;
  controlOptions?: BasemapControlOptions;
  crossOrigin?: boolean | string;
  errorTileUrl?: string;
  noWrap?: boolean;
  updateWhenIdle?: boolean;
  keepBuffer?: number;
  maxRetries?: number;
  [key: string]: any;
}

export interface BasemapControlOptions {
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  providers?: string[] | null;
  preview?: boolean;
  compact?: boolean;
  search?: boolean;
  showCategories?: boolean;
  theme?: 'light' | 'dark' | null;
  manager?: BasemapsManager | null;
  i18n?: Record<string, string>;
  className?: string;
}

export interface ResolvedBasemap {
  id: string;
  provider: ProviderDef;
  url: string;
  maskedUrl: string;
  key: string | null;
  keyMasked: string;
  variant: string;
  variantValue: string;
  attribution: string;
  retina: boolean;
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  maxNativeZoom: number | null;
  minNativeZoom: number | null;
  subdomains: string[];
  type: TileSourceType;
  category: ProviderCategory;
  termsUrl: string;
  license: string;
  projections: string[];
  adapterOptions: Record<string, any>;
  variantExtra: ProviderVariant;
}

export interface ResolverContext {
  keys?: Record<string, string>;
  env?: Record<string, any>;
  retina?: boolean | 'auto';
  variant?: string;
  proxy?: string | ((url: string) => string) | null;
}

export interface BasemapEvent {
  type: string;
  target: any;
  id: string | null;
  layer: any;
  previousId?: string | null;
  provider?: ProviderDef | null;
  variant?: string;
  attribution?: string;
  code?: string;
  error?: Error | null;
  message?: string;
  url?: string;
  warning?: boolean;
  manager?: BasemapsManager;
  [key: string]: any;
}

export declare const CATEGORIES: ProviderCategory[];

export declare function registerProvider(
  definition: ProviderDef,
  options?: { override?: boolean },
): ProviderDef;
export declare function registerProviders(
  definitions: ProviderDef[],
  options?: { override?: boolean },
): ProviderDef[];
export declare function unregisterProvider(id: string): boolean;
export declare function getProvider(id: string): ProviderDef | undefined;
export declare function requireProvider(id: string): ProviderDef;
export declare function listProviders(
  filter?:
    | string
    | ((provider: ProviderDef) => boolean)
    | {
        category?: string;
        requiresKey?: boolean;
        type?: string;
        search?: string;
        ids?: string[];
      },
): ProviderDef[];
export declare function listCategories(): string[];
export declare function clearProviders(): void;
export declare function providerCount(): number;

export declare function resolveBasemap(
  id: string,
  opts?: {
    key?: string;
    variant?: string;
    retina?: boolean;
    subdomain?: string;
    attribution?: boolean | string;
    urlTemplate?: string;
    proxy?: string | ((url: string) => string);
    coords?: { x: number; y: number; z: number };
  },
  context?: ResolverContext,
): ResolvedBasemap;
export declare function resolveUrl(id: string, opts?: object, context?: ResolverContext): string;
export declare function resolveKey(
  provider: ProviderDef,
  opts?: { key?: string },
  context?: ResolverContext,
): string | null;
export declare function getAttribution(
  id: string,
  opts?: object,
  context?: ResolverContext,
): string;
export declare function isRetinaDisplay(): boolean;

export declare class BasemapError extends Error {
  code: string;
  providerId: string | null;
  details: object | null;
}
export declare class BasemapKeyError extends BasemapError {}
export declare function maskKey(key?: string | null): string;
export declare function maskUrl(url: string, key?: string | null): string;

export declare class TileSourceAdapter {
  constructor(type: string);
  type: string;
  buildUrl(
    provider: ProviderDef,
    coords: { x: number; y: number; z: number },
    context: any,
  ): string;
}
export declare class XYZAdapter extends TileSourceAdapter {
  constructor(type?: string);
}
export declare class WMSAdapter extends TileSourceAdapter {}
export declare class WMTSAdapter extends TileSourceAdapter {}
export declare class GoogleAdapter extends TileSourceAdapter {}
export declare class YandexAdapter extends TileSourceAdapter {}
export declare class BingAdapter extends TileSourceAdapter {}
export declare function quadKey(coords: { x: number; y: number; z: number }): string;
export declare function registerTileSource(
  type: string,
  adapter: TileSourceAdapter,
): TileSourceAdapter;
export declare function getTileSource(type?: string): TileSourceAdapter;
export declare function hasTileSource(type: string): boolean;
export declare function listTileSources(): string[];
export declare function unregisterTileSource(type: string): TileSourceAdapter;

export declare class BasemapTileLayer {
  constructor(resolved: ResolvedBasemap, adapter: TileSourceAdapter, options?: object);
  resolved: ResolvedBasemap;
  provider: ProviderDef;
  adapter: TileSourceAdapter;
  basemapId: string;
  addTo(map: MapLike): this;
  remove(): this;
  getTileUrl(coords: { x: number; y: number; z: number }): string;
  getBasemapId(): string;
  getProvider(): ProviderDef;
  getResolved(): ResolvedBasemap;
  getBasemapVariant(): string;
  getAttribution(): string | null;
  setZIndex(zIndex: number): this;
  setOpacity(opacity: number): this;
  setBasemap(resolved: ResolvedBasemap, adapter: TileSourceAdapter): this;
  on(types: string, handler: (event: any) => void, context?: any): this;
  off(types: string, handler?: (event: any) => void, context?: any): this;
  fire(type: string, data?: object): this;
}

export declare function createBasemap(
  id: string,
  opts?: object,
  managerOptions?: BasemapsOptions,
): BasemapTileLayer;
export declare function createLayerFromResolved(
  resolved: ResolvedBasemap,
  opts?: object,
  managerOptions?: BasemapsOptions,
): BasemapTileLayer;

export declare class BasemapsManager {
  static install(map: MapLike, options?: BasemapsOptions): BasemapsManager;
  constructor(map: MapLike, options?: BasemapsOptions);
  map: MapLike;
  options: BasemapsOptions;
  control: BasemapControl | null;
  set(id: string, opts?: object): boolean;
  add(id: string, opts?: object): BasemapTileLayer;
  remove(id: string): boolean;
  get(): string | null;
  getLayer(id?: string): BasemapTileLayer | null;
  list(
    filter?: object | string | ((provider: ProviderDef) => boolean),
  ): Array<ProviderDef & { active: boolean; variants: string[]; hasKey: boolean }>;
  resolveUrl(id: string, opts?: object): string;
  getAttribution(id: string, opts?: object): string;
  hasKey(id: string): boolean;
  setVariant(variant: string): this;
  getVariant(): string;
  addControl(options?: BasemapControlOptions): BasemapControl;
  registerProvider(definition: ProviderDef, options?: object): ProviderDef;
  unregisterProvider(id: string): boolean;
  getProviders(filter?: object | string | Function): ProviderDef[];
  on(types: string, handler: (event: BasemapEvent) => void, context?: any): this;
  off(types: string, handler?: (event: BasemapEvent) => void, context?: any): this;
  once(types: string, handler: (event: BasemapEvent) => void, context?: any): this;
  fire(type: string, data?: object): this;
  destroy(): void;
}

export declare class BasemapControl {
  constructor(options?: BasemapControlOptions);
  addTo(map: MapLike): this;
  remove(): this;
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  refresh(): void;
  setPosition(position: string): this;
}

export declare const basemaps: {
  install(map: MapLike, options?: BasemapsOptions): BasemapsManager;
  get(map: MapLike): BasemapsManager | null;
  create(id: string, opts?: object, managerOptions?: BasemapsOptions): BasemapTileLayer;
  createControl(options?: BasemapControlOptions): BasemapControl;
  registerProvider: typeof registerProvider;
  registerProviders: typeof registerProviders;
  unregisterProvider: typeof unregisterProvider;
  getProvider: typeof getProvider;
  listProviders: typeof listProviders;
  listCategories: typeof listCategories;
  clearProviders: typeof clearProviders;
};

export declare function installBasemaps(map: MapLike, options?: BasemapsOptions): BasemapsManager;
export declare function createBasemapsManager(
  map: MapLike,
  options?: BasemapsOptions,
): BasemapsManager;

export declare const fullProviders: ProviderDef[];
export declare const lightProviders: ProviderDef[];
export declare const osm: ProviderDef;
export declare const osmHot: ProviderDef;
export declare const openTopoMap: ProviderDef;
export declare const cyclOSM: ProviderDef;
export declare const openRailwayMap: ProviderDef;
export declare const wikimedia: ProviderDef;
export declare const cartoPositron: ProviderDef;
export declare const cartoDark: ProviderDef;
export declare const cartoVoyager: ProviderDef;
export declare const esriWorldImagery: ProviderDef;
export declare const esriWorldTopo: ProviderDef;
export declare const stamenToner: ProviderDef;
export declare const mapbox: ProviderDef;
export declare const maptiler: ProviderDef;
export declare const thunderforest: ProviderDef;
export declare const here: ProviderDef;
export declare const stadia: ProviderDef;
export declare const jawg: ProviderDef;
export declare const google: ProviderDef;
export declare const yandex: ProviderDef;
export declare const bing: ProviderDef;
export declare const usgsImagery: ProviderDef;

export default basemaps;
