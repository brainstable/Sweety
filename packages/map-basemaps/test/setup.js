import { afterEach } from 'vitest';

class ResizeObserverMock {
  constructor(callback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe(target) {
    this.target = target;
  }

  unobserve() {}

  disconnect() {
    this.target = null;
  }

  static trigger(target) {
    for (const instance of ResizeObserverMock.instances) {
      if (!target || instance.target === target) {
        instance.callback([
          { target: instance.target, contentRect: instance.target.getBoundingClientRect() },
        ]);
      }
    }
  }
}
ResizeObserverMock.instances = [];
globalThis.ResizeObserver = ResizeObserverMock;

Object.defineProperties(HTMLElement.prototype, {
  clientWidth: {
    configurable: true,
    get() {
      return this._clientWidth ?? 0;
    },
  },
  clientHeight: {
    configurable: true,
    get() {
      return this._clientHeight ?? 0;
    },
  },
});

globalThis.mockElementSize = (element, width = 800, height = 600) => {
  element._clientWidth = width;
  element._clientHeight = height;
  element.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  });
};

globalThis.ResizeObserverMock = ResizeObserverMock;

HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== '2d') return null;
  if (!this.__ctx) this.__ctx = { canvas: this };
  return this.__ctx;
};

afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  ResizeObserverMock.instances.length = 0;
});
