# Sweety map-basemaps

Каталог готовых подложек и менеджер базовых слоёв для [Sweety](../../README.md).
Отдельный пакет, который не меняет ядро и подключается одной строкой.

```bash
npm install sweety-map sweety-map-basemaps
```

```js
import { basemaps } from 'sweety-map-basemaps';
import 'sweety-map-basemaps/style.css';

basemaps.install(map).set('osm');
```

Всё состояние — в экземпляре менеджера. На одной странице можно держать сколько
угодно карт: у каждой будет свой `map.basemaps`.

## Четыре сценария

### A. Один вызов

```js
import { basemaps } from 'sweety-map-basemaps';

basemaps.install(map, {
  default: 'osm',
  persist: true,
  fallback: 'osm',
});

map.basemaps.set('carto-dark');
map.basemaps.set('mapbox', { key: 'pk.xxx', variant: 'satellite' });
map.basemaps.setVariant('retina');
```

`basemaps.install(map)` возвращает менеджер, поэтому возможна совсем короткая
запись:

```js
basemaps.install(map).set('osm');
```

### B. Без менеджера

```js
import { createBasemap } from 'sweety-map-basemaps';

const layer = createBasemap('osm');
layer.addTo(map);
```

`createBasemap` возвращает `BasemapTileLayer` — обычный `TileLayer` с URL,
построенным через выбранный адаптер.

### C. Декларативный контрол

```js
import { BasemapControl } from 'sweety-map-basemaps';

new BasemapControl({
  position: 'topright',
  providers: ['osm', 'carto-dark', 'esri-world-imagery', 'mapbox'],
  preview: true,
}).addTo(map);
```

Если менеджер ещё не установлен, контрол создаст его сам.

### D. Конфиг карты

```js
import { Map } from 'sweety-map';
import 'sweety-map-basemaps'; // регистрирует init hook

const map = new Map('map', {
  center: [55.75, 37.61],
  zoom: 11,
  basemap: 'osm', // или { id: 'carto-dark', variant: 'dark' }
});
```

Используется публичный `Map.addInitHook`, сам экземпляр `Map` не патчится.

## Архитектура

```
basemaps (singleton facade)
│
├── Provider registry         24 встроенных дескриптора + registerProvider
├── BasemapsManager           один на карту: активный id, слои, ключи, persist
│   ├── Resolver              ключи, {s}, {r}, {variant}, proxy, attribution
│   ├── BasemapTileLayer      TileLayer + адаптер
│   ├── BasemapControl        список, поиск, превью, ввод ключа
│   └── events                basemapchange / added / removed / ready / error
├── Tile source adapters
│   ├── XYZAdapter            {z}/{x}/{y}, {s}, {r}, {-y}
│   ├── WMSAdapter            GetMap + BBOX/EPSG:3857
│   ├── WMTSAdapter           GetTile + TileMatrix/TileRow/TileCol
│   ├── GoogleAdapter         lyrs + mt0…mt3
│   ├── YandexAdapter         l=map/sat/hybrid
│   └── BingAdapter           {quadkey}
└── Map init hook             new Map(..., { basemap })
```

Точки интеграции — только публичный API ядра: `Map.addLayer/removeLayer`,
`hasLayer`, `on/off/fire`, `options.crs`, `Control`, `Layer`, `Evented`,
`TileLayer`, `AttributionControl`. URL и атрибуция подставляются в `TileLayer`
через `BasemapTileLayer`; стили и панели не трогают ядро.

## Провайдеры

24 встроенных источника. `requiresKey` означает, что без ключа `set()` выбросит
`BasemapKeyError`, а `basemaperror` отправит понятное сообщение.

| id                   | Категория    | Ключ | Z    | Условия                                                    |
| -------------------- | ------------ | ---- | ---- | ---------------------------------------------------------- |
| `osm`                | streets      | —    | 0–19 | ODbL, [copyright](https://www.openstreetmap.org/copyright) |
| `osm-hot`            | humanitarian | —    | 0–20 | HOT                                                        |
| `opentopomap`        | terrain      | —    | 0–17 | CC-BY-SA                                                   |
| `cyclosm`            | transport    | —    | 0–20 | ODbL                                                       |
| `openrailwaymap`     | transport    | —    | 0–19 | ODbL                                                       |
| `wikimedia`          | streets      | —    | 0–19 | Wikimedia maps                                             |
| `carto-positron`     | streets      | —    | 0–20 | CARTO / OSM                                                |
| `carto-dark`         | dark         | —    | 0–20 | CARTO / OSM                                                |
| `carto-voyager`      | streets      | —    | 0–20 | CARTO / OSM                                                |
| `esri-world-imagery` | satellite    | —    | 0–19 | Esri terms                                                 |
| `esri-world-topo`    | terrain      | —    | 0–19 | Esri terms                                                 |
| `esri-light-gray`    | streets      | —    | 0–16 | Esri terms                                                 |
| `esri-dark-gray`     | dark         | —    | 0–16 | Esri terms                                                 |
| `stamen-toner`       | dark         | —    | 0–20 | Stadia / Stamen                                            |
| `mapbox`             | streets      | да   | 0–22 | [токен](https://account.mapbox.com/access-tokens/)         |
| `maptiler`           | streets      | да   | 0–22 | [ключ](https://cloud.maptiler.com/account/keys/)           |
| `thunderforest`      | transport    | да   | 0–22 | [ключ](https://manage.thunderforest.com/)                  |
| `here`               | streets      | да   | 0–20 | [ключ](https://developer.here.com/)                        |
| `stadia`             | streets      | да   | 0–20 | [ключ](https://client.stadiamaps.com/)                     |
| `jawg`               | streets      | да   | 0–22 | [токен](https://www.jawg.io/)                              |
| `google`             | streets      | —    | 0–20 | Google Maps terms                                          |
| `yandex`             | streets      | —    | 0–19 | требует CRS EPSG:3395                                      |
| `bing`               | satellite    | опц. | 0–23 | Bing terms                                                 |
| `usgs-imagery`       | satellite    | —    | 0–19 | WMS, public domain                                         |

Варианты (`variants`) есть у `mapbox`, `maptiler`, `thunderforest`, `here`,
`stadia`, `jawg`, `google`, `yandex`, `bing`:

```js
map.basemaps.set('mapbox', { key: 'pk.xxx', variant: 'dark' });
map.basemaps.set('google', { variant: 'satellite' });
map.basemaps.set('bing', { variant: 'hybrid' });
map.basemaps.set('here', { key: 'xxx', variant: 'terrain' });
```

### Ключи

Приоритет:

1. `map.basemaps.set('mapbox', { key })`
2. `options.keys.mapbox`
3. `options.keys.global`
4. переменные окружения

```js
basemaps.install(map, {
  keys: {
    mapbox: 'pk.xxx',
    global: 'fallback-key',
  },
});
```

Поддерживаются `SWEETY_BASEMAP_MAPBOX_KEY`, `VITE_MAPBOX_KEY`,
`MAPBOX_ACCESS_TOKEN` и аналогичные имена; конкретное имя можно задать в
`envKey` дескриптора. Ключи никогда не попадают в `localStorage` и
маскируются в `basemaperror`/URL-логах. В репозитории нет ключей.

### Свои провайдеры

```js
basemaps.registerProvider({
  id: 'corp',
  name: 'Corporate',
  category: 'custom',
  url: 'https://tiles.corp/{z}/{x}/{y}.png',
  attribution: '© Corp',
  maxZoom: 18,
});

map.basemaps.set('corp');
```

WMS:

```js
basemaps.registerProvider({
  id: 'corp-wms',
  name: 'Corporate WMS',
  type: 'wms',
  url: 'https://gis.corp/wms',
  layers: 'base',
  format: 'image/png',
  version: '1.3.0',
  crs: 'EPSG:3857',
  attribution: '© Corp',
});
```

WMTS:

```js
basemaps.registerProvider({
  id: 'corp-wmts',
  name: 'Corporate WMTS',
  type: 'wmts',
  url: 'https://gis.corp/wmts',
  layer: 'base',
  tileMatrixSet: 'EPSG:3857',
  format: 'image/png',
});
```

Собственный адаптер:

```js
import { registerTileSource, TileSourceAdapter } from 'sweety-map-basemaps';

class CorpAdapter extends TileSourceAdapter {
  constructor() {
    super('corp');
  }
  buildUrl(provider, { x, y, z }) {
    return `https://gis.corp/${z}/${x}/${y}?token=${provider.token}`;
  }
}

registerTileSource('corp', new CorpAdapter());
```

## BasemapsManager

```js
const manager = basemaps.install(map, options);

manager.set('osm');
manager.set('mapbox', { key: 'pk.xxx', variant: 'satellite' });
manager.setVariant('dark');
manager.setVariant('retina');

manager.get(); // 'osm'
manager.getLayer(); // BasemapTileLayer
manager.getLayer('carto-dark'); // конкретная дополнительная подложка
manager.add('carto-dark'); // наложение, не заменяет активную
manager.remove('carto-dark');
manager.list(); // метаданные + active/hasKey/variants
manager.resolveUrl('osm'); // шаблон URL
manager.getAttribution('osm');
manager.hasKey('mapbox');
manager.registerProvider(def);
manager.unregisterProvider(id);
manager.destroy();
```

### Опции

```js
basemaps.install(map, {
  default: 'osm', // стартовая подложка
  persist: true, // запоминать в localStorage
  storageKey: 'basemap', // ключ хранения
  multiple: false, // true — разрешить наложение
  fallback: 'osm', // аварийная подложка после tileerror
  maxTileErrors: 3,
  zIndex: null, // единый z-index для подложек
  retina: 'auto', // boolean | 'auto'
  variant: 'default',
  keys: {},
  proxy: null, // (url) => string
  env: null, // объект env для тестов/SSR
  control: false, // true — сразу создать BasemapControl
  controlOptions: {},
});
```

### События

| Событие          | Данные                                                      |
| ---------------- | ----------------------------------------------------------- |
| `basemapchange`  | `{ id, layer, previousId, provider, variant, attribution }` |
| `basemapadded`   | `{ id, layer, provider }`                                   |
| `basemapremoved` | `{ id, layer }`                                             |
| `basemapready`   | `{ id, layer, provider }` — первый `load` слоя              |
| `basemaperror`   | `{ id, code, error, message, url?, provider?, warning? }`   |
| `ready`          | `{ manager }`                                               |
| `destroy`        | —                                                           |

`basemaperror.code`: `missing-key`, `unknown-provider`, `unknown-variant`,
`unknown-source-type`, `tileerror`, `projection-warning`.

### Persistence

`persist: true` хранит только `{ id, variant, retina }` под ключом `basemap`.
API-ключи не сохраняются. При `install()` последняя подложка восстанавливается,
если не задан явный `default`.

### Fallback и ошибки

- `TileLayer` делает до двух ретраев каждого тайла.
- При `tileerror` менеджер отправляет `basemaperror` один раз на слой.
- После `maxTileErrors` переключается на `fallback` (если задан).
- При отсутствии ключа `set()` не удаляет текущую подложку, отправляет
  `basemaperror` и выбрасывает `BasemapKeyError`.
- `set()` на неизвестный id не ломает карту: `basemaperror` + исключение.
- Повторный `set()` того же id — no-op (`force: true` пересоздаёт слой).

## URL, варианты и retina

`resolveUrl(id, opts, context)` подставляет:

- `{s}` — субдомен (явно или на уровне тайла через `XYZAdapter`);
- `{z}/{x}/{y}`, `{-y}`;
- `{r}` — `@2x` для retina;
- `{variant}` — значение варианта (`streets-v12`, `satellite.day`, …);
- `{key}`, `{apikey}`, `{apiKey}`, `{api_key}`, `{access_token}` — ключ.

```js
manager.resolveUrl('osm', { coords: { x: 2, y: 1, z: 3 } });
manager.resolveUrl('mapbox', { key: 'pk.xxx', variant: 'satellite' });
manager.resolveUrl('corp', { proxy: (url) => `/proxy?url=${encodeURIComponent(url)}` });
```

Retina включается автоматически при `devicePixelRatio > 1`, если провайдер
поддерживает `{r}`. `setVariant('retina')` включает принудительно.

## BasemapControl

```js
const control = new BasemapControl({
  position: 'topright',
  providers: ['osm', 'carto-dark', 'esri-world-imagery', 'mapbox'],
  labels: { osm: 'Улицы', 'carto-dark': 'Тёмная' },
  preview: true,
  previewCoords: { x: 38, y: 20, z: 6 },
  compact: false,
  search: true,
  showCategories: true,
  i18n: {
    title: 'Слои',
    search: 'Поиск',
    requiresKey: 'Нужен ключ',
    close: 'Закрыть',
  },
  theme: 'dark',
});
```

- Группировка по категориям, поиск по названию/id.
- `labels` заменяет подписи провайдеров в списке и на кнопке, не меняя каталог.
- `previewCoords` задаёт тайл-образец для превью (по умолчанию `{ x: 2, y: 1, z: 2 }`).
- Превью загружаются лениво при открытии панели (`preview: true`); пока
  картинка грузится или если она недоступна, видна цветная заглушка с буквой.
- Активный провайдер подсвечен и отмечен.
- Для `requiresKey` показывается форма ввода ключа; ключ остаётся в памяти.
- `compact: true` — только кнопка.
- Клавиатура: `Escape` закрывает форму/панель; `aria-expanded`, `role=option`,
  `aria-selected`; фокус переходит на поиск/поле ключа.
- Мобильная адаптация: увеличенные зоны касания, панель не выходит за экран.

CSS-переменные:

```css
.map-basemaps-control {
  --map-basemaps-bg: #fff;
  --map-basemaps-border: rgba(15, 23, 42, 0.14);
  --map-basemaps-active: #2f6fed;
  --map-basemaps-radius: 12px;
  --map-basemaps-thumb-width: 64px;
  --map-basemaps-thumb-height: 46px;
}
```

Тёмная тема — `theme: 'dark'` или `[data-map-basemaps-theme="dark"]`.
Все классы имеют префикс `.map-basemaps-`.

## Light-сборка и tree-shaking

Полный каталог:

```js
import { basemaps } from 'sweety-map-basemaps';
```

Минимум (8 бесплатных подложек):

```js
import { basemaps } from 'sweety-map-basemaps/light';
```

Точечный импорт:

```js
import { osm, esriWorldImagery } from 'sweety-map-basemaps';
import { registerProviders } from 'sweety-map-basemaps';
registerProviders([osm, esriWorldImagery]);
```

`providers/` разбит на модули (`osm.js`, `carto-esri.js`, `keyed.js`,
`engines.js`); сборщик выбросит неиспользованные дескрипторы.

## Юридические замечания

Атрибуция подставляется автоматически из дескриптора и удаляется при смене
подложки без дублей. Метаданные `termsUrl`, `license`, `notes` доступны через
`list()`/`getProvider()`. Условия Google, Bing, HERE, Mapbox и других
провайдеров различаются; для production проверяйте их самостоятельно. Модуль
не содержит ключей и не обходит лимиты провайдеров; `proxy` — ответственность
приложения.

## Разработка

```bash
cd packages/map-basemaps
npm run dev      # demo
npm run test     # 48+ тестов
npm run build    # full ESM+UMD+CSS и light ESM+UMD
npm run size     # бюджет размера
```

Демо открывается через корневой dev-сервер:
`http://localhost:5173/packages/map-basemaps/demo/`. Это полноэкранная карта и
одна кнопка выбора стиля: семь бесплатных подложек с превью и понятными
подписями, выбор запоминается. Свой dev-сервер пакета
(`cd packages/map-basemaps && npm run dev`) отдаёт то же демо по
`http://localhost:<port>/demo/`. Если открыть `demo/index.html` с диска,
страница покажет команду запуска — пустой карты без объяснения не будет.

Пакет собирается с `peerDependencies: { "sweety-map": "^0.2.0" }`; ядро не
бандлится. UMD-глобалы: `SweetyBasemaps` и `SweetyBasemapsLight`. CSS —
`map-basemaps.css`.

## Миграция с других каталогов подложек

Если раньше URL и атрибуция прописывались вручную, замените их на id:

| Было                                            | Стало                                     |
| ----------------------------------------------- | ----------------------------------------- |
| ручной `new TileLayer(osmUrl, { attribution })` | `map.basemaps.set('osm')`                 |
| свой объект `{ url, options }`                  | `basemaps.registerProvider(def)`          |
| ручное переключение слоёв                       | `BasemapsManager.set()` + `basemapchange` |
| ручной ввод ключа в URL                         | `set(id, { key })`, `keys` или env        |
| ручная retina-логика                            | `{r}` + `retina: 'auto'`                  |
| ручной список в UI                              | `BasemapControl({ providers, preview })`  |

Старый код с `TileLayer` продолжает работать: менеджер не перехватывает чужие
слои и не требует их удаления.
