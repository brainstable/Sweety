import { afterEach } from 'vitest';

// jsdom не реализует ResizeObserver, который Map использует для адаптивной раскладки.
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

// jsdom сообщает нулевые размеры. Тесты, которым это важно, вызывают mockElementSize.
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

// В jsdom нет реализации canvas. Записывающего 2D-контекста достаточно для
// проверки порядка отрисовки и проверки попаданий без нативной зависимости canvas.
HTMLCanvasElement.prototype.getContext = function getContext(type) {
  if (type !== '2d') return null;
  if (!this.__ctx) {
    const calls = [];
    const record =
      (name) =>
      (...args) => {
        calls.push({ name, args });
      };
    this.__ctx = {
      canvas: this,
      __calls: calls,
      save: record('save'),
      restore: record('restore'),
      setTransform: record('setTransform'),
      clearRect: record('clearRect'),
      beginPath: record('beginPath'),
      closePath: record('closePath'),
      moveTo: record('moveTo'),
      lineTo: record('lineTo'),
      fill: record('fill'),
      stroke: record('stroke'),
      setLineDash: record('setLineDash'),
      fillStyle: '#000',
      strokeStyle: '#000',
      globalAlpha: 1,
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
    };
  }
  return this.__ctx;
};

afterEach(() => {
  document.body.innerHTML = '';
  ResizeObserverMock.instances.length = 0;
});
