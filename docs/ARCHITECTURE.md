# Архитектура Sweety

## Цели

Sweety — компактная картографическая библиотека с Leaflet-подобным API, но без
runtime-зависимостей. Архитектура разделяет координатную математику, DOM,
рендеринг и взаимодействие так, чтобы каждый слой можно было заменить или
расширить, не затрагивая `Map`.

## Слои приложения

```text
src/
├── index.js                публичный namespace и ES-экспорты
├── plugins.js              реестр плагинов
├── core/
│   ├── Map.js              состояние вида, панели, слои, контролы, анимации
│   ├── Evented.js          on/off/once/fire и всплытие событий
│   ├── Handler.js          базовый класс жестов
│   ├── LatLng.js           географическая координата
│   ├── Point.js            пиксельная координата
│   └── Bounds.js           географический прямоугольник
├── geo/
│   ├── Projection.js       интерфейс Projection, EPSG:3857, EPSG:4326
│   ├── CRS.js              Transformation, CRS и пиксельная привязка
│   └── destination.js      точка назначения по азимуту и расстоянию
├── handlers/
│   ├── DragHandler.js      pan + инерция
│   ├── ScrollWheelZoom.js  wheel + debounce
│   ├── DoubleClickZoom.js  dblclick
│   └── TouchZoom.js        pinch двумя указателями
├── layers/
│   ├── Layer.js            базовый слой + попапы/тултипы
│   ├── LayerGroup.js       LayerGroup и FeatureGroup
│   ├── TileLayer.js        XYZ, кэш, виртуализация, retry
│   ├── Marker.js           DOM-маркер, drag, keyboard
│   ├── Marker.Icon.js      Icon и DivIcon
│   ├── DivOverlay.js       общая база Popup/Tooltip
│   ├── Popup.js            HTML-попап
│   ├── Tooltip.js          hover/permanent подсказка
│   ├── GeoJSON.js          GeoJSON → нативные слои
│   └── vector/
│       ├── Renderer.js     контракт рендерера
│       ├── SVG.js          общий SVG-рендерер
│       ├── Canvas.js       общий Canvas-рендерер + hit-testing
│       ├── Path.js         геометрия, стили, SVG path
│       ├── Polyline.js     линия
│       ├── Polygon.js      полигон с отверстиями
│       ├── Circle.js       геодезическая окружность
│       └── Rectangle.js    прямоугольник
├── controls/
│   ├── Control.js          позиции, контейнер, изоляция событий
│   ├── Zoom.js             кнопки зума
│   ├── Attribution.js      атрибуция слоёв
│   ├── Scale.js            масштабная линейка
│   └── Layers.js           переключатель слоёв
├── util/
│   ├── index.js            математика, события, rAF, easing
│   └── dom.js              DOM/SVG-хелперы, координаты указателя
└── styles/sweety.css       обязательные стили
```

## Граф зависимостей

```text
index.js
  ├── core/Map.js
  │     ├── core/{Evented, LatLng, Point, Bounds, Handler}
  │     ├── geo/CRS.js → geo/Projection.js
  │     ├── handlers/*
  │     ├── layers/vector/{SVG, Canvas}.js → Renderer → Layer
  │     └── controls/{Zoom, Attribution}.js
  ├── layers/* → core/*
  ├── controls/* → core/Evented
  └── plugins.js
```

`Map` импортирует только конкретные рендереры и стандартные контролы; слои
зависят от `Map` через параметры методов (`onAdd(map)`, `map.project(...)`), а не
через глобальное состояние. Циклических импортов между `Layer` и `DivOverlay`
нет: `DivOverlay` наследует `Evented`, а не `Layer`, поэтому `Layer` может
импортировать `Popup`/`Tooltip` для методов `bindPopup`/`bindTooltip`.

## DOM-структура

```html
<div class="sweety-container" tabindex="0">
  <div class="sweety-map-pane">
    <div class="sweety-pane sweety-tile-pane">…tiles…</div>
    <div class="sweety-pane sweety-overlay-pane">…svg / canvas / vectors…</div>
    <div class="sweety-pane sweety-shadow-pane">…marker shadows…</div>
    <div class="sweety-pane sweety-marker-pane">…markers…</div>
    <div class="sweety-pane sweety-tooltip-pane">…tooltips…</div>
    <div class="sweety-pane sweety-popup-pane">…popups…</div>
  </div>
  <div class="sweety-control-corner sweety-topleft"></div>
  <div class="sweety-control-corner sweety-topright"></div>
  <div class="sweety-control-corner sweety-bottomleft"></div>
  <div class="sweety-control-corner sweety-bottomright"></div>
</div>
```

Панели абсолютно позиционированы, а `map-pane` масштабируется при анимации зума.
Контролы находятся вне `map-pane`, поэтому не масштабируются вместе с картой.

`pointer-events: none` на панелях позволяет кликам по фону доходить до
контейнера. Интерактивные элементы (маркеры, SVG-пути, Canvas, попапы, контролы)
включают `pointer-events: auto` точечно.

## Системы координат

1. **География**: `LatLng(lat, lng, alt)` в градусах.
2. **Проекция**: `Projection.project()` переводит градусы в метры.
   - EPSG:3857: `x = R·λ`, `y = R·ln(tan(π/4 + φ/2))`, широта ограничена
     ±85.0511287798°.
   - EPSG:4326: `x = lng`, `y = lat`.
3. **Мировые пиксели**: `CRS.latLngToPoint(latlng, zoom)` применяет
   `Transformation` и масштаб `256·2^zoom`.
4. **Пиксели map pane**: `worldPixels - pixelOrigin`, где `pixelOrigin` — левый
   верхний угол вьюпорта в мировых пикселях.
5. **Пиксели контейнера**: совпадают с map pane, пока карта не сдвинута
   CSS-трансформацией. Публичные методы скрывают это различие.

При непрерывном `flyTo` зум может быть дробным. `TileLayer` округляет тайловый
зум и компенсирует остаток масштабом изображения; векторы и маркеры
проецируются в дробном зуме напрямую.

## Жизненный цикл карты

```text
new Map(container, options)
  ├─ _initLayout()       панели, углы контролов, размер
  ├─ _initEvents()       DOM-события, ResizeObserver
  ├─ _initView()         центр, зум, pixelOrigin
  ├─ _initHandlers()     drag, wheel, dblclick, pinch
  ├─ _initControls()     zoom, attribution
  ├─ fire('load')
  └─ init hooks плагинов
```

`addLayer(layer)`:

```text
layer._map = map
map._layers[id] = layer
layer.addEventParent(map)
layer.onAdd(map)          создаёт DOM/рендерер
layer.fire('add')
layer._update()           первичная отрисовка
map.fire('layeradd')
```

`removeLayer(layer)` выполняет обратный порядок и обязательно вызывает
`onRemove`, `removeEventParent`, очищает `_map` и `_layers`.

`setView`:

```text
_cancelFlyTo()
_finishZoomAnimation()
ограничение zoom / maxBounds
_movestart (+ zoomstart)
_resetView()
  ├─ обновление center/zoom/pixelOrigin
  ├─ fire('viewreset')
  ├─ _updateLayers()
  └─ fire('move'), fire('zoom')
_moveend (+ zoomend)
```

`_updateLayers()` вызывает `_update()` у каждого слоя. Это единая точка
перерисовки: отдельные слои не подписываются на `move`/`zoom` напрямую, кроме
`TileLayer` в режиме `updateWhenIdle`.

## События и всплытие

`Evented.fire` создаёт `Event`, вызывает снимок слушателей и передаёт событие
event-родителям. Множество `event._propagationParents` защищает от дублей в
ромбовидных графах (слой → группа → карта и слой → карта).

```text
marker.fire('click')
  → listener маркера
  → event parent FeatureGroup
  → event parent Map
```

`sourceTarget` всегда указывает на исходный объект, `target` — на текущий,
`propagatedFrom` — на предыдущий узел. Это позволяет подписчику карты отличить
клик по фону от клика по маркеру/пути.

## Взаимодействия

- **DragHandler** обновляет центр на каждом pointermove через
  `_moveDuringDrag()`. После отпускания вычисляет скорость по последним 120 мс и
  запускает инерцию с постоянным замедлением.
- **ScrollWheelZoom** накапливает delta, ждёт `wheelDebounceTime` и вызывает
  `setZoomAroundPoint`.
- **DoubleClickZoom** зумит вокруг курсора.
- **TouchZoom** отслеживает два указателя, масштабирует расстояние между ними и
  удерживает географическую точку под серединой жеста.
- **Marker drag** останавливает всплытие pointerdown, поэтому карта не
  панорамируется; после drag клик подавляется.

## Анимации

| Процесс           | Механизм                                         |
| ----------------- | ------------------------------------------------ |
| Инерция           | `requestAnimationFrame`, постоянное замедление   |
| `panTo`           | rAF-твин центра с `easeOutCubic`                 |
| `flyTo`           | rAF по квадратичной кривой + непрерывный зум     |
| Обычный зум       | CSS `transform: scale()` на `map-pane` на 240 мс |
| Canvas            | кадры объединяются через rAF                     |
| Resize            | rAF-дебаунс                                      |
| `mousemove` карты | `rafThrottle`                                    |

При `prefers-reduced-motion: reduce` CSS-анимация зума отключается, а `flyTo`
выполняется сразу.

## Рендеринг векторов

### SVG

- Один `<svg>` на карту, `path` на слой.
- Координаты пути — пиксели map pane.
- Стили задаются атрибутами (`stroke`, `fill`, `stroke-dasharray`, …).
- Клики обрабатываются на конкретном `<path>`, затем событие всплывает через
  `Evented` к группе и карте.

### Canvas

- Один `<canvas>` на карту, учитывается `devicePixelRatio`.
- `Path._parts` — спроецированные кольца; Canvas рисует их в одном кадре.
- Hit-testing выполняется по расстоянию до сегментов и even-odd правилу заливки.
- Клик по пустому месту не перехватывается и доходит до карты.
- Для декоративных фигур рекомендуется `interactive: false`.

## Расширение

### Пользовательский слой

```js
import { Layer } from 'sweety-map';

class GridLayer extends Layer {
  onAdd(map) {
    this._container = document.createElement('div');
    map.getPane('overlay').appendChild(this._container);
  }
  _update() {
    // перерисовать по map.getBounds()
  }
  onRemove() {
    this._container.remove();
  }
}
```

### Пользовательский рендерер

Наследуйте `Renderer` и реализуйте `_initContainer`, `_initPath`, `_addPath`,
`_updatePath`, `_removePath`. Затем передайте экземпляр в `options.renderer`.

### Пользовательский CRS

```js
import { CRS, Projection } from 'sweety-map';
```

Создайте `Projection` с `project`/`unproject` и `CRS` с `Transformation` и
`scale(zoom)`, затем передайте в `new Map('map', { crs })`.

### Плагин

```js
import { definePlugin } from 'sweety-map';

definePlugin('analytics', (Sweety, options) => {
  Sweety.Map.addInitHook(function () {
    this.on('moveend', () => options.onMove(this.getCenter()));
  });
});
```

## Производительность и ограничения

- Виртуализация тайлов ограничивает DOM видимой областью + `keepBuffer`.
- Кэш изображений ограничен `maxCacheSize` (LRU-подобное вытеснение).
- Canvas предпочтителен при сотнях и тысячах фигур; SVG — при сложных стилях и
  небольшом количестве объектов.
- `updateWhenIdle` снижает нагрузку при перетаскивании, но увеличивает задержку
  появления новых тайлов.
- Нет SSR и WebGL; библиотека требует DOM.
- GeoJSON CRS не репроецируется: координаты считаются WGS84 (EPSG:4326).

## Тестирование

```text
tests/
  latlng, bounds, point       геометрия
  projection                  EPSG:3857/4326, CRS
  evented                     on/off/once/fire, bubbling
  map, drag, zoom, navigation жизненный цикл и жесты
  tilelayer                   URL, кэш, виртуализация, retry
  marker, popup, layers       DOM и оверлеи
  vector, canvas              SVG/Canvas, hit-testing
  geojson                     парсинг и стили
  controls                    зум, атрибуция, масштаб, слои
  plugins                     реестр
```

Интеграционные тесты используют jsdom, мок `ResizeObserver` и записывающий
2D-контекст Canvas. Покрытие контролируется через `@vitest/coverage-v8`.
