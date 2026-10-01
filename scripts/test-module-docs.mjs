/**
 * Тест генератора блоков generated (scripts/gen/module-docs.mjs, PLAN.md Ф1.7).
 *
 * Зачем. Блок в CLAUDE.md модуля обещает «файлы, адреса, база, кто
 * использует» — и сверка в `npm run check` краснеет, если он отстал от кода.
 * Ошибись генератор — сверка либо краснеет на исправном коде (и её начнут
 * обходить), либо молча пишет неправду. Здесь — правила на выдуманном модуле
 * и разбор настоящей таблицы маршрутов (её формат меняется руками).
 *
 * Запуск: node scripts/test-module-docs.mjs (в CI — сам, по шаблону test-*.mjs)
 */
import { problems, renderBlock, routeFiles, withBlock } from './gen/module-docs.mjs'

let pass = 0
let fail = 0
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) pass++
  else {
    fail++
    console.log(`✖ ${name}\n    ждали:    ${JSON.stringify(want)}\n    получили: ${JSON.stringify(got)}`)
  }
}

// ── выдуманный модуль «домашка»: свой экран + модуль из lib/ по указателю
const HW = 'src/features/homework/CLAUDE.md'
const owners = {
  'src/features/homework/StudentHomework.tsx': HW,
  'src/lib/homework.ts': HW, // указатель «Описание:»
  'src/lib/cards.ts': 'src/lib/CLAUDE.md',
  'src/features/teacher/HomeworkSection.tsx': 'src/features/teacher/CLAUDE.md',
  'src/features/grammar/GrammarPage.tsx': 'CLAUDE.md', // раздел без описания
  'api/gemini.ts': 'api/CLAUDE.md',
}
const empty = { imports: [], tables: [], rpcs: [], aiTasks: [], storageKeys: [] }
const ctx = {
  docs: new Set(['CLAUDE.md', HW, 'src/lib/CLAUDE.md', 'src/features/teacher/CLAUDE.md', 'api/CLAUDE.md']),
  listed: Object.keys(owners),
  pointers: new Map([['src/lib/homework.ts', HW]]),
  owner: (f) => owners[f],
  facts: {
    'src/features/homework/StudentHomework.tsx': { ...empty, imports: ['src/lib/homework.ts', 'src/lib/cards.ts'], storageKeys: ['recall.hw'] },
    'src/lib/homework.ts': { ...empty, tables: ['homework_items', 'homework'], rpcs: ['get_homework'], aiTasks: ['homework'] },
    'src/lib/cards.ts': { ...empty, tables: ['cards'] },
    'src/features/teacher/HomeworkSection.tsx': { ...empty, imports: ['src/lib/homework.ts'] },
    'src/features/grammar/GrammarPage.tsx': { ...empty, imports: ['src/features/homework/StudentHomework.tsx'] },
    'api/gemini.ts': { ...empty },
  },
  routes: new Map([['/assignments', 'src/features/homework/StudentHomework.tsx'], ['/grammar', 'src/features/grammar/GrammarPage.tsx']]),
}
const block = renderBlock(HW, ctx)
const line = (name) => block.split('\n').find((l) => l.startsWith(`- **${name}`)) ?? null
check('файлы своей папки — от папки описания', line('Файлы'), '- **Файлы:** `StudentHomework.tsx`')
check('файл по указателю — отдельной строкой, полным путём', line('Вне папки'), '- **Вне папки (указатель «Описание:» в начале файла):** `src/lib/homework.ts`')
check('адреса — только своих экранов', line('Адреса:'), '- **Адреса:** `/assignments`')
check('база — по всем своим файлам, по алфавиту, без чужих', [line('Таблицы'), line('RPC')], ['- **Таблицы:** `homework`, `homework_items`', '- **RPC:** `get_homework`'])
check('AI-задачи и localStorage', [line('AI-задачи'), line('localStorage')], ['- **AI-задачи:** `homework`', '- **localStorage:** `recall.hw`'])
check('кто использует: модуль описания, а для раздела без описания — группа карты', line('Кто использует'), '- **Кто использует (импортом):** `features/grammar`, `features/teacher`')
check('блок в метках', [block.startsWith('<!-- generated:start -->'), block.endsWith('<!-- generated:end -->')], [true, true])
check('адреса сервера — только у api/', [line('Адреса сервера'), renderBlock('api/CLAUDE.md', ctx).includes('- **Адреса сервера:** `/api/gemini`')], [null, true])
check('модуль без пользователей — «никто»', renderBlock('api/CLAUDE.md', ctx).includes('- **Кто использует (импортом):** никто'), true)
{
  const lib = renderBlock('src/lib/CLAUDE.md', ctx).split('\n')
  check('папка видит, чьи её файлы по указателю', lib.find((l) => l.startsWith('- **Описаны в другом')),
    '- **Описаны в другом модуле (указатель «Описание:»):** `homework.ts → features/homework`')
  check('свой файл папки — в «Файлах»', lib.find((l) => l.startsWith('- **Файлы')), '- **Файлы:** `cards.ts`')
}

// ── вставка блока: на место старого или в конец; переводы строк — как в файле
{
  const B = '<!-- generated:start -->\nновый\n<!-- generated:end -->'
  check('withBlock: замена на месте', withBlock('# x\n\nтекст\n\n<!-- generated:start -->\nстарый\n<!-- generated:end -->\n', B), `# x\n\nтекст\n\n${B}\n`)
  check('withBlock: блока не было — в конец', withBlock('# x\n\nтекст\n', B), `# x\n\nтекст\n\n${B}\n`)
  check('withBlock: CRLF остаётся CRLF', withBlock('# x\r\n\r\nтекст\r\n', B), `# x\r\n\r\nтекст\r\n\r\n${B.replace(/\n/g, '\r\n')}\r\n`)
  check('withBlock: «$&» в блоке не портит замену', withBlock('<!-- generated:start -->\n<!-- generated:end -->', '<!-- generated:start -->$&<!-- generated:end -->'), '<!-- generated:start -->$&<!-- generated:end -->')
}

// ── сверка: что краснеет
{
  const fresh = (doc) => `# m\n\n${renderBlock(doc, ctx)}\n`
  const texts = {
    [HW]: fresh(HW),
    'src/lib/CLAUDE.md': fresh('src/lib/CLAUDE.md'),
    'src/features/teacher/CLAUDE.md': fresh('src/features/teacher/CLAUDE.md'),
    'api/CLAUDE.md': fresh('api/CLAUDE.md'),
  }
  const run = (over = {}, c = ctx) => problems(c, (d) => ({ ...texts, ...over })[d])
  check('сверка: всё свежее — пусто', run(), [])
  check('сверка: блок отстал от кода — красный', run({ [HW]: texts[HW].replace('`/assignments`', '`/old`') }), [`${HW}: блок generated устарел`])
  check('сверка: CRLF в файле — не устаревание', run({ [HW]: texts[HW].replace(/\n/g, '\r\n') }), [])
  check('сверка: у описания с кодом нет блока — красный', run({ 'api/CLAUDE.md': '# api\n' }), ['api/CLAUDE.md: нет блока generated, а код у модуля есть'])
  check('сверка: сломанные метки — красный', run({ 'api/CLAUDE.md': '# api\n<!-- generated:start -->\n' }), ['api/CLAUDE.md: метки generated сломаны (start 1, end 0)'])
  // указатель в никуда: файл достаётся ближайшему описанию — блоки тех, кого
  // это задело, тоже честно устаревают; главное — названа сама причина
  check('сверка: указатель в никуда — красный',
    run({}, { ...ctx, pointers: new Map([['src/lib/homework.ts', 'src/features/gone/CLAUDE.md']]) })
      .includes('src/lib/homework.ts: указатель «Описание: src/features/gone/CLAUDE.md» — такого описания нет'), true)
}

// ── настоящая таблица маршрутов: ленивые экраны, прямые и витрина
{
  const routes = routeFiles()
  check('маршруты: ленивый экран', routes.get('/teacher'), 'src/features/teacher/TeacherPage.tsx')
  check('маршруты: экран в стартовом бандле', [routes.get('/login'), routes.get('/')], ['src/features/auth/LoginPage.tsx', 'src/features/dashboard/DashboardPage.tsx'])
  check('маршруты: витрина только в разработке — тоже экран', routes.get('/dev/ui'), 'src/features/dev/UiShowcase.tsx')
  check('маршруты: переадресация — не экран', routes.has('/flashcards'), false)
  check('маршруты: двухстрочная запись реестра', routes.get('/self-material'), 'src/features/study/SelfMaterialPage.tsx')
}

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
