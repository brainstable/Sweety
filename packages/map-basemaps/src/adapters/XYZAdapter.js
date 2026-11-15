import { TileSourceAdapter } from './TileSource.js';

/**
 * Обычный XYZ-адаптер. Подставляет {s}, {z}, {x}, {y}, {-y}, {r} и {variant}
 * на уровне тайла, поэтому один шаблон может обслуживать все субдомены.
 */
export class XYZAdapter extends TileSourceAdapter {
  /** @param {string} [type='xyz'] */
  constructor(type = 'xyz') {
    super(type);
  }

  /**
   * @param {object} provider
   * @param {{x:number,y:number,z:number}} coords
   * @param {{url?: string, variantValue?: string, retina?: boolean}} [context]
   * @returns {string}
   */
  buildUrl(provider, coords, context = {}) {
    if (typeof provider.getTileUrl === 'function') {
      return provider.getTileUrl(coords, context);
    }
    const template = context.url || provider.url;
    if (typeof template !== 'string' || !template) {
      throw new Error(`Provider "${provider.id}" has no XYZ URL template`);
    }
    const subdomains = provider.subdomains?.length ? provider.subdomains : [''];
    const subdomain =
      subdomains[Math.abs((coords.x * 7 + coords.y * 13 + coords.z * 31) % subdomains.length)];
    const max = 2 ** coords.z;
    return template
      .replace(/\{s\}/g, subdomain)
      .replace(/\{z\}/g, String(coords.z))
      .replace(/\{x\}/g, String(coords.x))
      .replace(/\{y\}/g, String(coords.y))
      .replace(/\{-y\}/g, String(max - 1 - coords.y))
      .replace(/\{r\}/g, context.retina ? '@2x' : '')
      .replace(/\{variant\}/g, context.variantValue || '');
  }
}
