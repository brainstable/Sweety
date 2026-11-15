const ICONS = {
  select:
    '<path d="M5 3l7 15 2.2-6.2L20 10 5 3z" fill="currentColor" stroke="none"/><path d="M12 14l5 6"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 5.5l5 5"/>',
  trash:
    '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9a6 6 0 0 1 6 6v1"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9a6 6 0 0 0-6 6v1"/>',
  marker:
    '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  polyline:
    '<path d="M3 18l5-6 5 3 8-9"/><circle cx="3" cy="18" r="1.5" fill="currentColor"/><circle cx="8" cy="12" r="1.5" fill="currentColor"/><circle cx="13" cy="15" r="1.5" fill="currentColor"/><circle cx="21" cy="6" r="1.5" fill="currentColor"/>',
  polygon:
    '<path d="M4 7l7-4 8 5-3 10-9 1z"/><circle cx="4" cy="7" r="1.5" fill="currentColor"/><circle cx="11" cy="3" r="1.5" fill="currentColor"/><circle cx="19" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="18" r="1.5" fill="currentColor"/><circle cx="7" cy="19" r="1.5" fill="currentColor"/>',
  circle: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  rectangle:
    '<rect x="4" y="5" width="16" height="14" rx="1"/><circle cx="4" cy="5" r="1.5" fill="currentColor"/><circle cx="20" cy="19" r="1.5" fill="currentColor"/>',
  check: '<path d="M4 12l5 5L20 6"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  vertices:
    '<circle cx="6" cy="18" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="16" r="2"/><path d="M6 18l6-13 7 11"/>',
};

/**
 * Возвращает inline-SVG иконку без внешних зависимостей.
 * @param {string} name
 * @returns {string}
 */
export function icon(name) {
  const body = ICONS[name] || ICONS.edit;
  return `<svg class="map-edit-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
