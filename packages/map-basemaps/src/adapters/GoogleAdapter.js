import { TileSourceAdapter } from './TileSource.js';

/**
 * Google Maps: кодирует слой в `lyrs` и использует mt0…mt3.
 */
export class GoogleAdapter extends TileSourceAdapter {
  constructor() {
    super('google');
  }

  buildUrl(provider, coords, context = {}) {
    const subdomains = provider.subdomains?.length ? provider.subdomains : ['0', '1', '2', '3'];
    const subdomain =
      subdomains[Math.abs((coords.x * 3 + coords.y * 5 + coords.z * 7) % subdomains.length)];
    const layer = context.variantValue || 'm';
    const lang = context.adapterOptions?.lang || provider.adapterOptions?.lang || '';
    return (
      `https://mt${subdomain}.google.com/vt/lyrs=${encodeURIComponent(layer)}` +
      `&x=${coords.x}&y=${coords.y}&z=${coords.z}${lang ? `&hl=${encodeURIComponent(lang)}` : ''}`
    );
  }
}
