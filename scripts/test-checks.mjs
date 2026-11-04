/**
 * Тест самих сторожей (scripts/checks/*): логика без git, базы и сети.
 *
 * Зачем. Сторож, который ошибается, хуже отсутствующего: ложно-красный
 * блокирует все коммиты, ложно-зелёный молча пропускает. Две ошибки нашлись
 * ещё до выпуска — обе на переводах строк CRLF, которые git выдаёт на Windows:
 * сторож токенов считал нарушением `[Npx]` из комментария, а сторож описаний
 * не видел причину, перенесённую на вторую строку сообщения. На Linux (CI)
 * обе не видны — поэтому здесь каждый случай прогоняется и с LF, и с CRLF.
 *
 * Запуск: node scripts/test-checks.mjs (в CI — сам, по шаблону test-*.mjs)
 */
import { compare, plural, pruned } from './checks/_baseline.mjs'
import { docFor, hasReason, isCode, pointerIn, touchedByHand, verdict } from './checks/docs.mjs'
import { createHash } from 'node:crypto'
import { parsePlan, problems } from './checks/plan.mjs'
import { fileProblems, findSecrets, looksRandom, pathProblem } from './checks/secrets.mjs'
import { componentsIn } from './checks/size.mjs'
import { countIn } from './checks/tokens.mjs'

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
const crlf = (s) => s.replace(/\n/g, '\r\n')
const both = (name, text, fn, want) => {
  check(`${name} (LF)`, fn(text), want)
  check(`${name} (CRLF)`, fn(crlf(text)), want)
}

// ── числительные: «24 записей» выглядит почти правильно и живёт годами
check('plural', [1, 2, 5, 11, 12, 21, 22, 25, 111, 112].map((n) => plural(n, 'запись', 'записи', 'записей')), [
  '1 запись', '2 записи', '5 записей', '11 записей', '12 записей', '21 запись', '22 записи', '25 записей', '111 записей', '112 записей',
])

// ── список «к исправлению»: новое и выросшее — added, исправленное — stale
{
  const base = { a: 3, b: 1 }
  check('compare: без изменений', compare(base, { a: 3, b: 1 }), { added: [], stale: [] })
  check('compare: выросло и новое', compare(base, { a: 4, b: 1, c: 1 }).added, [['a', 4, 3], ['c', 1, 0]])
  check('compare: исправлено', compare(base, { a: 2 }).stale, [['a', 2, 3], ['b', 0, 1]])
  check('pruned: только сужает, новое не вносит', pruned(base, { a: 2, b: 5, c: 9 }), { a: 2, b: 1 })
}

// ── токены
both('токены: палитра, [Npx], литерал', '<div className="bg-zinc-800 text-white/80 w-[13px] shadow-[0_0_4px_rgba(1,2,3,.5)]" />\n', countIn, {
  palette: 2, literal: 1, px: 1, form: 0, inline: 0,
})
both('токены: в комментариях не считается', '// text-white, w-[13px], #fff\nconst a = 1 /* bg-red-500 */\n/*\n text-black\n*/\n', countIn, {
  palette: 0, literal: 0, px: 0, form: 0, inline: 0,
})
both('токены: https:// в строке — не комментарий', "const u = 'https://x.y'; const c = 'text-white'\n", countIn, {
  palette: 1, literal: 0, px: 0, form: 0, inline: 0,
})
// «/*» внутри «//»-комментария открывал блок до следующего «*/», и код между
// ними сторож не видел (в PracticePage — 80 строк, в карте кода — 6 импортов)
both('токены: «/*» внутри «//» блок не открывает', '// игры (features/words/*)\nconst c = \'text-white\'\n/** конец */\n', countIn, {
  palette: 1, literal: 0, px: 0, form: 0, inline: 0,
})
both("токены: 'image/*' в строке — не комментарий", '<input accept="image/*" className="text-white" />\nconst d = \'bg-red-500\'\n', countIn, {
  palette: 2, literal: 0, px: 0, form: 0, inline: 0,
})
both('токены: блок на одной строке и в JSX', 'const a = 1 /* text-white */ + 2\n<div>{/* bg-red-500 */}</div>\n', countIn, {
  palette: 0, literal: 0, px: 0, form: 0, inline: 0,
})
both('токены: style — литерал и переменная считаются, var(--…) нет',
  "<a style={{ color: '#f00', background: colors[i] }} />\n<b style={{\n  background:\n    'linear-gradient(0deg, var(--color-accent) 0%, var(--x) 100%)',\n}} />\n",
  countIn, { palette: 0, literal: 1, px: 0, form: 0, inline: 2 })
both('токены: похожие слова — не цвета', '<div className="text-current bg-transparent border-night text-redder to-whitey" />\n', countIn, {
  palette: 0, literal: 0, px: 0, form: 0, inline: 0,
})

both('токены: форма — старое имя, [var(--color-…)] в классе, dark:',
  `<div className="text-[var(--night-text-40)] bg-[var(--color-surface)] dark:bg-page" style={{ color: 'var(--night-accent)' }} />\n`,
  countIn, { palette: 0, literal: 0, px: 0, form: 4, inline: 0 })
both('токены: форма — утилиты, var(--color-…) в style и слово dark — не нарушение',
  `<div className="text-fg-muted bg-surface" style={{ color: 'var(--color-accent)' }} />\nconst dark = true; const t = { dark: 1 }\n`,
  countIn, { palette: 0, literal: 0, px: 0, form: 0, inline: 0 })

// ── размер: компоненты
{
  const long = (n) => Array.from({ length: n }, (_, i) => `  void ${i}`).join('\n')
  const src = `export function Big() {\n${long(10)}\n  return null\n}\nexport const Arrow = memo(() => {\n${long(3)}\n  return null\n})\nfunction helper() {\n  return 1\n}\nconst Value = 5\n`
  both('размер: компоненты-функции и memo, не хелперы и не значения', src, (t) => componentsIn('x.tsx', t), [['Big', 13], ['Arrow', 6]])
}

// ── план
{
  const plan = [
    '# План', '```text', '### Ф?.? — Шаблон', '- **Статус:** ⬜', '```',
    '### Ф1.1 — Полный', '- **Статус:** ✅ 27.09.2026 — готово', '- **Зачем:** так надо',
    '- **Что сделать (владелец), после Ф0.1:** шаги', '  на двух строках', '- **Готово, когда:** всё',
    '- **Аппетит:** 1 дн.', '- **Зависит от:** —', '- **Скиллы:** не нужен — стандартные инструменты',
    '- **Задание для сессии:**', '  ```text', '  Сделай пункт.', '  ```',
    '### Ф1.2 — Дырявый', '- **Статус:** ✅ готово', '- **Зачем:** ', '- **Скиллы:** не нужен.',
    '- **Задание для сессии:**', '  ```text', '  ```', '',
  ].join('\n')
  both('план: шаблон в блоке кода не пункт', plan, (t) => parsePlan(t).map((i) => i.id), ['Ф1.1', 'Ф1.2'])
  both('план: полный пункт чист, дырявый — все дыры', plan, (t) => Object.keys(problems(parsePlan(t))), [
    'Ф1.2 | нет поля «Зачем»', 'Ф1.2 | нет поля «Что сделать»', 'Ф1.2 | нет поля «Готово, когда»', 'Ф1.2 | нет поля «Аппетит»',
    'Ф1.2 | нет поля «Зависит от»', 'Ф1.2 | у ✅ нет даты',
    'Ф1.2 | в «Задании для сессии» нет текста задания в блоке ```text',
    'Ф1.2 | «Скиллы: не нужен» без причины («не нужен — потому что …»)',
  ])
}

// ── описания
check('isCode: код модулей', ['src/lib/text.ts', 'api/gemini.ts', 'src/index.css', 'src/data/english/x.ts', 'src/shared/api/database.types.ts', 'scripts/x.mjs', 'CLAUDE.md'].map(isCode), [
  true, true, true, false, false, false, false,
])
{
  const docs = new Set(['CLAUDE.md', 'src/features/teacher/CLAUDE.md'])
  check('docFor: ближайший вверх', ['src/features/teacher/materials/A.tsx', 'src/features/words/B.tsx'].map((f) => docFor(f, docs)), [
    'src/features/teacher/CLAUDE.md', 'CLAUDE.md',
  ])
  check('verdict: код без описания — красный', verdict({ files: ['src/features/words/B.tsx'], message: 'правка', docs }).length, 1)
  check('verdict: описание в том же коммите — зелёный', verdict({ files: ['src/features/words/B.tsx', 'CLAUDE.md'], message: 'правка', docs }), [])
  check('verdict: корневое вместо своего — красный', verdict({ files: ['src/features/teacher/A.tsx', 'CLAUDE.md'], message: 'правка', docs }).length, 1)
  check('verdict: только не-код — зелёный', verdict({ files: ['scripts/x.mjs', 'docs/PLAN.md'], message: 'правка', docs }), [])
}
// указатель «Описание:» — модуль из lib/ привязан к описанию раздела (Ф1.7)
both('pointerIn: строка //', '// ====\n// Домашка на неделю.\n// Описание: src/features/homework/CLAUDE.md\nimport x from "y"\n', pointerIn, 'src/features/homework/CLAUDE.md')
both('pointerIn: JSDoc и обратные кавычки', '/**\n * Самокоррекция.\n * Описание: `src/components/CLAUDE.md`\n */\n', pointerIn, 'src/components/CLAUDE.md')
both('pointerIn: нет указателя', '// Домашка.\n// описание — в разделе\nconst a = 1\n', pointerIn, null)
both('pointerIn: дальше 20-й строки не ищем', `${'// …\n'.repeat(20)}// Описание: src/lib/CLAUDE.md\n`, pointerIn, null)
both('pointerIn: в строке кода — не указатель', "const s = 'Описание: src/lib/CLAUDE.md'\n", pointerIn, null)
{
  const docs = new Set(['CLAUDE.md', 'src/lib/CLAUDE.md', 'src/features/homework/CLAUDE.md'])
  const pointers = new Map([['src/lib/homework.ts', 'src/features/homework/CLAUDE.md'], ['src/lib/old.ts', 'src/features/gone/CLAUDE.md']])
  check('docFor: указатель сильнее ближайшего', docFor('src/lib/homework.ts', docs, pointers.get('src/lib/homework.ts')), 'src/features/homework/CLAUDE.md')
  check('docFor: указатель в никуда — ближайший', docFor('src/lib/old.ts', docs, pointers.get('src/lib/old.ts')), 'src/lib/CLAUDE.md')
  check('verdict: lib с указателем, описание раздела не тронуто — красный',
    verdict({ files: ['src/lib/homework.ts', 'src/lib/CLAUDE.md'], message: 'правка', docs, pointers }), [
      'не изменён src/features/homework/CLAUDE.md, а код под ним изменён: src/lib/homework.ts',
    ])
  check('verdict: lib с указателем, описание раздела тронуто — зелёный',
    verdict({ files: ['src/lib/homework.ts', 'src/features/homework/CLAUDE.md'], message: 'правка', docs, pointers }), [])
  check('verdict: тронут только блок generated — красный',
    verdict({ files: ['src/lib/homework.ts', 'src/features/homework/CLAUDE.md'], message: 'правка', docs, pointers, touched: new Set() }).length, 1)
}
{
  const doc = (hand, gen) => `# homework\n\n${hand}\n\n<!-- generated:start -->\n${gen}\n<!-- generated:end -->\n`
  check('touchedByHand: пересобран только блок generated', touchedByHand(doc('Правила.', '- Файлы: a.ts'), doc('Правила.', '- Файлы: a.ts, b.ts')), false)
  check('touchedByHand: правка руками', touchedByHand(doc('Правила.', 'x'), doc('Правила, новое.', 'x')), true)
  check('touchedByHand: CRLF и пробелы в конце строк — не правка', touchedByHand(doc('Правила.', 'x'), crlf(doc('Правила.  ', 'x'))), false)
  check('touchedByHand: новое описание', touchedByHand(null, doc('Правила.', 'x')), true)
  check('touchedByHand: описание удалено', touchedByHand(doc('Правила.', 'x'), null), true)
}
both('hasReason: причина на одной строке', 'Правка\n\nописание не меняется, потому что перенос файлов\n', hasReason, true)
both('hasReason: причина перенесена на вторую строку', 'Правка\n\nописание не меняется, потому что только\nкомментарий\n', hasReason, true)
both('hasReason: фраза без причины', 'Правка\n\nописание не меняется, потому что\n', hasReason, false)
both('hasReason: фраза в комментарии git', 'Правка\n# описание не меняется, потому что перенос файлов\n', hasReason, false)
both('hasReason: фразы нет', 'Правка сверки ответов\n', hasReason, false)

// ── секреты. Выдуманные ключи собираются при запуске — из хеша и по частям:
// целый ключ в этом файле поймал бы сторож секретов на самом тесте.
{
  const noise = (seed, n, only = /[A-Za-z0-9_-]/, enc = 'base64url') => {
    let s = ''
    for (let i = 0; s.length < n; i++) s += [...createHash('sha256').update(`${seed}:${i}`).digest(enc)].filter((c) => only.test(c)).join('')
    return s.slice(0, n)
  }
  const sbSecret = ['sb', 'secret', noise('sb', 22)].join('_') + '_' + noise('sb-sum', 8)
  const sbPublishable = ['sb', 'publishable', noise('pub', 22)].join('_') + '_' + noise('pub-sum', 8)
  const google = 'AI' + 'za' + 'Sy' + noise('g', 33)
  const groq = 'gs' + 'k_' + noise('q', 52, /[A-Za-z0-9]/)
  const sbp = 'sb' + 'p_' + noise('p', 40, /[a-f0-9]/, 'hex')
  const vapid = noise('vapid', 43)
  const jwt = (role) =>
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ iss: 'supabase', role, exp: 2000000000 })).toString('base64url'), noise('sig', 43)].join('.')
  const pemBody = [0, 1, 2].map((i) => noise(`pem${i}`, 64, /[A-Za-z0-9+/]/, 'base64')).join('\n')
  const pem = (body, nl = '\n') => ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + nl + body + nl + ['-----END', 'PRIVATE KEY-----'].join(' ')
  const short = (f) => `${f.line} ${f.what.split(' (')[0]}`
  const secrets = (t) => findSecrets(t).map(short)

  const env = [
    '# ключи тестовой базы',
    `TEST_SUPABASE_SECRET_KEY=${sbSecret}`,
    `GEMINI_API_KEY=${google}`,
    `GROQ_API_KEY="${groq}"`,
    `SUPABASE_ACCESS_TOKEN=${sbp}`,
    `VAPID_PRIVATE_KEY=${vapid}`,
    `export NOTIFY_SECRET=${noise('notify', 32)}`,
    `TEST_SUPABASE_DB_PASSWORD=${noise('db', 16)}`,
    `BACKUP_DB_URL=postgresql://postgres.${noise('ref', 20, /[a-z]/)}:${noise('pw', 16)}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
    `SERVICE_KEY=${jwt('service_role')}`,
    '',
  ].join('\n')
  both('секреты: выдуманный файл .env — каждый ключ', env, secrets, [
    '2 секретный ключ Supabase', '3 ключ Google AI', '4 ключ Groq', '5 токен Management API Supabase',
    '6 значение у переменной VAPID_PRIVATE_KEY', '7 значение у переменной NOTIFY_SECRET',
    '8 значение у переменной TEST_SUPABASE_DB_PASSWORD', '9 адрес базы postgres:// с паролем', '10 старый ключ Supabase service_role',
  ])
  both('секреты: значение в кавычках в коде, JSON и YAML', [
    `const VAPID_PRIVATE_KEY = '${vapid}'`,
    `{ "NOTIFY_SECRET": "${noise('notify', 32)}" }`,
    'env:',
    `  VAPID_PRIVATE_KEY: ${vapid}`,
    `const k = createClient(url, '${sbSecret}')`,
    '',
  ].join('\n'), secrets, [
    '1 значение у переменной VAPID_PRIVATE_KEY', '2 значение у переменной NOTIFY_SECRET', '4 значение у переменной VAPID_PRIVATE_KEY', '5 секретный ключ Supabase',
  ])
  both('секреты: приватный ключ PEM — файлом и внутри JSON', `x\n${pem(pemBody)}\n{"private_key": "${pem(pemBody.replace(/\n/g, '\\n'), '\\n')}\\n"}\n`, secrets, [
    '2 приватный ключ PEM', '7 приватный ключ PEM',
  ])
  const doc = [
    'Ключи — только новые `sb_publishable_`/`sb_secret_` (Ф1.9).',
    '`TEST_SUPABASE_SECRET_KEY` (`sb_secret_…`) — из Settings → API Keys, ключ Google — AIza…, Groq — gsk_…, токен — sbp_…',
    `VITE_SUPABASE_PUBLISHABLE_KEY=${sbPublishable}`,
    `ANON_KEY=${jwt('anon')}`,
    'grant execute on function public.spend_energy(int) to service_role;',
    'Старые JWT-ключи anon/service_role Supabase выключает к концу 2026.',
    'GEMINI_API_KEY=AIzaSy' + 'X'.repeat(33),
    'GROQ_API_KEY=gsk_' + 'abcdefghijklmnopqrstuvwxyz'.repeat(2),
    'SUPABASE_SECRET_KEY=sb_secret_your_secret_key_here_123456',
    'VAPID_PRIVATE_KEY=',
    'VAPID_PRIVATE_KEY=<приватный ключ>',
    'VAPID_PRIVATE_KEY=…',
    '  VAPID_PRIVATE_KEY: ${{ secrets.VAPID_PRIVATE_KEY }}',
    'const key = process.env.VAPID_PRIVATE_KEY',
    '  NOTIFY_SECRET: env.TEST_NOTIFY_SECRET,',
    "process.env.NOTIFY_SECRET = 'test-secret-123'",
    "const SEC = 'sb_secret_ZyXwVu987'",
    "export const SECRET = 'sb_secret_'",
    'const MIN_PASSWORD = 8',
    'postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres',
    `const u = \`postgresql://postgres.\${ref}:\${encoded}@host/postgres\``,
    'Строка `' + ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + '` начинает ключ, а `' + ['-----END', 'PRIVATE KEY-----'].join(' ') + '` — заканчивает.',
    `"data":"H4sIAAAAAAAACry8${google}Kj3"`,
    '',
  ].join('\n')
  both('секреты: примеры в документах и коде, publishable и anon — не тревога', doc, secrets, [])
  check('секреты: значение ключа в отчёт не попадает', [sbSecret, google, groq, sbp, vapid].some((k) => JSON.stringify(findSecrets(env)).includes(k.slice(6))), false)

  check('looksRandom: случайное — да; слово, ряд, повтор, один вид знаков — нет',
    [noise('r', 31), 'your_api_key_goes_here_12', 'Qw' + 'abcdef' + '93Kd8sLm2', 'Zp4' + 'xxxx' + 'Lm29Qa7Rt', 'abcdqwertyuiopzxcvbnm', noise('r', 6)].map((s) => looksRandom(s)),
    [true, false, false, false, false, false])
  check('pathProblem: .env* — да, кроме .env.example; файлы ключей — да; похожие имена — нет',
    ['.env', '.env.local', 'app/.env.production.local', '.envrc', '.env.example', 'twa/android.keystore', 'certs/server.key', 'id_ed25519', 'id_ed25519.pub', 'src/env.ts', 'docs/.environment.md', 'scripts/_keys.mjs']
      .map((p) => pathProblem(p) !== null),
    [true, true, true, true, false, true, true, true, false, false, false, false])
  const binary = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), Buffer.from(google)])
  check('fileProblems: двоичный файл — только по имени; .env.example — по содержимому',
    [fileProblems('public/icon.png', binary).length, fileProblems('.env.local', Buffer.from('A=1\n')).length, fileProblems('.env.example', Buffer.from(`GEMINI_API_KEY=${google}\n`))],
    [0, 1, ['.env.example:1 — ключ Google AI (AIza…, 39 знаков)']])
}

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
