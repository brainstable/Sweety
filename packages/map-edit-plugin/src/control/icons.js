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
  merge:
    '<circle cx="8.5" cy="12" r="4.5"/><circle cx="15.5" cy="12" r="4.5"/><path d="M12 7.5v9"/>',
  union:
    '<path d="M3 6h9v12H3z"/><path d="M12 6h9v12h-9z"/><path d="M12 6v12" stroke-dasharray="1.5 2.5"/>',
  hole: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.2"/>',
  cut: '<circle cx="6" cy="6.5" r="2.4"/><circle cx="6" cy="17.5" r="2.4"/><path d="M8.2 7.9L20 16M8.2 16.1L20 8"/>',
  explode:
    '<path d="M3 10h6v6H3z"/><path d="M15 8h6v6h-6z"/><path d="M9 12h3"/><path d="M12 9.5L14.5 12 12 14.5"/>',
  drag: '<path d="M12 3v18M3 12h18"/><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
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
