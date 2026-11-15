import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Marker } from '../src/layers/Marker.js';
import { DivIcon, Icon } from '../src/layers/Marker.Icon.js';

function setup() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  mockElementSize(container, 800, 600);
  const map = new Map(container, {
    center: [0, 0],
    zoom: 4,
    zoomControl: false,
    attributionControl: false,
  });
  return { map, container };
}

function pointer(type, x, y) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
}

describe('Marker', () => {
  it('renders into the marker pane and updates its position', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    const element = marker.getElement();
    expect(element).toBeTruthy();
    expect(element.parentNode).toBe(map.getPane('marker'));
    expect(element.style.transform).toContain('400px');
    expect(element.style.transform).toContain('300px');
    expect(marker.getLatLng()).toMatchObject({ lat: 0, lng: 0 });

    const moved = vi.fn();
    marker.on('move', moved);
    marker.setLatLng([10, 20]);
    expect(marker.getLatLng()).toMatchObject({ lat: 10, lng: 20 });
    expect(moved).toHaveBeenCalledOnce();
    expect(element.style.transform).not.toContain('400px');
    map.remove();
  });

  it('fires DOM events and bubbles them to the map', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    const markerClick = vi.fn();
    const mapClick = vi.fn();
    marker.on('click', markerClick);
    map.on('click', mapClick);

    marker.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(markerClick).toHaveBeenCalledOnce();
    expect(mapClick).toHaveBeenCalledOnce();
    expect(mapClick.mock.calls[0][0].sourceTarget).toBe(marker);
    expect(mapClick.mock.calls[0][0].latlng).toMatchObject({ lat: 0, lng: 0 });
    map.remove();
  });

  it('supports keyboard activation', () => {
    const { map } = setup();
    const marker = new Marker([0, 0], { alt: 'Moscow' }).addTo(map);
    const click = vi.fn();
    marker.on('click', click);
    marker
      .getElement()
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.calls[0][0].keyboard).toBe(true);
    expect(marker.getElement().getAttribute('aria-label')).toBe('Moscow');
    map.remove();
  });

  it('supports image and div icons, opacity and z-index offsets', () => {
    const { map } = setup();
    const marker = new Marker([0, 0], { zIndexOffset: 100 }).addTo(map);
    expect(marker.getElement().style.zIndex).toBe(String(300 + 100));

    marker.setOpacity(0.4);
    expect(marker.getElement().style.opacity).toBe('0.4');

    marker.setIcon(
      new DivIcon({ html: '<strong>42</strong>', className: 'counter', iconSize: [30, 20] }),
    );
    expect(marker.getElement().querySelector('.counter')).toBeTruthy();
    expect(marker.getElement().textContent).toBe('42');

    marker.setIcon(new Icon({ iconSize: [20, 20], iconAnchor: [10, 20] }));
    expect(marker.getElement().querySelector('img')).toBeTruthy();
    map.remove();
  });

  it('drags independently of the map and emits drag events', () => {
    const { map } = setup();
    const marker = new Marker([0, 0], { draggable: true }).addTo(map);
    const dragstart = vi.fn();
    const drag = vi.fn();
    const dragend = vi.fn();
    marker.on('dragstart', dragstart);
    marker.on('drag', drag);
    marker.on('dragend', dragend);

    const mapCenter = map.getCenter();
    const element = marker.getElement();
    element.dispatchEvent(pointer('pointerdown', 400, 300));
    document.dispatchEvent(pointer('pointermove', 450, 330));
    expect(dragstart).toHaveBeenCalledOnce();
    expect(drag).toHaveBeenCalledOnce();
    expect(marker.getLatLng().lng).toBeGreaterThan(0);
    expect(marker.getLatLng().lat).toBeLessThan(0);
    expect(map.getCenter().equals(mapCenter, 1e-9)).toBe(true);

    document.dispatchEvent(pointer('pointerup', 450, 330));
    expect(dragend).toHaveBeenCalledOnce();
    map.remove();
  });

  it('can toggle dragging and removes cleanly', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    expect(marker.isDraggable()).toBe(false);
    marker.setDraggable(true);
    expect(marker.isDraggable()).toBe(true);
    marker.setDraggable(false);
    expect(marker.isDraggable()).toBe(false);

    const element = marker.getElement();
    marker.remove();
    expect(element.parentNode).toBeNull();
    expect(marker.getElement()).toBeNull();
    map.remove();
  });
});
