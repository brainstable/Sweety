# Бренд Sweety

Пакет айдентики для библиотеки интерактивных карт **Sweety** и её плагинов
(`map-edit-plugin`, `map-basemaps`). Все файлы лежат в [`assets/brand/`](../assets/brand/),
пересборка ассетов — `python assets/brand/build.py` (нужны fontTools, uharfbuzz,
Pillow и локальный Chrome; на CI не запускается).

## 1. Бриф

**Позиционирование.** Sweety — инженерный инструмент: модульная JavaScript-библиотека
интерактивных карт без runtime-зависимостей, с плагинами для редактирования геометрии
и каталога подложек. Логотип должен за одну секунду сообщать три вещи: «это про карты»,
«это про редактирование объектов» и «это лёгкий, аккуратный инструмент, а не игрушка».

**Аудитория.** Фронтенд- и fullstack-разработчики, GIS-инженеры, продуктовые команды,
которые выбирают карту для внутреннего сервиса и читают README и демо прежде, чем
первую строку кода. Они ценят предсказуемость, маленький вес, чистый API и отсутствие
скрытых зависимостей.

**Характер.** Дружелюбный, но технический: геометрия, сетка, маршрут, вершины полигона.
Тон — «сделано инженером, который уважает чужое время». Никакой мультяшности,
никаких изометрических карт мира, никакого 3D-объёма и пластиковых градиентов.
Название Sweety даёт тепло — его несёт акцентный оранжевый, а не форма.

## 2. Концепции знака

### A. Пин с вершиной полигона

Маркер-капля, внутри — квадрат редактируемой вершины с тремя handle-точками. Читается
как «место + редактирование», хорошо масштабируется, но пин — самый заезженный символ
карт: знак теряется среди конкурентов и плохо работает в маленьком размере, где капля
превращается в кляксу.

### B. Сетка тайлов 2×2 с приподнятым тайлом

Четыре скруглённых квадрата, один выдвинут и обведён handle-уголками, рядом курсор.
Прямо говорит «тайлы + правка», но композиция из пяти элементов разваливается в
32×32 и выглядит как иконка приложения-утилиты, а не как логотип библиотеки.

### C. Монограмма S — маршрут с вершинами (выбрана)

Буква **S** нарисована как маршрут: толстая линия с плавными изгибами, на концах —
два оранжевых квадратных handle. Форма S = Sweety, линия = маршрут/слой, квадраты =
вершины полигона в редакторе. Всё это живёт в скруглённом квадрате — контейнере
«плитка карты / иконка приложения».

Почему C: один силуэт вместо пяти, читается в 16×16, одинаково хорошо смотрится
в цвете, в одном цвете и в фавиконке, и объединяет обе сущности проекта (карта +
редактирование). S — ещё и первая буква слова, так что знак и логотип рифмуются.

## 3. Палитра

| Роль                     | HEX       | Где используется                                     |
| ------------------------ | --------- | ---------------------------------------------------- |
| Blue 500 (primary)       | `#0EA5E9` | верхняя точка градиента плитки, ссылки, акценты в UI |
| Blue 700 (primary dark)  | `#0369A1` | нижняя точка градиента, hover, обводки               |
| Blue 900 (ink / surface) | `#0B1220` | тёмный фон, монохромный знак, social preview         |
| Ink                      | `#0F172A` | основной текст, логотип на светлом                   |
| Slate                    | `#64748B` | вторичный текст, подписи, tagline                    |
| Orange 500 (accent)      | `#F97316` | handle-вершины — только акцент, не текст             |
| Paper                    | `#FFFFFF` | фон, выворотка в монохроме                           |
| Surface                  | `#F6F8FC` | светлый фон страниц и README                         |

Правило **60 / 30 / 10**:

- **60 %** — нейтральный фон: `#FFFFFF` / `#F6F8FC` на светлом, `#0B1220` на тёмном.
  Бренд не должен «кричать» синим на весь экран.
- **30 %** — картографический синий: градиент знака `#0EA5E9 → #0369A1`, заголовки,
  ссылки, кнопки с действиями.
- **10 %** — акцент `#F97316`: только вершины/handle, cursor-точки, критичные CTA.
  Больше 10 % — и знак перестаёт читаться как «спокойный инженерный».

Контраст: `#0F172A` на белом — 17.4:1, `#64748B` на белом — 4.7:1, `#FFFFFF` на `#0369A1` — 5.4:1,
`#F97316` на белом — 2.9:1 (поэтому оранжевый никогда не используется для текста).

## 4. Типографика

Оба варианта — свободные лицензии (OFL), без коммерческих ограничений.

**Пара 1 — основная: Inter (знак + текст).** Геометрическая основа, огромная
x-height, отличная читаемость на экране и в интерфейсах. Wordmark: SemiBold (600),
начертание заголовков — SemiBold/Bold, текста — Regular (400), подписи — Medium (500).
Трекинг: `-0.01em` для заголовков, `0` для текста, `+0.02em` для капслочных подписей.

**Пара 2 — альтернатива: Manrope (текст) + Space Grotesk (акцентные заголовки).**
Manrope мягче и «дружелюбнее» Inter, Space Grotesk даёт технический характер в крупных
заголовках. Годится, если бренд будут использовать в маркетинговых материалах.

В SVG-логотипе текст **переведён в кривые** (Inter SemiBold, 600) — файл не зависит
от установленных шрифтов. Для нового текста в фирменных макетах: Inter 600,
трекинг `-0.01em`, слово «Sweety» всегда с заглавной S.

## 5. Промты для генераторов изображений

### Midjourney v6 (1:1 и 3:1)

```
flat vector logo for a JavaScript map library, rounded square app icon, white letter S drawn as a smooth route line with two small orange square vertex handles at its ends, blue gradient #0EA5E9 to #0369A1 background, minimal geometric shapes, thick uniform stroke, generous padding, no text, no globe, no shadows, no 3D, crisp edges, centered composition, flat design, vector illustration --style raw --v 6 --ar 1:1 --no text, letters beyond the S, globe, 3d, gradient mesh, shadow, realistic
```

```
flat vector horizontal logotype, rounded square map icon with white S route and orange vertex handles on the left, bold geometric sans-serif wordmark "Sweety" in deep navy on the right, lots of negative space, clean baseline, flat colors, minimal, engineering dev-tool style, no additional lettering, no icons besides the mark --style raw --v 6 --ar 3:1 --no 3d, shadow, gradient mesh, texture, clutter
```

### DALL·E 3 / Ideogram (текстовый промт)

```
Design a flat vector logo for "Sweety", a developer library for interactive web maps with geometry editing.
Composition: a rounded square icon on the left (blue gradient from #0EA5E9 to #0369A1) containing a white
letter S drawn as a smooth thick route line; at the two ends of the line, small square vertex handles in
orange #F97316. At the icon's right, the wordmark "Sweety" in a bold geometric sans-serif (Inter SemiBold
weight), color #0F172A, normal letter spacing, capital S only. Style: minimal, clean lines, flat vector,
precise geometry, generous white space, no gradients on the text, no shadows, no 3D, no globe, no map of
the world, no extra decorations. Aspect ratio 3:1, transparent or plain white background, high resolution.
```

### SDXL / Flux

**Positive:**

```
flat vector logo, rounded square app icon, white S letter as a smooth route line, two orange square vertex
handles, blue gradient #0EA5E9 to #0369A1, geometric sans-serif wordmark "Sweety", navy #0F172A text,
minimal dev-tool branding, clean thick strokes, flat colors, centered, high contrast, crisp vector edges,
white background, professional, no text artifacts
```

**Negative:**

```
3d, bevel, emboss, drop shadow, inner shadow, glossy, plastic, metallic, neon, gradient mesh, noise,
texture, photo, realistic, globe, world map, compass, pin cluster, cartoon, mascot, childlike, sketch,
handwritten, cluttered, too many details, watermark, signature, text artifacts, gibberish letters,
rainbow colors, low contrast, pixelated, jpeg artifacts
```

## 6. Правила использования

**Минимальные размеры.** Знак без текста — 16×16 px (favicon), уверенно — от 24 px.
Горизонтальный логотип — от 120 px по ширине; ниже этого используйте только знак.

**Охранное поле.** Не меньше высоты квадратного handle (≈ 1/8 высоты знака) со всех
сторон. В SVG-логотипе поле уже заложено: viewBox шире контента на 3 единицы с каждой
стороны.

**Недопустимо:**

- менять пропорции, наклонять, обводить, добавлять тени и обводки;
- перекрашивать handle в синий, а S — в оранжевый;
- ставить цветной знак на пёструю фотографию (используйте монохром или плашку);
- набирать «Sweety» другим шрифтом, капсом, с разрядкой или в две строки внутри знака;
- добавлять декоративные элементы: глобус, компас, «лупу», изометрию, рамки;
- использовать градиент в тексте.

**Фон.** Цветная версия — на белом, `#F6F8FC` и `#0B1220`. На тёмном фоне берётся
`sweety-logo-dark.svg` (белый текст) или монохромная белая версия. На цветных плашках —
только монохром.

## 7. Файлы

| Файл                                                              | Назначение                                       |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| `sweety-mark.svg`                                                 | цветной знак 64×64, app icon                     |
| `sweety-mark-mono.svg`                                            | монохром (чернильный `#0B1220`) на прозрачном    |
| `sweety-mark-mono-light.svg`                                      | монохром белый для тёмных фонов                  |
| `sweety-logo.svg`                                                 | горизонтальный логотип, тёмный текст             |
| `sweety-logo-dark.svg`                                            | горизонтальный логотип для тёмного фона          |
| `sweety-logo-mono.svg`                                            | горизонтальный монохром, один цвет               |
| `sweety-logo-mono-light.svg`                                      | горизонтальный монохром белый                    |
| `favicon.svg`, `favicon.ico`, `favicon-16.png`, `favicon-32.png`  | иконки вкладки                                   |
| `sweety-mark-512/256/128/64/32.png`                               | растровые экспорты знака                         |
| `sweety-logo.png`, `sweety-logo-dark.png`, `sweety-logo-mono.png` | растровые логотипы (3×)                          |
| `social-preview.png`                                              | 1280×640 для GitHub Social preview и OG-картинок |
| `sweety-social.svg`                                               | исходник social preview                          |
| `build.py`                                                        | генератор всех файлов из SVG-шаблонов и Inter    |

## 8. SVG-скелет знака

Упрощённая разметка выбранного варианта — можно править в любом редакторе.
`viewBox="0 0 64 64"`, плитка `rx="15"`, линия `stroke-width="7"`, handle — 8×8, `rx="2"`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"
     role="img" aria-label="Sweety">
  <defs>
    <linearGradient id="sweety-tile" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0EA5E9"/>
      <stop offset="1" stop-color="#0369A1"/>
    </linearGradient>
  </defs>

  <!-- плитка -->
  <rect width="64" height="64" rx="15" fill="url(#sweety-tile)"/>

  <!-- маршрут-буква S -->
  <path d="M44 22C44 12 20 12 20 22C20 32 44 32 44 42C44 52 20 52 20 42"
        fill="none" stroke="#FFFFFF" stroke-width="7"
        stroke-linecap="round" stroke-linejoin="round"/>

  <!-- вершины полигона (handle) -->
  <g fill="#F97316">
    <rect x="40" y="18" width="8" height="8" rx="2"/>
    <rect x="16" y="38" width="8" height="8" rx="2"/>
  </g>
</svg>
```

Монохром: убрать `rect`-плитку, у `path` и handle поставить текущий цвет, handle
уменьшить до 7×7 — тогда квадраты не выступают за линию и знак остаётся силуэтом S.

## 9. Внедрение в репозиторий

- [x] `assets/brand/` — все SVG/PNG, включая `favicon.svg`, `favicon.ico`,
      `social-preview.png`.
- [x] `README.md` — логотип по центру над заголовком:
      `<img src="assets/brand/sweety-logo.svg" alt="Sweety — модульная JavaScript-библиотека интерактивных карт" width="360">`
- [x] `scripts/docs-preview.mjs` — знак в сайдбаре (`/assets/brand/sweety-mark.svg`)
      и `link rel="icon"` на `favicon.svg` / `favicon.ico`.
- [x] `examples/index.html` — favicon демо-страницы.
- [ ] GitHub → Settings → Social preview: загрузить `assets/brand/social-preview.png`
      (1280×640), если нужно обновить превью репозитория.
- [ ] GitHub → About: описание, ссылки и topics (см. подсказки в issue/PR, если нужно).

**Alt-текст.** Для знака — `Sweety`; для горизонтального логотипа —
`Sweety — модульная JavaScript-библиотека интерактивных карт`; для social preview —
`Sweety: интерактивные карты без зависимостей`.

**Лицензии.** Inter и Manrope — SIL Open Font License 1.1; в репозиторий шрифты не
кладутся, wordmark переведён в кривые. Иконка и логотип распространяются по MIT
вместе с проектом.
