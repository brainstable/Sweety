import './styles/sweety.css';

import { Bounds } from './core/Bounds.js';
import { Event, Evented } from './core/Evented.js';
import { Handler } from './core/Handler.js';
import { LatLng, toLatLng } from './core/LatLng.js';
import { Map } from './core/Map.js';
import { Point, toPoint } from './core/Point.js';
import { CRS, EPSG3857, EPSG4326, Transformation, resolveCRS } from './geo/CRS.js';
import {
  EPSG3857_PROJECTION,
  EPSG4326_PROJECTION,
  Projection,
  clampMercatorLatitude,
} from './geo/Projection.js';
import { destinationPoint } from './geo/destination.js';
import { Layer } from './layers/Layer.js';
import { FeatureGroup, LayerGroup } from './layers/LayerGroup.js';
import { TileLayer } from './layers/TileLayer.js';
import { Marker } from './layers/Marker.js';
import { DivIcon, Icon, defaultIcon } from './layers/Marker.Icon.js';
import { Popup } from './layers/Popup.js';
import { Tooltip } from './layers/Tooltip.js';
import { GeoJSONLayer } from './layers/GeoJSON.js';
import { Polyline } from './layers/vector/Polyline.js';
import { Polygon } from './layers/vector/Polygon.js';
import { Circle } from './layers/vector/Circle.js';
import { Rectangle } from './layers/vector/Rectangle.js';
import { Renderer } from './layers/vector/Renderer.js';
import { SVG } from './layers/vector/SVG.js';
import { Canvas } from './layers/vector/Canvas.js';
import { Control, POSITIONS } from './controls/Control.js';
import { ZoomControl } from './controls/Zoom.js';
import { AttributionControl } from './controls/Attribution.js';
import { ScaleControl } from './controls/Scale.js';
import { LayersControl } from './controls/Layers.js';
import {
  Plugin,
  definePlugin,
  getPlugin,
  installedPlugins,
  listPlugins,
  setPluginApi,
  unuse,
  use,
} from './plugins.js';
import * as Util from './util/index.js';
import * as DomUtil from './util/dom.js';

/** Версия библиотеки, подставляемая Vite при сборке. */
export const version = __SWEETY_VERSION__;

const Sweety = {
  version,
  Map,
  LatLng,
  Point,
  Bounds,
  Evented,
  Event,
  Handler,
  CRS,
  Projection,
  Transformation,
  EPSG3857,
  EPSG4326,
  EPSG3857Projection: EPSG3857_PROJECTION,
  EPSG4326Projection: EPSG4326_PROJECTION,
  resolveCRS,
  clampMercatorLatitude,
  destinationPoint,
  Layer,
  LayerGroup,
  FeatureGroup,
  TileLayer,
  Marker,
  Icon,
  DivIcon,
  defaultIcon,
  Popup,
  Tooltip,
  GeoJSONLayer,
  GeoJSON: GeoJSONLayer,
  Polyline,
  Polygon,
  Circle,
  Rectangle,
  Renderer,
  SVG,
  Canvas,
  Control,
  ZoomControl,
  AttributionControl,
  ScaleControl,
  LayersControl,
  POSITIONS,
  Util,
  DomUtil,
  Plugin,
  definePlugin,
  plugin: definePlugin,
  use,
  unuse,
  getPlugin,
  listPlugins,
  installedPlugins,
  toLatLng,
  toPoint,
};

setPluginApi(Sweety);

export {
  Map,
  LatLng,
  Point,
  Bounds,
  Evented,
  Event,
  Handler,
  CRS,
  Projection,
  Transformation,
  EPSG3857,
  EPSG4326,
  EPSG3857_PROJECTION,
  EPSG4326_PROJECTION,
  resolveCRS,
  clampMercatorLatitude,
  destinationPoint,
  Layer,
  LayerGroup,
  FeatureGroup,
  TileLayer,
  Marker,
  Icon,
  DivIcon,
  defaultIcon,
  Popup,
  Tooltip,
  GeoJSONLayer,
  GeoJSONLayer as GeoJSON,
  Polyline,
  Polygon,
  Circle,
  Rectangle,
  Renderer,
  SVG,
  Canvas,
  Control,
  ZoomControl,
  AttributionControl,
  ScaleControl,
  LayersControl,
  POSITIONS,
  Util,
  DomUtil,
  Plugin,
  definePlugin,
  definePlugin as plugin,
  use,
  unuse,
  getPlugin,
  listPlugins,
  installedPlugins,
  toLatLng,
  toPoint,
};

export default Sweety;
