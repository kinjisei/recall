// Правила границ кода — архитектура §2 (docs/architecture/README.md).
// Запускает scripts/checks/boundaries.mjs; старые нарушения — в
// scripts/checks/baseline/boundaries.json («к исправлению»).
//
// Правила написаны сразу под ЦЕЛЕВЫЕ слои (app, shared, domains, content) —
// пока этих папок нет, правила молчат и включаются сами, как только в папке
// появится первый файл. Для СТАРЫХ слоёв (lib, components, context) действуют
// только их аналоги: экран не лезет в базу, UI не импортирует экраны.
//
// ⚠️ Переходный период: новые слои могут импортировать старые (lib, components),
// иначе первый же новый домен не собрать. Обратное — нельзя.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'feature-deep-import',
      comment:
        'Раздел импортирует внутренности чужого раздела. Можно только парадную дверь: features/<раздел>/index.ts (§2).',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.tsx?$'],
      },
    },
    {
      name: 'domain-deep-import',
      comment: 'Импорт внутренностей домена. Можно только domains/<имя>/index.ts (§2).',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/domains/([^/]+)/' },
      to: { path: '^src/domains/[^/]+/', pathNot: '^src/domains/[^/]+/index\\.tsx?$' },
    },
    {
      name: 'domain-deep-import-between-domains',
      comment: 'Домен импортирует внутренности другого домена. Можно только domains/<имя>/index.ts (§2).',
      severity: 'error',
      from: { path: '^src/domains/([^/]+)/' },
      to: {
        path: '^src/domains/[^/]+/',
        pathNot: ['^src/domains/$1/', '^src/domains/[^/]+/index\\.tsx?$'],
      },
    },
    {
      name: 'domain-no-screens',
      comment: 'Домен — логика без экранов: ему нельзя импортировать app/ и features/ (§1, §2).',
      severity: 'error',
      from: { path: '^src/domains/' },
      to: { path: '^src/(app|features)/' },
    },
    {
      name: 'shared-only-shared',
      comment: 'shared/ — нижний слой: импортирует только shared/ и пакеты (§2).',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/', pathNot: '^src/shared/' },
    },
    {
      name: 'only-app-imports-app',
      comment:
        'Каркас app/ импортирует всех, его — никто (§2). lib/routeChunks.ts — реестр ленивых экранов ' +
        'роутера, то есть уже сейчас часть каркаса (переедет в app/, PLAN.md Ф1.3).',
      severity: 'error',
      from: { path: '^src/', pathNot: ['^src/app/', '^src/main\\.tsx$', '^src/App\\.tsx$'] },
      to: { path: ['^src/app/', '^src/lib/routeChunks\\.ts$'] },
    },
    {
      name: 'content-imports-nothing',
      comment: 'content/ — статические данные, ничего не импортирует (§2).',
      severity: 'error',
      from: { path: '^src/content/' },
      to: { path: '^src/', pathNot: '^src/content/' },
    },
    {
      name: 'content-only-via-language',
      comment: 'content/ читают только загрузчики domains/language (§2, §6).',
      severity: 'error',
      from: { path: '^src/', pathNot: ['^src/content/', '^src/domains/language/'] },
      to: { path: '^src/content/' },
    },
    {
      name: 'db-outside-data-layer',
      comment:
        'Клиент базы импортируется только в слое данных: domains/*/api.ts, domains/profile, shared/api ' +
        '(и, до переезда, старые lib/ и context/). Экран в базу не ходит (§2, §4).',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [
          '^src/domains/[^/]+/api\\.ts$',
          '^src/domains/profile/',
          '^src/shared/api/',
          // старые слои данных — переезжают в domains/ (PLAN.md Ф3)
          '^src/lib/',
          '^src/context/',
        ],
      },
      to: { path: ['(^|/)node_modules/@supabase/', '^src/lib/supabase\\.ts$', '^src/shared/api/supabase'] },
    },
    {
      name: 'common-imports-feature',
      comment:
        'Общий код (lib/, components/, context/, types/) импортирует раздел из features/. ' +
        'Зависимость идёт от раздела к общему, не наоборот.',
      severity: 'error',
      // реестр ленивых экранов — часть каркаса, ему экраны импортировать положено
      from: { path: '^src/(lib|components|context|types)/', pathNot: '^src/lib/routeChunks\\.ts$' },
      to: { path: '^src/features/' },
    },
    {
      name: 'no-circular',
      comment:
        'Циклический импорт (§2: «без циклов»). Ленивые импорты (import()) цикла не образуют: ' +
        'модуль грузится позже, порядок инициализации не ломается.',
      severity: 'error',
      from: { path: '^src/' },
      to: { circular: true, viaOnly: { dependencyTypesNot: ['dynamic-import'] } },
    },
  ],
  options: {
    // пакет базы оставлен в графе, чтобы правило db-outside-data-layer его видело
    includeOnly: '^(src/|node_modules/@supabase/)',
    doNotFollow: { path: 'node_modules' },
    // импорт одних типов — тоже зависимость: связывает разделы так же
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
}
