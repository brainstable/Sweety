import { TileSourceAdapter } from './TileSource.js';

/**
 * Bing Maps: преобразует XYZ в quadkey и подставляет тип снимка.
 */
export class BingAdapter extends TileSourceAdapter {
  constructor() {
    super('bing');
  }

  buildUrl(provider, coords, context = {}) {
    const subdomains = provider.subdomains?.length ? provider.subdomains : ['0', '1', '2', '3'];
    const subdomain =
      subdomains[Math.abs((coords.x * 7 + coords.y * 11 + coords.z * 13) % subdomains.length)];
    const type = context.variantValue || 'a';
    const key = context.key || context.adapterOptions?.key;
    return (
      `https://t${subdomain}.tiles.virtualearth.net/tiles/${type}${quadKey(coords)}.jpeg?g=1` +
      (key ? `&key=${encodeURIComponent(key)}` : '')
    );
  }
}

/**
 * @param {{x:number,y:number,z:number}} coords
 * @returns {string}
 */
export function quadKey(coords) {
  let key = '';
  for (let level = coords.z; level > 0; level -= 1) {
    let digit = 0;
    const mask = 1 << (level - 1);
    if (coords.x & mask) digit += 1;
    if (coords.y & mask) digit += 2;
    key += String(digit);
  }
  return key;
}
