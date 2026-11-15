import { FeatureGroup } from './LayerGroup.js';
import { Marker } from './Marker.js';
import { Polyline } from './vector/Polyline.js';
import { Polygon } from './vector/Polygon.js';
import { LatLng, toLatLng } from '../core/LatLng.js';
import { extend } from '../util/index.js';

const DEFAULT_STYLE = {
  color: '#2f6fed',
  weight: 3,
  opacity: 1,
  fillColor: null,
  fillOpacity: 0.2,
};

const DEFAULT_OPTIONS = {
  style: null,
  pointToLayer: null,
  onEachFeature: null,
  filter: null,
  coordsToLatLng: null,
  markersInheritOptions: false,
};

/**
 * GeoJSON layer. Accepts FeatureCollection, Feature, Geometry and
 * GeometryCollection documents and turns every geometry into native layers.
 *
 * @example
 * const geo = new GeoJSONLayer(data, {
 *   style: (feature) => ({ color: feature.properties.color }),
 *   onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.name),
 * }).addTo(map);
 */
export class GeoJSONLayer extends FeatureGroup {
  /**
   * @param {object} geojson
   * @param {object} [options]
   */
  constructor(geojson, options = {}) {
    super([], extend({}, DEFAULT_OPTIONS, options));
    this._geoJSONOptions = extend({}, DEFAULT_OPTIONS, options);
    if (geojson !== undefined && geojson !== null) this.addData(geojson);
  }

  /**
   * Append one or more GeoJSON features.
   * @param {object} geojson
   * @returns {this}
   */
  addData(geojson) {
    if (!geojson || typeof geojson !== 'object') {
      throw new TypeError('GeoJSONLayer.addData expects a GeoJSON object');
    }

    if (geojson.type === 'FeatureCollection') {
      if (!Array.isArray(geojson.features)) {
        throw new TypeError('FeatureCollection.features must be an array');
      }
      for (const feature of geojson.features) this.addData(feature);
      return this;
    }

    const feature =
      geojson.type === 'Feature'
        ? geojson
        : {
            type: 'Feature',
            properties: {},
            geometry: geojson,
          };

    if (feature.type !== 'Feature' || !feature.geometry) {
      throw new TypeError('GeoJSON must be a Feature, Geometry or FeatureCollection');
    }
    if (!feature.properties) feature.properties = {};
    if (this._geoJSONOptions.filter && !this._geoJSONOptions.filter(feature)) return this;

    const layer = this._geometryToLayer(feature, feature.geometry);
    if (!layer) return this;
    layer.feature = feature;
    this.addLayer(layer);
    if (this._geoJSONOptions.onEachFeature) {
      this._geoJSONOptions.onEachFeature(feature, layer);
    }
    this.fire('featureadd', { feature, layer });
    return this;
  }

  /** @private */
  _geometryToLayer(feature, geometry) {
    const coordinates = geometry.coordinates;
    switch (geometry.type) {
      case 'Point':
        return this._pointLayer(feature, this._coordsToLatLng(coordinates));
      case 'MultiPoint': {
        const group = new FeatureGroup();
        for (const coordinate of coordinates) {
          const marker = this._pointLayer(feature, this._coordsToLatLng(coordinate));
          if (marker) group.addLayer(marker);
        }
        return group;
      }
      case 'LineString':
        return this._lineLayer(feature, this._coordsToLatLngs(coordinates, 0));
      case 'MultiLineString':
        return this._lineLayer(feature, this._coordsToLatLngs(coordinates, 1));
      case 'Polygon':
        return this._polygonLayer(feature, this._coordsToLatLngs(coordinates, 1));
      case 'MultiPolygon': {
        const group = new FeatureGroup();
        for (const polygon of coordinates) {
          group.addLayer(this._polygonLayer(feature, this._coordsToLatLngs(polygon, 1)));
        }
        return group;
      }
      case 'GeometryCollection': {
        if (!Array.isArray(geometry.geometries)) {
          throw new TypeError('GeometryCollection.geometries must be an array');
        }
        const group = new FeatureGroup();
        for (const child of geometry.geometries) {
          const layer = this._geometryToLayer(feature, child);
          if (layer) group.addLayer(layer);
        }
        return group;
      }
      default:
        throw new Error(`Unsupported GeoJSON geometry: ${String(geometry.type)}`);
    }
  }

  /** @private */
  _pointLayer(feature, latlng) {
    let layer;
    if (this._geoJSONOptions.pointToLayer) {
      layer = this._geoJSONOptions.pointToLayer(feature, latlng);
    } else {
      const style = this._styleFor(feature);
      const markerOptions = {
        title: feature.properties.title || feature.properties.name || '',
        alt: feature.properties.alt || 'Marker',
      };
      for (const key of ['icon', 'opacity', 'draggable', 'zIndexOffset', 'riseOnHover']) {
        if (style[key] !== undefined) markerOptions[key] = style[key];
      }
      layer = new Marker(latlng, markerOptions);
    }
    if (layer) layer.feature = feature;
    return layer;
  }

  /** @private */
  _lineLayer(feature, latlngs) {
    const layer = new Polyline(latlngs, this._styleFor(feature));
    layer.feature = feature;
    return layer;
  }

  /** @private */
  _polygonLayer(feature, latlngs) {
    const layer = new Polygon(latlngs, this._styleFor(feature));
    layer.feature = feature;
    return layer;
  }

  /** @private */
  _styleFor(feature) {
    const styleOption = this._geoJSONOptions.style;
    let style = typeof styleOption === 'function' ? styleOption(feature) : styleOption;
    if (!style) style = {};
    return extend({}, DEFAULT_STYLE, style);
  }

  /**
   * Coerce a GeoJSON position (`[lng, lat, alt]`) to LatLng.
   * @param {number[]} coords
   * @returns {LatLng}
   */
  _coordsToLatLng(coords) {
    if (this._geoJSONOptions.coordsToLatLng) {
      return toLatLng(this._geoJSONOptions.coordsToLatLng(coords));
    }
    if (!Array.isArray(coords) || coords.length < 2) {
      throw new TypeError('Invalid GeoJSON coordinate');
    }
    return new LatLng(coords[1], coords[0], coords[2] || 0);
  }

  /** @private */
  _coordsToLatLngs(coords, levelsDeep) {
    if (levelsDeep === 0) return coords.map((coordinate) => this._coordsToLatLng(coordinate));
    return coords.map((child) => this._coordsToLatLngs(child, levelsDeep - 1));
  }

  /**
   * Reset all styles, or the style of one layer.
   * @param {import('./Layer.js').Layer} [layer]
   * @returns {this}
   */
  resetStyle(layer) {
    if (layer) {
      if (layer.feature) {
        const style = this._styleFor(layer.feature);
        if (typeof layer.setStyle === 'function') layer.setStyle(style);
      }
      return this;
    }
    return this.eachLayer((child) => {
      if (child.feature) this.resetStyle(child);
      else if (typeof child.eachLayer === 'function')
        child.eachLayer((nested) => this.resetStyle(nested));
    });
  }

  /**
   * Set the style for all features.
   * @param {object|Function} style
   * @returns {this}
   */
  setStyle(style) {
    this._geoJSONOptions.style = style;
    return this.resetStyle();
  }

  /**
   * Flatten the collected layers into a FeatureCollection.
   * @returns {object}
   */
  toGeoJSON() {
    const features = [];
    const collect = (layer) => {
      if (typeof layer.toGeoJSON === 'function') {
        const result = layer.toGeoJSON();
        if (result.type === 'FeatureCollection') features.push(...result.features);
        else if (result.type === 'Feature') features.push(result);
      } else if (typeof layer.eachLayer === 'function') {
        layer.eachLayer(collect);
      }
    };
    this.eachLayer(collect);
    return { type: 'FeatureCollection', features };
  }
}
