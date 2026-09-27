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
import { docFor, hasReason, isCode, verdict } from './checks/docs.mjs'
import { parsePlan, problems } from './checks/plan.mjs'
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
  palette: 2, literal: 1, px: 1, inline: 0,
})
both('токены: в комментариях не считается', '// text-white, w-[13px], #fff\nconst a = 1 /* bg-red-500 */\n/*\n text-black\n*/\n', countIn, {
  palette: 0, literal: 0, px: 0, inline: 0,
})
both('токены: https:// в строке — не комментарий', "const u = 'https://x.y'; const c = 'text-white'\n", countIn, {
  palette: 1, literal: 0, px: 0, inline: 0,
})
both('токены: style — литерал и переменная считаются, var(--…) нет',
  "<a style={{ color: '#f00', background: colors[i] }} />\n<b style={{\n  background:\n    'linear-gradient(0deg, var(--night-accent) 0%, var(--x) 100%)',\n}} />\n",
  countIn, { palette: 0, literal: 1, px: 0, inline: 2 })
both('токены: похожие слова — не цвета', '<div className="text-current bg-transparent border-night text-redder to-whitey" />\n', countIn, {
  palette: 0, literal: 0, px: 0, inline: 0,
})

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
both('hasReason: причина на одной строке', 'Правка\n\nописание не меняется, потому что перенос файлов\n', hasReason, true)
both('hasReason: причина перенесена на вторую строку', 'Правка\n\nописание не меняется, потому что только\nкомментарий\n', hasReason, true)
both('hasReason: фраза без причины', 'Правка\n\nописание не меняется, потому что\n', hasReason, false)
both('hasReason: фраза в комментарии git', 'Правка\n# описание не меняется, потому что перенос файлов\n', hasReason, false)
both('hasReason: фразы нет', 'Правка сверки ответов\n', hasReason, false)

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
