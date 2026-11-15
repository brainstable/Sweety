/**
 * Точка в пиксельном пространстве. Класс намеренно изменяемый, что соответствует
 * стилю кода позиционирования Canvas и DOM.
 */
export class Point {
  /**
   * @param {number|number[]|{x:number,y:number}|Point} [x=0]
   * @param {number} [y]
   */
  constructor(x = 0, y = 0) {
    let px = x;
    let py = y;

    if (x instanceof Point) {
      px = x.x;
      py = x.y;
    } else if (Array.isArray(x)) {
      px = x[0];
      py = x[1];
    } else if (x && typeof x === 'object' && 'x' in x) {
      px = x.x;
      py = x.y;
    }

    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      throw new TypeError('Point requires finite numeric x and y');
    }

    /** @type {number} */
    this.x = px;
    /** @type {number} */
    this.y = py;
  }

  /** @returns {Point} */
  clone() {
    return new Point(this.x, this.y);
  }

  /** @returns {Point} this */
  add(other) {
    const point = other instanceof Point ? other : new Point(other);
    this.x += point.x;
    this.y += point.y;
    return this;
  }

  /** @returns {Point} this */
  subtract(other) {
    const point = other instanceof Point ? other : new Point(other);
    this.x -= point.x;
    this.y -= point.y;
    return this;
  }

  /** @returns {Point} this */
  multiplyBy(scale) {
    this.x *= scale;
    this.y *= scale;
    return this;
  }

  /** @returns {Point} this */
  divideBy(scale) {
    if (!scale) throw new RangeError('Point.divideBy requires a non-zero scale');
    this.x /= scale;
    this.y /= scale;
    return this;
  }

  /** @returns {Point} this */
  scaleBy(scale) {
    return this.multiplyBy(scale);
  }

  /** @returns {Point} this */
  unscaleBy(scale) {
    return this.divideBy(scale);
  }

  /** @returns {Point} this */
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }

  /** @returns {Point} this */
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }

  /** @returns {Point} this */
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }

  /** @returns {Point} this */
  trunc() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    return this;
  }

  /** Евклидово расстояние до другой точки. */
  distanceTo(other) {
    const point = other instanceof Point ? other : new Point(other);
    const dx = point.x - this.x;
    const dy = point.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Проверка попадания в границы включительно. */
  contains(other) {
    const point = other instanceof Point ? other : new Point(other);
    return this.x <= point.x && point.x <= this.x && this.y <= point.y && point.y <= this.y;
  }

  /** Точное сравнение компонентов. */
  equals(other) {
    if (!other) return false;
    const point = other instanceof Point ? other : new Point(other);
    return this.x === point.x && this.y === point.y;
  }

  /** @returns {string} */
  toString() {
    return `Point(${this.x}, ${this.y})`;
  }
}

/**
 * Фабрика, сохраняющая существующий экземпляр Point.
 * @returns {Point}
 */
export function toPoint(x, y) {
  return x instanceof Point ? x : new Point(x, y);
}
