# API Sweety

Публичный API доступен как именованные ES-экспорты и как namespace `Sweety`.
Все конструкторы, методы и события описаны в JSDoc в исходном коде.

```js
import Sweety, { Map, LatLng, TileLayer } from 'sweety-map';
```

## Map

Центральный контроллер карты.

```js
const map = new Map('map', {
  center: [55.75, 37.61],
  zoom: 10,
  minZoom: 0,
  maxZoom: 22,
});
```

### Опции

| Опция                    | Тип                    | По умолчанию  | Описание                      |
| ------------------------ | ---------------------- | ------------- | ----------------------------- |
| `center`                 | `LatLng \| number[]`   | `[0, 0]`      | Начальный центр               |
| `zoom`                   | `number`               | `0`           | Начальный зум                 |
| `minZoom`                | `number`               | `0`           | Минимальный зум               |
| `maxZoom`                | `number`               | `22`          | Максимальный зум              |
| `zoomSnap`               | `number`               | `1`           | Шаг округления зума           |
| `zoomDelta`              | `number`               | `1`           | Шаг `zoomIn`/`zoomOut`        |
| `maxBounds`              | `Bounds \| number[][]` | `null`        | Ограничение панорамирования   |
| `crs`                    | `CRS`                  | `EPSG3857`    | Система координат             |
| `zoomAnimation`          | `boolean`              | `true`        | CSS-анимация зума             |
| `zoomAnimationThreshold` | `number`               | `4`           | Максимум уровней для анимации |
| `fadeAnimation`          | `boolean`              | `true`        | Плавное появление тайлов      |
| `trackResize`            | `boolean`              | `true`        | `ResizeObserver` контейнера   |
| `preferCanvas`           | `boolean`              | `false`       | Canvas для новых векторов     |
| `closePopupOnClick`      | `boolean`              | `true`        | Закрывать попапы кликом       |
| `zoomControl`            | `boolean`              | `true`        | Добавить `ZoomControl`        |
| `attributionControl`     | `boolean`              | `true`        | Добавить `AttributionControl` |
| `dragging`               | `boolean`              | `true`        | Перетаскивание карты          |
| `inertia`                | `boolean`              | `true`        | Инерция после drag            |
| `inertiaDeceleration`    | `number`               | `3000`        | Замедление, px/с²             |
| `inertiaMaxSpeed`        | `number`               | `1500`        | Максимальная скорость, px/с   |
| `scrollWheelZoom`        | `boolean`              | `true`        | Зум колесом                   |
| `wheelDebounceTime`      | `number`               | `40`          | Склейка wheel-событий, мс     |
| `wheelPxPerZoomLevel`    | `number`               | `60`          | Пикселей на уровень зума      |
| `doubleClickZoom`        | `boolean`              | `true`        | Зум двойным кликом            |
| `touchZoom`              | `boolean`              | `true`        | Pinch-зум                     |
| `attributionPrefix`      | `string`               | ссылка Sweety | Префикс атрибуции             |

### Методы вида

| Метод                                         | Результат |
| --------------------------------------------- | --------- |
| `setView(center, zoom?, options?)`            | `this`    |
| `setZoom(zoom, options?)`                     | `this`    |
| `zoomIn(delta?, options?)`                    | `this`    |
| `zoomOut(delta?, options?)`                   | `this`    |
| `setZoomAround(anchor, zoom, options?)`       | `this`    |
| `setZoomAroundPoint(point, zoom, options?)`   | `this`    |
| `panBy(offset, options?)`                     | `this`    |
| `panTo(center, options?)`                     | `this`    |
| `panInside(latlng, options?)`                 | `this`    |
| `panInsideBounds(bounds, options?)`           | `this`    |
| `flyTo(center, zoom?, options?)`              | `this`    |
| `fitBounds(bounds, options?)`                 | `this`    |
| `flyToBounds(bounds, options?)`               | `this`    |
| `getBoundsZoom(bounds, inside?, padding?)`    | `number`  |
| `getCenter()`                                 | `LatLng`  |
| `getZoom()` / `getMinZoom()` / `getMaxZoom()` | `number`  |
| `setMinZoom(zoom)` / `setMaxZoom(zoom)`       | `this`    |
| `setMaxBounds(bounds)`                        | `this`    |
| `getBounds()`                                 | `Bounds`  |
| `invalidateSize(options?)`                    | `this`    |
| `remove()`                                    | `this`    |

`options.animate` включает анимацию для `setView`/`panTo`/`fitBounds`.
`flyTo` поддерживает `duration` и `curve`.

### Координатные преобразования

| Метод                               | Описание                      |
| ----------------------------------- | ----------------------------- |
| `project(latlng, zoom?)`            | География → мировые пиксели   |
| `unproject(point, zoom?)`           | Мировые пиксели → география   |
| `latLngToLayerPoint(latlng)`        | Пиксели относительно map pane |
| `layerPointToLatLng(point)`         | Обратное преобразование       |
| `latLngToContainerPoint(latlng)`    | Пиксели контейнера            |
| `containerPointToLatLng(point)`     | Обратное преобразование       |
| `containerPointToLayerPoint(point)` | Смещение панели               |
| `layerPointToContainerPoint(point)` | Смещение панели               |
| `mouseEventToLatLng(event)`         | Координата события мыши       |
| `projectedBounds()` на CRS          | Границы мира                  |
| `distance(from, to)`                | Расстояние в метрах           |
| `getZoomScale(toZoom, fromZoom?)`   | Масштаб между зумами          |
| `getScaleZoom(scale, fromZoom?)`    | Зум по масштабу               |

### Слои и панели

| Метод                                            | Описание              |
| ------------------------------------------------ | --------------------- |
| `addLayer(layer)` / `removeLayer(layer)`         | Добавить/удалить слой |
| `hasLayer(layer)`                                | Проверка наличия      |
| `eachLayer(fn, context?)`                        | Итерация              |
| `getLayers()`                                    | Массив слоёв          |
| `getPane(name?, create?)`                        | DOM-панель            |
| `getPanes()`                                     | Все панели            |
| `addControl(control)` / `removeControl(control)` | Управление контролами |
| `getContainer()`                                 | Корневой DOM-элемент  |
| `whenReady(fn, context?)`                        | Вызов после загрузки  |

Стандартные панели: `tile`, `overlay`, `shadow`, `marker`, `tooltip`, `popup`.
Собственная панель создаётся через `getPane('my-pane')`.

## LatLng

```js
new LatLng(55.75, 37.61);
new LatLng([55.75, 37.61, 120]);
new LatLng({ lat: 55.75, lng: 37.61 });
new LatLng(existingLatLng);
```

Свойства: `lat`, `lng`, `alt`.

| Метод                    | Описание                |
| ------------------------ | ----------------------- |
| `clone()`                | Копия                   |
| `wrap()`                 | Долгота в `[-180, 180)` |
| `distanceTo(other)`      | Haversine, метры        |
| `equals(other, margin?)` | Сравнение с допуском    |
| `toString()`             | Строковое представление |

## Point

```js
new Point(100, 200);
new Point([100, 200]);
new Point({ x: 100, y: 200 });
```

Методы: `clone`, `add`, `subtract`, `multiplyBy`, `divideBy`, `scaleBy`,
`unscaleBy`, `round`, `floor`, `ceil`, `trunc`, `distanceTo`, `contains`,
`equals`, `toString`. Арифметические методы мутируют точку и возвращают `this`.

## Bounds

```js
new Bounds([55.7, 37.5], [55.8, 37.7]);
new Bounds([
  [55.7, 37.5],
  [55.8, 37.7],
]);
new Bounds(existingBounds);
```

| Метод                                                   | Описание                  |
| ------------------------------------------------------- | ------------------------- |
| `extend(object)`                                        | Расширить                 |
| `pad(ratio)`                                            | Расширить на долю размера |
| `getSouthWest()` / `getNorthEast()`                     | Углы                      |
| `getNorthWest()` / `getSouthEast()`                     | Углы                      |
| `getWest()` / `getSouth()` / `getEast()` / `getNorth()` | Координаты                |
| `getCenter()`                                           | Центр                     |
| `getSize()`                                             | `Point(ширина, высота)`   |
| `contains(object)`                                      | Вложенность               |
| `intersects(object)`                                    | Пересечение               |
| `overlaps(other)`                                       | Строгое перекрытие        |
| `clamp(latlng)`                                         | Ближайшая точка внутри    |
| `isValid()`                                             | Валидность                |
| `equals(other, margin?)`                                | Сравнение                 |
| `toBBoxString()`                                        | `west,south,east,north`   |
| `clone()`                                               | Копия                     |

## Projection и CRS

- `Projection` — интерфейс `project`/`unproject`.
- `EPSG3857Projection` — сферический Меркатор, широта ограничена ±85.0511287798°.
- `EPSG4326Projection` — эквиректангулярная проекция в градусах.
- `CRS` объединяет проекцию, `Transformation` и функцию `scale(zoom)`.
- `EPSG3857` и `EPSG4326` — готовые CRS.
- `resolveCRS(value)` принимает CRS, строку `EPSG:3857`/`EPSG:4326` или `undefined`.

## Evented

Базовый класс для карты, слоёв, обработчиков и контролов.

```js
evented.on('click', handler, context?);
evented.once('load', handler);
evented.off('click', handler);
evented.fire('custom', { value: 42 });
evented.listens('click');
```

- `on` принимает несколько типов через пробел и объект `{ type: handler }`.
- `fire` по умолчанию всплывает к event parent.
- `addEventParent` / `removeEventParent` управляют всплытием.
- `Event` содержит `type`, `target`, `sourceTarget`, `propagatedFrom`.

## Layer

Базовый класс слоя.

| Метод                                                         | Описание                   |
| ------------------------------------------------------------- | -------------------------- |
| `addTo(map)`                                                  | Добавить на карту          |
| `remove()`                                                    | Удалить с текущей карты    |
| `removeFrom(map)`                                             | Удалить с конкретной карты |
| `onAdd(map)` / `onRemove(map)`                                | Хуки жизненного цикла      |
| `getPane(name?)`                                              | Панель слоя                |
| `getAttribution()`                                            | Строка атрибуции           |
| `setZIndex(z)`                                                | z-index контейнера         |
| `bringToFront()` / `bringToBack()`                            | Порядок в панели           |
| `bindPopup(content, options?)`                                | Попап по клику             |
| `unbindPopup()`                                               | Удалить попап              |
| `openPopup(latlng?)` / `closePopup()` / `togglePopup()`       | Управление                 |
| `isPopupOpen()` / `getPopup()`                                | Состояние                  |
| `bindTooltip(content, options?)`                              | Tooltip по наведению       |
| `unbindTooltip()`                                             | Удалить tooltip            |
| `openTooltip(latlng?)` / `closeTooltip()` / `toggleTooltip()` | Управление                 |
| `isTooltipOpen()` / `getTooltip()`                            | Состояние                  |

## LayerGroup и FeatureGroup

`LayerGroup(layers?, options?)`:

- `addLayer`, `removeLayer`, `clearLayers`, `hasLayer`, `eachLayer`, `getLayers`,
  `invoke(method, ...args)`, `setZIndex`, `getAttributions`.

`FeatureGroup` дополнительно:

- `bindPopup`, `unbindPopup`, `openPopup`, `closePopup`, `togglePopup`;
- `bindTooltip`, `unbindTooltip`, `openTooltip`, `closeTooltip`, `toggleTooltip`;
- `setStyle`, `bringToFront`, `bringToBack`.

## TileLayer

```js
new TileLayer(urlTemplate, options?);
```

| Опция                             | По умолчанию  | Описание                     |
| --------------------------------- | ------------- | ---------------------------- |
| `subdomains`                      | `'abc'`       | Строка или массив            |
| `minZoom` / `maxZoom`             | `0` / `19`    | Видимость слоя               |
| `maxNativeZoom` / `minNativeZoom` | `null`        | Пределы нативных тайлов      |
| `tileSize`                        | `256`         | Размер тайла                 |
| `tms`                             | `false`       | Инвертировать Y              |
| `noWrap`                          | `false`       | Не повторять мир             |
| `zoomOffset` / `zoomReverse`      | `0` / `false` | Смещение зума                |
| `errorTileUrl`                    | `''`          | Заглушка ошибки              |
| `detectRetina`                    | `false`       | Подставлять `{r}`            |
| `crossOrigin`                     | `false`       | CORS для canvas-экспорта     |
| `referrerPolicy`                  | `''`          | `referrerpolicy`             |
| `opacity`                         | `1`           | Прозрачность                 |
| `keepBuffer`                      | `2`           | Буфер тайлов вокруг вьюпорта |
| `maxRetries`                      | `2`           | Повторы загрузки             |
| `maxCacheSize`                    | `256`         | Размер кэша изображений      |
| `updateWhenIdle`                  | `false`       | Обновлять после moveend      |
| `attribution`                     | `null`        | HTML-атрибуция               |

Методы: `setUrl`, `setOpacity`, `redraw`, `getTileUrl`, `getTileRange`,
`getActiveTileCount`, `getCacheSize`, `clearTileCache`.

События: `tileloadstart`, `tileload`, `tileerror`, `load`.

## Marker и иконки

```js
new Marker(latlng, {
  icon,
  draggable: false,
  keyboard: true,
  title: '',
  alt: 'Marker',
  zIndexOffset: 0,
  opacity: 1,
  riseOnHover: false,
  pane: 'marker',
  shadowPane: 'shadow',
  autoPan: false,
});
```

Методы: `setLatLng`, `getLatLng`, `setIcon`, `setZIndexOffset`, `setOpacity`,
`setDraggable`, `isDraggable`, `getElement`, `toGeoJSON`.

События: DOM-события (`click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`,
`mouseout`, `contextmenu`) и `dragstart`, `drag`, `dragend`, `move`.

`Icon({ iconUrl, iconSize, iconAnchor, popupAnchor, tooltipAnchor, shadowUrl, ... })`.
`DivIcon({ html, className, iconSize, iconAnchor, bgPos })`.

## Popup и Tooltip

`Popup(options?)` и `Tooltip(options?)` наследуют общий `DivOverlay`.

| Метод                               | Описание                   |
| ----------------------------------- | -------------------------- |
| `setContent(content)`               | HTML, DOM-узел или функция |
| `getContent()`                      | Текущий контент            |
| `setLatLng(latlng)` / `getLatLng()` | Якорь                      |
| `openOn(map)` / `addTo(map)`        | Открыть                    |
| `close()` / `remove()` / `toggle()` | Закрыть/переключить        |
| `isOpen()` / `getElement()`         | Состояние и DOM            |
| `update()`                          | Перерисовать контент       |

Опции: `offset`, `direction` (`auto`, `top`, `bottom`, `left`, `right`,
`center`), `className`, `maxWidth`, `minWidth`, `maxHeight`, `autoPan`,
`autoPanPadding`, `keepInView`, `closeButton`, `autoClose`, `closeOnEscapeKey`,
`interactive`, `opacity`.

## Векторные слои

Общие опции `Path`: `stroke`, `color`, `weight`, `opacity`, `lineCap`,
`lineJoin`, `dashArray`, `dashOffset`, `fill`, `fillColor`, `fillOpacity`,
`fillRule`, `interactive`, `className`, `renderer`.

Методы: `setStyle`, `getStyle`, `redraw`, `getBounds`, `bringToFront`,
`bringToBack`.

### Polyline

```js
new Polyline(latlngs, options?);
```

`setLatLngs`, `getLatLngs`, `addLatLng(latlng, ring?)`, `getBounds`, `toGeoJSON`.
Поддерживает несколько несвязанных линий.

### Polygon

```js
new Polygon(latlngs, options?);
```

Массив колец: первое — внешнее, остальные — отверстия. Методы `getLatLngs`,
`setLatLngs`, `getCenter`, `getBounds`, `toGeoJSON`.

### Circle

```js
new Circle(latlng, radiusInMeters, options?);
```

`getLatLng`, `setLatLng`, `getRadius`, `setRadius`, `getBounds`, `toGeoJSON`.
Окружность аппроксимируется 64 сегментами в экранном пространстве.

### Rectangle

```js
new Rectangle(bounds, options?);
```

`getBounds`, `setBounds`, `getCenter`, `toGeoJSON`.

### Renderer, SVG, Canvas

- `SVG` — один `<svg>` на карту, отдельный `<path>` на слой.
- `Canvas` — один `<canvas>` на карту, общая отрисовка и hit-testing.
- `map.options.preferCanvas` направляет новые пути в Canvas.
- `new Canvas()` можно передать как `renderer` в опциях пути.

## GeoJSONLayer

```js
new GeoJSONLayer(geojson, {
  style,
  pointToLayer,
  onEachFeature,
  filter,
  coordsToLatLng,
});
```

| Метод                | Описание                 |
| -------------------- | ------------------------ |
| `addData(geojson)`   | Добавить данные          |
| `resetStyle(layer?)` | Вернуть стиль по `style` |
| `setStyle(style)`    | Задать стиль/функцию     |
| `toGeoJSON()`        | FeatureCollection        |

`style` может быть объектом или функцией `(feature) => style`.
`pointToLayer(feature, latlng)` позволяет заменить стандартный маркер.
`coordsToLatLng(coords)` вызывается для каждой позиции.
`filter(feature)` возвращает `false`, чтобы пропустить объект.

## Контролы

Все контролы наследуют `Control`:

- `getPosition()`, `setPosition(position)`;
- `getContainer()`, `addTo(map)`, `remove()`;
- `onAdd(map)` и `onRemove(map)` для реализации.

### ZoomControl

```js
new ZoomControl({ position: 'topleft', zoomInText: '+', zoomOutText: '−' });
```

Кнопки блокируются на `minZoom`/`maxZoom`.

### AttributionControl

```js
new AttributionControl({ prefix: 'Sweety' });
```

`addAttribution(text)`, `removeAttribution(text)`, `setPrefix(prefix)`.
Атрибуции собираются с `map.getLayers()` и дедуплицируются.

### ScaleControl

```js
new ScaleControl({ position: 'bottomleft', maxWidth: 100, metric: true, imperial: true });
```

Обновляется на `moveend`, `zoomend`, `resize`.

### LayersControl

```js
new LayersControl(baseLayers, overlays, {
  position: 'topright',
  collapsed: true,
  hideSingleBase: false,
});
```

`addBaseLayer(layer, name)`, `addOverlay(layer, name)`, `removeLayer(layer)`.
События карты: `baselayerchange`, `overlayadd`, `overlayremove`.

## Плагины

```js
import { definePlugin, use, unuse, getPlugin, listPlugins } from 'sweety-map';

definePlugin('my-plugin', (Sweety, options) => {
  Sweety.Map.addInitHook(function () {
    this.myOption = options.value;
  });
});

use('my-plugin', { value: 1 });
unuse('my-plugin');
```

`Sweety.plugin` — алиас `definePlugin`.

## Утилиты

`Sweety.Util`: `extend`, `template`, `clamp`, `wrapNum`, `toRad`, `toDeg`,
`stamp`, `debounce`, `throttle`, `rafThrottle`, `requestAnimFrame`,
`cancelAnimFrame`, `easeOutCubic`, `easeInOutCubic`, `devicePixelRatio`,
`hasTouch`.

`Sweety.DomUtil`: `create`, `createNS`, `addClass`, `removeClass`, `toggleClass`,
`hasClass`, `empty`, `remove`, `setPosition`, `setPositionAbsolute`,
`setOpacity`, `fireDOMEvent`, `on`, `off`, `stop`, `getMousePosition`,
`getWheelDelta`, `disableTextSelection`, `enableTextSelection`.

## Публичные экспорты

```text
Map, LatLng, Point, Bounds, Evented, Event, Handler,
CRS, Projection, Transformation, EPSG3857, EPSG4326,
EPSG3857Projection, EPSG4326Projection, resolveCRS,
clampMercatorLatitude, destinationPoint,
Layer, LayerGroup, FeatureGroup, TileLayer, Marker, Icon, DivIcon, defaultIcon,
Popup, Tooltip, GeoJSONLayer, GeoJSON, Polyline, Polygon, Circle, Rectangle,
Renderer, SVG, Canvas,
Control, ZoomControl, AttributionControl, ScaleControl, LayersControl, POSITIONS,
Plugin, definePlugin, plugin, use, unuse, getPlugin, listPlugins,
installedPlugins, Util, DomUtil, toLatLng, toPoint, version
```
