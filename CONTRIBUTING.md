# Как внести вклад

## Процесс

1. Форкните репозиторий или создайте ветку от `develop`.
2. Назовите ветку по шаблону: `feat/<тема>`, `fix/<тема>`, `docs/<тема>`,
   `refactor/<тема>`, `test/<тема>`, `chore/<тема>`.
3. Делайте атомарные коммиты в формате Conventional Commits.
4. Перед push выполните `npm run lint && npm run test && npm run build`.
5. Откройте PR в `develop`, заполните шаблон и приложите скриншот для UI.

## Локальная настройка

```bash
npm ci
npm run prepare
npm run dev
```

Husky проверяет сообщение коммита через commitlint, а lint-staged запускает
ESLint и Prettier для изменённых файлов.

## Стиль кода

- ES-модули, без runtime-зависимостей.
- Публичные методы и классы документируются JSDoc.
- Комментарии и пользовательская документация — на русском языке.
- Идентификаторы, имена API и типы Conventional Commits — на английском.
- Новое поведение покрывается unit- или integration-тестом.

## Тесты

```bash
npm run test
npm run test:coverage
```

Тесты находятся в `tests/` и используют Vitest + jsdom. Для Canvas используется
записывающий 2D-контекст, для `ResizeObserver` — мок.

## Документация

- `README.md` — быстрый старт и обзор.
- `docs/API.md` — справочник.
- `docs/ARCHITECTURE.md` — устройство и расширение.
- `docs/GIT-WORKFLOW.md` — ветки, коммиты, релизы.

## Лицензия

Отправляя PR, вы соглашаетесь с условиями MIT License.
