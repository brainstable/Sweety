import { describe, expect, it, vi } from 'vitest';
import { Map } from '../src/core/Map.js';
import { Marker } from '../src/layers/Marker.js';
import { Popup } from '../src/layers/Popup.js';
import { Tooltip } from '../src/layers/Tooltip.js';
import { FeatureGroup } from '../src/layers/LayerGroup.js';

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

describe('Popup', () => {
  it('opens from a marker click and closes on map click', () => {
    const { map, container } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    const popupOpen = vi.fn();
    const popupClose = vi.fn();
    map.on('popupopen', popupOpen);
    map.on('popupclose', popupClose);

    marker.bindPopup('<strong>Hello</strong>');
    marker.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(marker.isPopupOpen()).toBe(true);
    expect(popupOpen).toHaveBeenCalledOnce();
    const popup = map.getPane('popup').querySelector('.sweety-popup');
    expect(popup).toBeTruthy();
    expect(popup.textContent).toContain('Hello');
    expect(popup.querySelector('.sweety-popup-close')).toBeTruthy();

    container.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(marker.isPopupOpen()).toBe(false);
    expect(popupClose).toHaveBeenCalledOnce();
    expect(map.getPane('popup').querySelector('.sweety-popup')).toBeNull();
    map.remove();
  });

  it('supports direct Popup use, DOM content, offsets and close button', () => {
    const { map } = setup();
    const content = document.createElement('article');
    content.textContent = 'DOM content';
    const popup = new Popup({ offset: [12, 20], className: 'custom-popup' });
    popup.setContent(content).setLatLng([0, 0]).openOn(map);

    expect(popup.isOpen()).toBe(true);
    const element = popup.getElement();
    expect(element.className).toContain('custom-popup');
    expect(element.textContent).toContain('DOM content');
    expect(element.style.left).toBe('412px');
    expect(element.style.top).toBe('320px');

    element.querySelector('.sweety-popup-close').click();
    expect(popup.isOpen()).toBe(false);
    map.remove();
  });

  it('repositions a bound popup when the marker moves', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    marker.bindPopup('Move me');
    marker.openPopup();
    const element = marker.getPopup().getElement();
    const left = element.style.left;
    const top = element.style.top;

    marker.setLatLng([5, 5]);
    expect(element.style.left).not.toBe(left);
    expect(element.style.top).not.toBe(top);
    map.remove();
  });

  it('binds popups to every member of a FeatureGroup', () => {
    const { map } = setup();
    const group = new FeatureGroup();
    const first = new Marker([0, 0]);
    const second = new Marker([1, 1]);
    group.addTo(map).addLayer(first).addLayer(second);
    group.bindPopup('Group popup');

    first.openPopup();
    expect(first.isPopupOpen()).toBe(true);
    expect(first.getPopup().getContent()).toBe('Group popup');
    expect(second.getPopup().getContent()).toBe('Group popup');
    map.remove();
  });

  it('removes the binding and closes on layer removal', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    marker.bindPopup('Bye').openPopup();
    expect(marker.isPopupOpen()).toBe(true);
    marker.unbindPopup();
    expect(marker.getPopup()).toBeNull();

    marker.bindPopup('Again').openPopup();
    marker.remove();
    expect(map.getPane('popup').querySelector('.sweety-popup')).toBeNull();
    map.remove();
  });
});

describe('Tooltip', () => {
  it('opens on hover and closes on mouseout', () => {
    const { map } = setup();
    const marker = new Marker([0, 0]).addTo(map);
    marker.bindTooltip('Hover label');

    marker.getElement().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(marker.isTooltipOpen()).toBe(true);
    expect(map.getPane('tooltip').textContent).toContain('Hover label');

    marker.getElement().dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(marker.isTooltipOpen()).toBe(false);
    map.remove();
  });

  it('keeps permanent tooltips open and reopens them after re-adding', () => {
    const { map } = setup();
    const marker = new Marker([0, 0], { draggable: false });
    marker.bindTooltip('Permanent', { permanent: true });
    marker.addTo(map);
    expect(marker.isTooltipOpen()).toBe(true);

    marker.remove();
    expect(marker.isTooltipOpen()).toBe(false);
    marker.addTo(map);
    expect(marker.isTooltipOpen()).toBe(true);
    map.remove();
  });

  it('supports standalone tooltips and direction classes', () => {
    const { map } = setup();
    const tooltip = new Tooltip({ direction: 'bottom', className: 'hint' });
    tooltip.setContent('Standalone').setLatLng([0, 0]).openOn(map);
    const element = tooltip.getElement();
    expect(element.classList.contains('sweety-tooltip-bottom')).toBe(true);
    expect(element.classList.contains('hint')).toBe(true);
    expect(element.style.pointerEvents).toBe('none');
    tooltip.close();
    map.remove();
  });
});
