/**
 * Строки интерфейса по умолчанию. Любой ключ можно переопределить через
 * `options.i18n`; подстановки задаются в фигурных скобках.
 * @module i18n
 */

export const DEFAULT_I18N = {
  toolbar: 'Edit map',
  select: 'Select',
  edit: 'Edit vertices',
  dragMode: 'Drag objects',
  delete: 'Delete',
  undo: 'Undo',
  redo: 'Redo',
  draw: 'Draw',
  drawMarker: 'Add marker',
  drawPolyline: 'Draw polyline',
  drawPolygon: 'Draw polygon',
  drawCircle: 'Draw circle',
  drawRectangle: 'Draw rectangle',
  merge: 'Merge into a multi-object',
  union: 'Union by shared borders',
  explode: 'Split into separate objects',
  addHole: 'Add hole',
  cut: 'Cut with a line',
  continueLine: 'Continue line',
  splitLine: 'Split at vertex',
  mergeFailed: 'Select at least two objects of the same type',
  unionFailed: 'Select at least two polygons to union',
  unionOverlap: 'Polygons overlap: union by shared borders is not possible',
  unionOpen: 'Polygon borders are open: union is not possible',
  cutSelect: 'Select objects to cut',
  cutFailed: 'The cut line must cross the border of the object twice',
  holeSelect: 'Select one polygon to add a hole',
  holeFailed: 'Hole must be inside the polygon',
  holeCrosses: 'Hole must not cross the polygon border',
  holeEmpty: 'Hole needs at least three vertices',
  finish: 'Finish',
  cancel: 'Cancel',
  apply: 'Apply',
  hintMarker: 'Click to place the marker',
  hintPolyline: 'Click to add vertices · Enter or double-click to finish',
  hintPolygon: 'Click to add vertices · click the first vertex or press Enter to close',
  hintCircle: 'Click the center, then click the edge',
  hintRectangle: 'Click two opposite corners',
  hintHole: 'Draw a hole inside the polygon · Enter to finish',
  hintCut: 'Draw a cutting line across the selected objects · Enter to cut',
  vertices: '{count} vertices',
  selected: '{count} selected',
  nothingSelected: 'Nothing selected',
  confirmDelete: 'Delete the selected object?',
  vertexLimit: 'Vertex limit reached',
  selfIntersection: 'Polygon has a self-intersection',
  deleteVertex: 'Delete vertex',
  addVertex: 'Add vertex',
  dragVertex: 'Drag vertex',
  modeIdle: 'Idle',
  modeSelect: 'Select',
  modeEdit: 'Edit',
  modeCreate: 'Create',
  modeDelete: 'Delete',
};

/**
 * Подставляет значения в строку.
 * @param {string} text
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function interpolate(text, vars = {}) {
  return String(text).replace(/\{\s*([\w$-]+)\s*\}/g, (match, key) =>
    vars[key] === undefined ? match : String(vars[key]),
  );
}

/**
 * @param {Record<string, string>} messages
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function translate(messages, key, vars = {}) {
  return interpolate(messages[key] ?? key, vars);
}
