/**
 * Базовый интерфейс стратегии загрузки тайлов. Адаптер получает дескриптор
 * провайдера и координаты тайла и возвращает готовый URL.
 */
export class TileSourceAdapter {
  /** @param {string} type */
  constructor(type) {
    this.type = type;
  }

  /**
   * @param {object} _provider
   * @param {{x:number,y:number,z:number}} _coords
   * @param {object} _context
   * @returns {string}
   */
  buildUrl(_provider, _coords, _context) {
    throw new Error('TileSourceAdapter.buildUrl must be implemented');
  }
}
