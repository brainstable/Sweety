# Sweety map-edit-plugin

Плагин редактирования и рисования геометрии для [Sweety](../../README.md) —
самостоятельный пакет, который подключается только через публичный API ядра.
Ядро не нужно патчить: плагин не добавляет глобальных переменных, не меняет
прототипы и хранит всё состояние в собственном экземпляре.

```
npm install sweety-map sweety-map-edit-plugin
```

```js
import { Map, TileLayer, Polygon } from 'sweety-map';
import { EditPlugin } from 'sweety-map-edit-plugin';
import 'sweety-map-edit-plugin/style.css';

const map = new Map('map', { center: [55.75, 37.61], zoom: 12 });
new TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap',
}).addTo(map);

const polygon = new Polygon([
  [
    [55.76, 37.6],
    [55.76, 37.64],
    [55.74, 37.64],
  ],
]).addTo(map);

const editor = new EditPlugin(map, { position: 'topleft' });
editor.enableEdit(polygon);
editor.setMode('edit');
editor.selectLayer(polygon);

editor.on('update', (event) => {
  console.log(event.action, event.layer.toGeoJSON());
});

editor.on('create', (event) => {
  // Слой уже добавлен на карту и включён в редактирование.
  console.log('created', event.layer.toGeoJSON());
});
```

`EditPlugin.install(map, options)` — альтернативная установка, возвращающая
существующий экземпляр при повторном вызове:

```js
const editor = EditPlugin.install(map, { undoRedo: true });
map.editPlugin; // editor
map.edit(); // editor
```

## Возможности

- Режимы `idle / select / edit / create / delete` с событием `modechange`.
- Вершины, середины сегментов, перетаскивание тела геометрии.
- Маркер, полилиния, полигон (включая отверстия), круг, прямоугольник.
- GeoJSON `MultiPolygon`, `MultiLineString`, `GeometryCollection` и
  произвольные `FeatureGroup`: редактирование всех частей как одной группы.
- Рисование с ghost-предпросмотром, завершением по `Enter` / двойному клику /
  замыканию полигона и отменой по `Esc` / правому клику.
- Undo/redo на Command-паттерне, ограничение истории.
- Snap-to-grid и привязка к вершинам соседних объектов.
- Проверка самопересечений с событием `selfintersection`.
- Панель инструментов с inline-SVG, i18n, тултипами и мобильными размерами.
- Отдельные SVG-слои вершин и предпросмотра: геометрия карты не перерисовывается.
- CSS-переменные и светлая/тёмная темы.

## Архитектура

```
EditPlugin ──────────────────────────────────────────────────────────────┐
│  состояние: режим, выбранные слои, сессии, CommandStack, настройки       │
│                                                                         │
├── EditMode                  конечный автомат режимов                    │
├── EditSession               вершины и геометрия одного листового слоя    │
│   └── GroupEditSession      агрегирует части MultiPolygon/FeatureGroup   │
├── CommandStack              undo/redo                                    │
│   ├── GeometryCommand       MoveVertex / AddVertex / DeleteVertex / ...  │
│   ├── CreateLayerCommand    добавление слоя                              │
│   └── DeleteLayerCommand    удаление слоя                                │
├── HandleLayer               отдельный SVG-слой вершин в своей панели     │
├── GhostLayer                отдельный SVG-слой предпросмотра             │
├── EditHandler               базовый жест                                │
│   ├── VertexHandler         перетаскивание вершины                       │
│   ├── MidpointHandler       вставка + перетаскивание новой вершины       │
│   ├── BodyDragHandler       перетаскивание тела                           │
│   └── DrawHandler           конечный автомат рисования                    │
├── EditControl               панель режимов                               │
└── DrawToolbar               подсказка и кнопки завершения рисования      │
```

Точка интеграции — публичные классы и методы ядра: `Map`, `Layer`, `Marker`,
`Polyline`, `Polygon`, `Circle`, `Rectangle`, `FeatureGroup`, `Control`,
`Evented`, `LatLng`, `Point`, `Bounds`, `map.project/unproject`,
`latLngToContainerPoint/containerPointToLatLng`, `addLayer/removeLayer`,
`addControl/removeControl`. Плагин не требует правок `src/`.

### Структура пакета

```
packages/map-edit-plugin/
├── src/
│   ├── index.js                 публичные экспорты
│   ├── EditPlugin.js            главный менеджер
│   ├── EditMode.js              конечный автомат
│   ├── i18n.js                  строки и интерполяция
│   ├── core/
│   │   ├── GeometryUtils.js     геометрия, снимки, самопересечения
│   │   ├── EditSession.js       сессии одного слоя и группы
│   │   ├── Command.js           команды
│   │   └── CommandStack.js      undo/redo
│   ├── handlers/                EditHandler, Vertex/Midpoint/Body/Draw
│   ├── layers/                  HandleLayer, GhostLayer
│   ├── control/                 EditControl, DrawToolbar, icons
│   └── styles/map-edit-plugin.css
├── types/index.d.ts
├── test/                        unit и интеграционные тесты (jsdom)
├── demo/                        интерактивное демо
├── vite.config.js
├── vitest.config.js
└── package.json
```

## Режимы

| Режим    | Поведение                                         |
| -------- | ------------------------------------------------- |
| `idle`   | клики игнорируются, handles не показываются       |
| `select` | выбор кликом, Shift/Ctrl — мультивыбор, подсветка |
| `edit`   | вершины выбранных объектов, drag вершин и тела    |
| `create` | активная сессия рисования                         |
| `delete` | клик по объекту удаляет его                       |

```js
editor.setMode('edit');
editor.getMode(); // 'edit'
editor.on('modechange', ({ mode, previousMode }) => console.log(previousMode, '→', mode));
```

Выбор автоматически включает редактирование слоя (`enableEdit`), но handles
появляются только в режиме `edit`.

```js
editor.selectLayer(layer);
editor.selectLayer(other, true); // добавить к выбору
editor.toggleSelection(other); // Shift/Ctrl-семантика
editor.getSelected(); // [layer, other]
editor.clearSelection();
```

## API

| Метод                                           | Назначение                                             |
| ----------------------------------------------- | ------------------------------------------------------ |
| `new EditPlugin(map, options)`                  | создать редактор и панель                              |
| `EditPlugin.install(map, options)`              | установить/получить экземпляр                          |
| `enableEdit(layer) → session`                   | включить редактирование слоя или группы                |
| `disableEdit(layer)`                            | выключить и убрать handles                             |
| `isEditable(layer)`                             | включено ли редактирование                             |
| `getSession(layer)`                             | сессия слоя                                            |
| `setMode(mode)` / `getMode()`                   | режим                                                  |
| `selectLayer(layer, additive?)`                 | выбрать слой                                           |
| `unselectLayer` / `toggleSelection`             | снять/переключить выбор                                |
| `getSelected()` / `clearSelection()`            | выбор                                                  |
| `startDrawing(type, options?)`                  | `marker`, `polyline`, `polygon`, `circle`, `rectangle` |
| `finishDrawing()` / `cancelDrawing()`           | завершить/отменить черновик                            |
| `isDrawing()` / `getDrawType()`                 | состояние рисования                                    |
| `deleteLayer(layer)`                            | удалить слой (с учётом `confirmDelete`)                |
| `deleteSelected()`                              | удалить выбранные                                      |
| `undo()` / `redo()` / `canUndo()` / `canRedo()` | история                                                |
| `destroy()`                                     | снять все обработчики, DOM и подписки                  |
| `t(key, vars?)`                                 | строка i18n                                            |

## События

| Событие            | Данные                                        |
| ------------------ | --------------------------------------------- |
| `modechange`       | `{ mode, previousMode }`                      |
| `select`           | `{ layer, layers, additive }`                 |
| `unselect`         | `{ layer, layers }`                           |
| `edit:enabled`     | `{ layer }`                                   |
| `edit:disabled`    | `{ layer }`                                   |
| `update`           | `{ layer, layers, action, command? }`         |
| `create`           | `{ layer, type, parent? }`                    |
| `delete`           | `{ layer, layers, command }`                  |
| `draw:started`     | `{ type, target? }`                           |
| `draw:vertexadded` | `{ type, latlng, index, vertices }`           |
| `draw:completed`   | `{ layer, type, parent? }`                    |
| `draw:canceled`    | `{ type, reason }`                            |
| `draw:invalid`     | `{ type, reason }`                            |
| `selfintersection` | `{ layer, rings: [{ ring, intersections }] }` |
| `vertexlimit`      | `{ layer, handle }`                           |
| `undo` / `redo`    | `{ command }`                                 |
| `destroy`          | —                                             |

`update` отправляется один раз после завершения жеста (на `pointerup`), а не на
каждый `pointermove`. `action` — `move-vertex`, `insert-vertex`,
`delete-vertex:*`, `move-layer`, `undo`, `redo`.

События `draw:*` дополняют историю: `create` приходит после `draw:completed`.

## Опции

```js
const editor = new EditPlugin(map, {
  position: 'topleft',
  toolbarPosition: 'bottomleft',
  modes: ['select', 'edit', 'draw:polygon', 'draw:polyline', 'delete', 'undo', 'redo'],
  control: true,
  toolbar: true,
  keyboard: true,
  undoRedo: true,
  maxHistory: 100,
  confirmDelete: false, // true | (layer, plugin) => boolean
  snap: { enabled: false, gridSize: 10, toVertices: true, tolerance: 10 },
  limits: {
    polygon: { min: 3, max: Infinity },
    polyline: { min: 2, max: Infinity },
  },
  warnSelfIntersection: true,
  maxHandles: 400, // прореживание вершин для больших полигонов
  midpoints: true,
  edgePan: { enabled: true, margin: 24, speed: 16 },
  style: {
    handleSize: 8,
    handleColor: '#fff',
    midpointColor: '#93c5fd',
    stroke: '#2f6fed',
    fill: 'rgba(47,111,237,.15)',
    ghostOpacity: 0.65,
    selectedColor: '#f59e0b',
    selectedWeight: 4,
  },
  handles: { size: 10, color: '#fff' },
  selectedStyle: { color: '#f59e0b', weight: 4 },
  ghostStyle: { stroke: '#2f6fed', fill: 'rgba(47,111,237,.15)' },
  vertexStyle: { fill: '#fff', stroke: '#1f2937' },
  midpointStyle: { fill: '#93c5fd' },
  theme: 'dark', // 'light' | 'dark' | null (системная тема)
  i18n: { edit: 'Редактировать', draw: 'Нарисовать' },
  target: null, // группа по умолчанию для новых объектов
  className: 'my-editor',
  zIndex: 640,
});
```

`style` можно задавать плоско (`handleSize`) или через отдельные объекты
`handles`, `vertexStyle`, `midpointStyle`, `selectedStyle`, `ghostStyle`.

## Редактирование вершин

- Кружки — вершины, маленькие кружки — середины сегментов.
- Клик по середине вставляет вершину и сразу позволяет её перетащить.
- Правый клик, Ctrl/Cmd+клик или долгий тап (touch) удаляют вершину.
- `Delete`/`Backspace` удаляет выбранные объекты.
- Маркер: одна вершина или перетаскивание иконки.
- Круг: центр + отдельная ручка радиуса.
- Прямоугольник: 4 угла + перетаскивание тела.
- Полигон: все кольца и отверстия, замыкание сохраняется.
- Тело геометрии перетаскивается за путь; вся группа двигается целиком.

Ограничения:

```js
limits: {
  polygon: { min: 3, max: 1000 },
  polyline: { min: 2, max: 5000 },
}
```

`maxHandles` ограничивает число одновременно отрисованных вершин; для полигонов
длиннее 200 вершин середины сегментов не создаются.

## Рисование

```js
editor.startDrawing('polygon', { target: featureGroup });
```

| Тип         | Завершение                                               |
| ----------- | -------------------------------------------------------- |
| `marker`    | один клик                                                |
| `polyline`  | `Enter`, двойной клик; минимум 2 вершины                 |
| `polygon`   | `Enter`, двойной клик, клик по первой вершине; минимум 3 |
| `circle`    | первый клик — центр, второй — радиус                     |
| `rectangle` | два противоположных угла                                 |

`Esc` снимает последнюю вершину, повторный `Esc` отменяет черновик. Правый клик
делает то же самое. `draw:started` приходит при старте, `draw:vertexadded` — на
каждую вершину, `draw:completed` и `create` — после создания слоя.

По умолчанию созданный слой добавляется на карту, включается в редактирование и
выделяется. `target` позволяет складывать результаты в `FeatureGroup` или
`GeoJSONLayer`.

## Undo/redo и команды

```js
editor.undo();
editor.redo();
editor.canUndo();
editor.canRedo();
```

История ограничена `maxHistory` (по умолчанию 100). Каждый жест — одна команда:

- `MoveVertexCommand`, `AddVertexCommand`, `DeleteVertexCommand`,
  `ResizeCircleCommand`, `MoveLayerCommand`;
- `CreateLayerCommand` / `DeleteLayerCommand` — добавление и удаление слоя с
  возможностью вернуть его на карту;
- `CompositeCommand` — несколько операций как одна.

При `undoRedo: false` изменения применяются, но история не ведётся.

## GeoJSON и группы

`GeoJSONLayer` с `MultiPolygon`/`MultiLineString` разворачивается в группу
листовых сессий. `enableEdit(group)` показывает вершины всех частей, а
перетаскивание тела двигает всю группу. Для `GeometryCollection` и вложенных
`FeatureGroup` части также собираются рекурсивно.

```js
const geo = new GeoJSONLayer(featureCollection).addTo(map);
editor.enableEdit(geo);
editor.setMode('edit');
editor.selectLayer(geo);
```

## Стили и темы

Классы имеют префикс `.map-edit-*`. CSS-переменные можно переопределить на
контейнере карты или на `.map-edit-plugin`:

```css
.map-edit-plugin {
  --map-edit-handle-size: 10px;
  --map-edit-handle-color: #ffffff;
  --map-edit-handle-stroke: #111827;
  --map-edit-midpoint-color: #93c5fd;
  --map-edit-stroke: #2f6fed;
  --map-edit-fill: rgba(47, 111, 237, 0.15);
  --map-edit-ghost-opacity: 0.65;
  --map-edit-selected-stroke: #f59e0b;
}
```

`style.selectedStyle` не перезаписывает стиль слоя: выделение реализовано
классом `.map-edit-selected` и CSS, поэтому исходные `color/weight/fill`
сохраняются. Тёмная тема включается `theme: 'dark'`, атрибутом
`data-map-edit-theme="dark"` или системным `prefers-color-scheme`.

## Клавиатура

| Клавиши              | Действие                     |
| -------------------- | ---------------------------- |
| `Esc`                | снять вершину/черновик/выбор |
| `Enter`              | завершить рисование          |
| `Delete`/`Backspace` | удалить выбранное            |
| `Ctrl/Cmd+Z`         | undo                         |
| `Ctrl/Cmd+Shift+Z`   | redo                         |
| `Ctrl/Cmd+Y`         | redo                         |

Обработчик игнорирует поля ввода и `contenteditable`.

## i18n

```js
new EditPlugin(map, {
  i18n: {
    select: 'Выбрать',
    edit: 'Редактировать',
    drawPolygon: 'Полигон',
    finish: 'Готово',
    cancel: 'Отмена',
  },
});
```

Ключи: `toolbar`, `select`, `edit`, `delete`, `undo`, `redo`, `drawMarker`,
`drawPolyline`, `drawPolygon`, `drawCircle`, `drawRectangle`, `finish`,
`cancel`, `hint*`, `vertices`, `selected`, `confirmDelete`, `vertexLimit`.

## Крайние случаи и производительность

- Удаление слоя с карты автоматически закрывает его сессию и снимает handles.
- Handles пересчитываются на `move/zoom/resize/viewreset/zoomend`; панель
  редактора находится внутри `mapPane`, поэтому CSS-анимация зума сохраняет
  выравнивание.
- При перетаскивании за край карты включается edge panning.
- `pointermove` батчится через `requestAnimationFrame`; `update` — на `pointerup`.
- Handles ленивы: создаются только для выбранных объектов в режиме `edit`.
- `destroy()` удаляет SVG, панели, контролы, подписки и ссылки на плагин.
- `destroy()` во время рисования отменяет черновик и убирает ghost/toolbar.
- Долгий тап на вершине (touch) удаляет её; pinch-жест карты не перехватывается,
  потому что handles останавливают только собственный `pointerdown`.

## Разработка

```bash
cd packages/map-edit-plugin
npm run dev      # demo с Vite
npm run test     # vitest + jsdom
npm run build    # ESM + UMD + CSS
```

Тесты покрывают `GeometryUtils`, `CommandStack`, создание/редактирование
полигонов, drag вершин и тела, midpoint, круг, прямоугольник, GeoJSON-группы,
удаление, undo/redo, клавиатуру, snap, самопересечения и очистку при `destroy()`.

Пакет собирается с `peerDependencies: { "sweety-map": "^0.1.0" }`: ядро не
бандлится. Внешний вид подключается отдельным файлом `map-edit-plugin.css`.
UMD-глобал — `SweetyEdit` (ядро — `Sweety`).

## Миграция с Leaflet.draw / Leaflet.Editable

Плагин не зависит от Leaflet и не использует глобальный `L`. Соответствия:

| Было                               | Стало                                              |
| ---------------------------------- | -------------------------------------------------- |
| `new L.Draw.Polygon(map).enable()` | `editor.startDrawing('polygon')`                   |
| `new L.Edit.Poly(layer).enable()`  | `editor.enableEdit(layer); editor.setMode('edit')` |
| `layer.editing.enable()`           | `editor.enableEdit(layer)`                         |
| `draw:created`                     | `create` / `draw:completed`                        |
| `draw:edited`                      | `update`                                           |
| `draw:deleted`                     | `delete`                                           |
| `L.EditToolbar.Edit`               | `EditControl` (встроен)                            |
| `L.Draw.Event.*`                   | строковые события `draw:*`                         |

Отличия: редактор — экземпляр, а не глобальный синглтон; стили — CSS-переменные;
undo/redo и snapping встроены. Состояние хранится в `EditPlugin`, поэтому на
одной странице можно держать несколько независимых редакторов.
