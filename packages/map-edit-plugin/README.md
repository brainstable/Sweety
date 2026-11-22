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
- Мультиобъекты: объединение нескольких полигонов или линий в один объект и
  обратное разъединение на отдельные объекты.
- Отверстия в полигонах: рисование, проверка вложенности и удаление кольца.
- Разрезание полигонов и линий секущей линией, в том числе по отверстиям.
- Объединение полигонов по общим границам (растворение общей границы).
- GeoJSON `MultiPolygon`, `MultiLineString`, `GeometryCollection` и
  произвольные `FeatureGroup`: редактирование всех частей как одной группы.
- Рисование с ghost-предпросмотром, завершением по `Enter` / двойному клику /
  замыканию полигона и отменой по `Esc` / правому клику.
- Undo/redo на Command-паттерне, ограничение истории.
- Snap-to-grid и привязка к вершинам соседних объектов.
- Проверка самопересечений с событием `selfintersection`.
- Вертикальная панель инструментов с inline-SVG, i18n, тултипами и мобильными
  размерами; на низкой карте инструменты переносятся в следующий столбец.
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
├── Operations                планарная геометрия: разрез, dissolve, кольца│
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
│   │   ├── Operations.js        разрез, dissolve, вложенность колец
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
| `canMerge()` / `mergeSelected()`                | мультиобъект из выбранных полигонов или линий          |
| `canExplode()` / `explodeSelected()`            | разъединить мультиобъект на отдельные объекты          |
| `canAddHole()` / `startHole(layer?)`            | нарисовать отверстие в полигоне                        |
| `addHole(layer, ring)` / `removeHole(layer, i)` | добавить/убрать отверстие программно                   |
| `canCut()` / `startCut()`                       | разрезание секущей линией                              |
| `cutLayers(layers, cutter)`                     | разрезать объекты готовой линией                       |
| `canUnion()` / `unionSelected()`                | объединить полигоны по общим границам                  |
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
| `merge`            | `{ layer, sources, family, command }`         |
| `merge:invalid`    | `{ layers, reason }`                          |
| `explode`          | `{ layer, layers, command }`                  |
| `union`            | `{ layer, sources, rings, command }`          |
| `union:invalid`    | `{ layers, reason }`                          |
| `cut`              | `{ layers, sources, cutter, command }`        |
| `cut:invalid`      | `{ layer?, layers, reason }`                  |
| `hole:added`       | `{ layer, holes }`                            |
| `hole:removed`     | `{ layer, index }`                            |
| `hole:invalid`     | `{ layer, reason }`                           |
| `selfintersection` | `{ layer, rings: [{ ring, intersections }] }` |
| `vertexlimit`      | `{ layer, handle }`                           |
| `undo` / `redo`    | `{ command }`                                 |
| `destroy`          | —                                             |

`update` отправляется один раз после завершения жеста (на `pointerup`), а не на
каждый `pointermove`. `action` — `move-vertex`, `insert-vertex`,
`delete-vertex:*`, `move-layer`, `add-hole`, `remove-hole`, `merge`, `union`,
`cut`, `explode`, `undo`, `redo`.

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

## Мультиобъекты и операции над геометрией

Вторая группа кнопок панели работает с уже нарисованными объектами. Каждая
операция заменяет исходные слои результатом и отменяется одной командой отмены.

### Мультиобъект

Объединение доступно для двух и более объектов одного семейства: полигоны
(включая прямоугольники) дают `MultiPolygon`, полилинии — `MultiLineString`.
Части остаются одним слоем: вершины редактируются все сразу, тело
перетаскивается целиком.

```js
editor.selectLayer(first);
editor.selectLayer(second, true);
editor.mergeSelected(); // один слой с двумя контурами
editor.explodeSelected(); // обратно два отдельных объекта
```

Несвязанные контуры экспортируются корректно: `layer.toGeoJSON()` вернёт
`MultiPolygon`, а не `Polygon`, у которого второй контур выглядел бы отверстием.

### Отверстия

```js
editor.addHole(polygon, ring); // ring: LatLng[]
editor.removeHole(polygon, 1); // 0 — внешнее кольцо
editor.startHole(); // нарисовать отверстие в выбранном полигоне
```

Отверстие проверяется: оно должно лежать внутри полигона и не пересекать его
границу, иначе приходит `hole:invalid` с причиной `outside` или `crosses`.

### Разрезание

`startCut()` переводит редактор в режим черчения секущей: проведите линию через
выбранные объекты и нажмите `Enter`. Полигон делится на две части, полилиния —
на части по точкам пересечения, а отверстия, через которые прошла линия, делятся
вместе с полигоном. Объект, который линия не задела, остаётся как был.

```js
const parts = editor.cutLayers(
  [polygon],
  [
    [55.74, 37.6],
    [55.74, 37.63],
  ],
);
```

### Объединение по общим границам

```js
editor.selectLayer(left);
editor.selectLayer(right, true);
editor.unionSelected();
```

Общая граница исчезает, остаётся один контур, отверстия сохраняются. Операция
рассчитана на примыкающие объекты: если полигоны накладываются друг на друга,
приходит `union:invalid` с причиной `overlap` — для наложения нужны логические
операции над областями, а не растворение границ.

### Какие операции доступны

```js
editor.canMerge(); // ≥ 2 объекта одного семейства
editor.canUnion(); // ≥ 2 полигона
editor.canAddHole(); // ровно один полигон
editor.canCut(); // есть что резать
editor.canExplode(); // у объекта больше одной части
```

Кнопки панели включаются и выключаются по этим же проверкам.

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
  --map-edit-control-bg: rgba(255, 255, 255, 0.96);
  --map-edit-control-border: rgba(15, 23, 42, 0.14);
  --map-edit-control-radius: 9px;
  --map-edit-handle-color: #ffffff;
  --map-edit-handle-stroke: #111827;
  --map-edit-midpoint-color: #93c5fd;
  --map-edit-stroke: #2f6fed;
  --map-edit-fill: rgba(47, 111, 237, 0.15);
  --map-edit-ghost-opacity: 0.65;
  --map-edit-selected-stroke: #f59e0b;
}
```

Панель инструментов вертикальная: кнопки идут сверху вниз, а на низкой карте,
где столбец не помещается, CSS-перенос раскладывает инструменты во второй
столбец — панель не обрезается краем карты. Высота ограничивается по
фактическому размеру карты и пересчитывается на `resize`. Горизонтальная
раскладка возвращается классом `map-edit-control-horizontal`:

```js
editor.control.getContainer().classList.add('map-edit-control-horizontal');
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
`cancel`, `merge`, `union`, `explode`, `addHole`, `cut`, `hint*`, `vertices`,
`selected`, `confirmDelete`, `vertexLimit`.

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
npm run dev      # из корня: demo пакетов на /packages/<pkg>/demo/
npm run test     # vitest + jsdom
npm run build    # ESM + UMD + CSS
```

Корневой dev-сервер резолвит `sweety-map` в `src/index.js` (см. `resolve.alias`
в корневом `vite.config.js`), поэтому demo пакетов работают без сборки ядра.

Демо редактора открывается по адресу
`http://localhost:5173/packages/map-edit-plugin/demo/`. Свой dev-сервер пакета
(`cd packages/map-edit-plugin && npm run dev`) отдаёт то же демо по
`http://localhost:<port>/demo/`; если корневой сервер уже занял 5173, Vite
возьмёт следующий свободный порт.

Если открыть `demo/index.html` с диска, карта не запустится: браузер блокирует
ES-модули по `file://`. Вместо пустой страницы демо показывает команду запуска.
Если модуль не загрузился через сервер, демо выводит причину ошибки со ссылкой
на консоль браузера и терминал Vite.

Тесты покрывают `GeometryUtils`, `Operations`, `CommandStack`, создание и
редактирование полигонов, drag вершин и тела, midpoint, круг, прямоугольник,
GeoJSON-группы, удаление, undo/redo, клавиатуру, snap, самопересечения, операции
над готовой геометрией и очистку при `destroy()`.

Пакет собирается с `peerDependencies: { "sweety-map": "^0.1.0" }`: ядро не
бандлится. Внешний вид подключается отдельным файлом `map-edit-plugin.css`.
UMD-глобал — `SweetyEdit` (ядро — `Sweety`).
