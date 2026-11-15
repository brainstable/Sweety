import { afterEach } from 'vitest';

// jsdom does not implement ResizeObserver, which Map uses for responsive layout.
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

// jsdom reports zero dimensions. Tests that care call mockElementSize.
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

afterEach(() => {
  document.body.innerHTML = '';
  ResizeObserverMock.instances.length = 0;
});
