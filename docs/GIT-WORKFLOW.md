# Git-процесс Sweety

Документ фиксирует правила ветвления, коммитов, ревью, релизов и настройку
репозитория. Он же служит чек-листом для воспроизведения истории проекта.

## 1. Инициализация репозитория

```bash
git init -b main
git config core.autocrlf false
git config core.eol lf
git config i18n.commitEncoding utf-8

git config user.name "Ваше имя"
git config user.email "you@example.com"

git add .gitignore .gitattributes .editorconfig LICENSE
git commit -m "chore: инициализировать репозиторий и правила проекта"

git add README.md
git commit -m "docs(readme): добавить обзор и быстрый старт"

git branch develop
git checkout develop
git push -u origin main
git push -u origin develop
```

Первый коммит содержит лицензию и инфраструктурные файлы, второй — README.
`main` остаётся стабильной веткой, `develop` — интеграционной.

Обязательные файлы:

- `.gitignore` — `node_modules/`, `dist/`, `.env`, `coverage/`, `*.log`,
  `.DS_Store`, `.idea/`, `.vscode/`;
- `.gitattributes` — `* text=auto eol=lf` и бинарные типы;
- `.editorconfig` — LF, UTF-8, отступ 2 пробела;
- `LICENSE` (MIT);
- `commitlint.config.js`;
- `.husky/commit-msg`, `.husky/pre-commit`;
- `.github/workflows/ci.yml`;
- `.github/pull_request_template.md`;
- `.github/ISSUE_TEMPLATE/*`.

## 2. Стратегия ветвления

```text
main ─────●──────────────●────────────●──────→ релизы, только PR
           \            /              /
develop ────●──●──●──●──●──●──●──●───●──────→ интеграция
             \    \    \    \
         feat/*  fix/* docs/* refactor/* test/* chore/*
```

| Ветка              | Назначение             | База      | Слияние                                  |
| ------------------ | ---------------------- | --------- | ---------------------------------------- |
| `main`             | Стабильные релизы      | —         | merge-commit из `release/*`/`hotfix/*`   |
| `develop`          | Интеграция             | `main`    | squash-merge из рабочих веток            |
| `feat/<name>`      | Новая функциональность | `develop` | squash в `develop`                       |
| `fix/<name>`       | Исправление            | `develop` | squash в `develop`                       |
| `docs/<name>`      | Документация           | `develop` | squash в `develop`                       |
| `refactor/<name>`  | Рефакторинг            | `develop` | squash в `develop`                       |
| `test/<name>`      | Тесты                  | `develop` | squash в `develop`                       |
| `chore/<name>`     | Сборка, инфраструктура | `develop` | squash в `develop`                       |
| `perf/<name>`      | Производительность     | `develop` | squash в `develop`                       |
| `release/<версия>` | Подготовка релиза      | `develop` | merge-commit в `main`, затем в `develop` |
| `hotfix/<версия>`  | Срочная правка         | `main`    | merge-commit в `main` и `develop`        |

Правила:

- прямые пуши в `main` и `develop` запрещены;
- обязательны PR, зелёный CI и хотя бы одно ревью;
- ветка живёт одну задачу; после merge её удаляют;
- `develop` должен всегда собираться и проходить тесты.

## 3. Conventional Commits

Формат:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

Типы: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`.

Scope: `core`, `layers`, `tiles`, `markers`, `popup`, `vector`, `geojson`,
`controls`, `projection`, `events`, `utils`, `renderer`, `plugins`, `styles`,
`docs`, `demo`, `build`, `ci`, `release`, `deps`.

Примеры:

```text
feat(core): добавить класс Map с панорамированием и зумом
feat(layers): реализовать TileLayer с XYZ-шаблоном и кэшем
feat(layers): добавить Marker с draggable и привязкой попапа
fix(projection): исправить обратную формулу Меркатора у полюсов
perf(tiles): виртуализировать рендеринг и загружать только видимые тайлы
test(core): добавить unit-тесты LatLng и Bounds
docs(readme): добавить быстрый старт и примеры API
chore(build): настроить Vite для UMD-сборки
ci: добавить GitHub Actions для тестов и линтинга
```

Требования:

- заголовок до 100 символов, повелительное наклонение;
- тело объясняет **что** и **почему**, а не **как**;
- одна логическая единица на коммит;
- ссылки на issue: `Refs #12`, `Closes #12`;
- breaking change: `feat!:` и футер `BREAKING CHANGE: ...`;
- не коммитить `dist/`, `node_modules/`, `.env`, IDE-файлы и секреты.

## 4. Пример полного цикла фичи

```bash
git checkout develop
git pull --ff-only
git checkout -b feat/tile-layer

# разработка
git add src/layers/TileLayer.js tests/tilelayer.test.js
git commit -m "feat(layers): реализовать TileLayer с XYZ-шаблоном и кэшем" \
  -m "Поддержаны субдомены, TMS, retina, повторные попытки и LRU-кэш изображений."

git add src/layers/TileLayer.js tests/tilelayer.test.js
git commit -m "feat(layers): виртуализировать видимые тайлы" \
  -m "В DOM остаются только тайлы вьюпорта и keepBuffer; остальные выгружаются."

git push -u origin feat/tile-layer
gh pr create --base develop --head feat/tile-layer \
  --title "feat(layers): TileLayer с кэшем и виртуализацией" \
  --body-file .github/pull_request_template.md

# после review и зелёного CI — squash-merge
gh pr merge --squash --delete-branch

git checkout develop
git pull --ff-only
```

Проверки перед PR:

```bash
git status
git diff --check
git diff develop...HEAD
npm run lint
npm run test
npm run build
```

## 5. Merge strategy

- Рабочие ветки → `develop`: **squash-merge**, чтобы история была атомарной.
- `release/*` → `main`: **merge-commit**, чтобы сохранить точку релиза.
- `hotfix/*` → `main`: merge-commit, затем merge в `develop`.
- Force-push в общие ветки запрещён; ребейз допустим только в личной ветке.

## 6. Hooks: husky, lint-staged, commitlint

Установка:

```bash
npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
npm pkg set scripts.prepare="husky"
npx husky init
```

`.husky/pre-commit`:

```sh
npx --no-install lint-staged
```

`.husky/commit-msg`:

```sh
npx --no-install commitlint --edit "$1"
```

`package.json`:

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml,css,html}": ["prettier --write"]
  }
}
```

Проверка вручную:

```bash
echo "feat(core): добавить карту" | npx commitlint
echo "bad message" | npx commitlint
```

## 7. CI

`.github/workflows/ci.yml` запускается на pull request и push в `main`/`develop`:

1. checkout;
2. Node.js 22 с кэшем npm;
3. `npm ci`;
4. `npm run lint`;
5. `npm run format:check`;
6. `npm run test:coverage`;
7. `npm run build`;
8. проверка UMD-бандла;
9. загрузка `dist/` как artifact.

Защита веток в GitHub:

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f required_status_checks.strict=true \
  -f enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=null

gh api -X PUT repos/:owner/:repo/branches/develop/protection \
  -f required_status_checks.strict=true \
  -f enforce_admins=true \
  -f required_pull_request_reviews.required_approving_review_count=1 \
  -f restrictions=null
```

Или через Settings → Branches → Add branch protection rule.

## 8. PR и issue templates

`.github/pull_request_template.md` содержит:

- описание и ссылку на issue;
- список изменений;
- скриншот/видео демо для UI-изменений;
- чек-лист: тесты, линтер, документация, CHANGELOG;
- отметку о breaking changes.

`.github/ISSUE_TEMPLATE/bug_report.yml` и `feature_request.yml` собирают
воспроизведение, ожидаемое поведение, версию и окружение.

## 9. Релизы и теги

Семантическое версионирование: `vMAJOR.MINOR.PATCH`.

```bash
git checkout develop
git checkout -b release/0.1.0
npm run release -- --release-as minor   # commit-and-tag-version
# проверить CHANGELOG.md и package.json
npm run lint && npm run test && npm run build
git add CHANGELOG.md package.json package-lock.json
git commit -m "chore(release): подготовить v0.1.0"
git checkout main
git merge --no-ff release/0.1.0
git tag -a v0.1.0 -m "Sweety v0.1.0"
git push origin main
git push origin v0.1.0
git checkout develop
git merge --no-ff release/0.1.0
git push origin develop
git branch -d release/0.1.0
```

Hotfix:

```bash
git checkout main
git checkout -b hotfix/0.1.1
# исправление + тест
git commit -m "fix(core): исправить ..."
git checkout main
git merge --no-ff hotfix/0.1.1
git tag -a v0.1.1 -m "Sweety v0.1.1"
git push origin main --tags
git checkout develop
git merge --no-ff hotfix/0.1.1
git push origin develop
git branch -d hotfix/0.1.1
```

CHANGELOG генерируется из Conventional Commits:

```bash
npm run release -- --dry-run
npm run release
```

## 10. Последовательность коммитов проекта

Ниже — логические шаги, по которым собирался репозиторий. Порядок важен: каждый
шаг оставляет проект собираемым.

1. `chore: инициализировать репозиторий и правила проекта`
2. `docs(readme): добавить обзор и быстрый старт`
3. `chore(build): настроить package.json, Vite, ESLint и Prettier`
4. `feat(core): добавить LatLng, Point и Bounds с тестами`
5. `feat(core): добавить Evented с once и всплытием событий`
6. `feat(projection): добавить EPSG:3857 и EPSG:4326 с тестами`
7. `feat(core): добавить Map, панели и setView`
8. `feat(core): реализовать drag-панорамирование с инерцией`
9. `feat(core): реализовать wheel, dblclick и pinch-зум с анимацией`
10. `feat(layers): добавить Layer, LayerGroup и FeatureGroup`
11. `feat(layers): реализовать TileLayer с XYZ-шаблоном и кэшем`
12. `feat(layers): добавить виртуализацию видимых тайлов`
13. `feat(layers): добавить Marker с draggable и иконками`
14. `feat(layers): добавить Popup и Tooltip с позиционированием`
15. `feat(layers): реализовать Polyline, Polygon, Circle и Rectangle (SVG)`
16. `feat(layers): добавить Canvas-рендерер для множества векторов`
17. `feat(layers): реализовать GeoJSONLayer со style-функцией`
18. `feat(controls): добавить Zoom, Attribution и Scale`
19. `feat(controls): добавить LayersControl`
20. `feat(core): добавить fitBounds, flyTo, panTo и ограничения`
21. `feat(plugins): добавить реестр расширений`
22. `perf(events): объединять события и обновлять тайлы в простое`
23. `test: повысить покрытие утилит, проекций и GeoJSON`
24. `docs: перевести JSDoc и README на русский`
25. `docs(demo): добавить examples/index.html с OSM, маркерами и полигоном`
26. `chore(build): настроить ESM/UMD, минификацию и копию UMD`
27. `ci: добавить GitHub Actions для lint, test и build`
28. `chore(release): v0.1.0 — changelog и тег`

## 11. Проверка перед релизом

```bash
git status
npm ci
npm run lint
npm run format:check
npm run test:coverage
npm run build
node -e "const s=require('./dist/sweety.umd.cjs'); if(!s.Map) process.exit(1)"
git tag --list
git log --oneline --decorate -20
```

Релиз считается готовым, если:

- CI зелёный на `main`;
- тег указывает на merge-коммит релиза;
- `CHANGELOG.md` содержит дату и версию;
- `dist/` не закоммичен, но артефакт CI доступен;
- README и API соответствуют фактическому поведению.
