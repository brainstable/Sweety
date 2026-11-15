import { fileURLToPath } from 'node:url';

// Пакеты в packages/ импортируют ядро как `sweety-map`, а demo-страницы лежат
// рядом со своими исходниками. И dev-сервер, и сборка сайта должны резолвить
// эти имена в src/, а не в собранный dist/ — иначе демо пришлось бы
// пересобирать перед каждым запуском.
//
// Точные регулярки: подпути вроде `sweety-map/style.css` не переписываются.
export const packagesAlias = [
  {
    find: /^sweety-map$/,
    replacement: fileURLToPath(new URL('../src/index.js', import.meta.url)),
  },
  {
    find: /^sweety-map-edit-plugin$/,
    replacement: fileURLToPath(
      new URL('../packages/map-edit-plugin/src/index.js', import.meta.url),
    ),
  },
  {
    find: /^sweety-map-basemaps$/,
    replacement: fileURLToPath(new URL('../packages/map-basemaps/src/index.js', import.meta.url)),
  },
];
