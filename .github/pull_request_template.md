# Pull request

## Описание

<!-- Что изменено и зачем. Ссылка на issue: Closes #123 -->

## Тип изменения

- [ ] Новая функциональность (`feat`)
- [ ] Исправление (`fix`)
- [ ] Документация (`docs`)
- [ ] Рефакторинг (`refactor`)
- [ ] Производительность (`perf`)
- [ ] Тесты (`test`)
- [ ] Сборка/CI (`build`, `ci`, `chore`)
- [ ] Breaking change

## Как проверить

<!-- Шаги воспроизведения, команды, тестовые данные -->

```bash
npm ci
npm run lint
npm run test
npm run build
```

## Скриншот или видео

<!-- Для изменений UI приложите скриншот демо /examples/ или GIF. -->

## Чек-лист

- [ ] Тесты добавлены или обновлены
- [ ] `npm run lint` проходит
- [ ] `npm run format:check` проходит
- [ ] `npm run test` проходит
- [ ] `npm run build` и `npm run verify:build` проходят
- [ ] Документация/JSDoc обновлены
- [ ] `CHANGELOG.md` будет обновлён при релизе
- [ ] Нет секретов, `dist/`, `node_modules/` и IDE-файлов в diff
- [ ] Для breaking change указан `BREAKING CHANGE:` в описании
