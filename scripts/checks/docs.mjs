#!/usr/bin/env node
// Сторож описаний (журнал п.8): изменил код модуля — измени его описание в том
// же коммите, или напиши в сообщении коммита
//     описание не меняется, потому что <причина>
// Иначе коммит не проходит — ни локально (хук commit-msg), ни в CI.
//
// «Описание модуля» файла кода:
//   1. указатель в начале файла — строка комментария
//          // Описание: src/features/homework/CLAUDE.md
//      Так модуль из src/lib/ или src/components/ привязан к описанию раздела,
//      где живёт его механика (PLAN.md Ф1.7): описание рядом с кодом работает
//      и на старой структуре. Переедет файл в свой домен (Ф3) — указатель
//      удаляется. Указатель на несуществующее описание краснеет в
//      scripts/gen/module-docs.mjs --check;
//   2. иначе — ближайший CLAUDE.md вверх по папкам (так их подгружает и Claude
//      Code). У разделов, где своего описания ещё нет, это корневой CLAUDE.md:
//      он — карта проекта, и правка раздела без описания либо поправит карту,
//      либо назовёт причину. Описание раздел получает при переезде (Ф3, §12).
//
// Проверяется, что описание ТРОНУЛИ руками: блок между
// <!-- generated:start --> и <!-- generated:end --> пишет генератор
// (scripts/gen/module-docs.mjs), и его пересборка правкой описания не
// считается. Верность содержания — самопроверка и приёмка владельцем.
//
// Код — src/ и api/, кроме контента (src/data, src/content) и сгенерированных
// типов базы.
//
// Запуск:
//   node scripts/checks/docs.mjs                        неотправленные коммиты (@{upstream}..HEAD)
//   node scripts/checks/docs.mjs --range A..B           коммиты диапазона (CI; или CHECK_RANGE=A..B)
//   node scripts/checks/docs.mjs --message-file <файл>  готовящийся коммит (хук commit-msg)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isMain, plural, rootPath } from './_baseline.mjs'

const CODE = /^(src|api)\/.+\.(tsx?|jsx?|mjs|cjs|css)$/
const NOT_CODE = [/^src\/data\//, /^src\/content\//, /database\.types\.ts$/]
const REASON = /описание не меняется,?\s+потому что\s+(.+)/i
// «// Описание: src/x/CLAUDE.md», « * Описание: `api/CLAUDE.md`» — в первых строках файла
const POINTER = /^\s*(?:\/\/+|\/?\*+)\s*Описание:\s*`?((?:src|api)\/[\w./-]*CLAUDE\.md)`?/m
const POINTER_LINES = 20
export const GENERATED = /<!-- generated:start -->[\s\S]*?<!-- generated:end -->/

const cwd = rootPath('.').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 })
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export const isCode = (path) => CODE.test(path) && !NOT_CODE.some((re) => re.test(path))

/** Указатель «Описание: …/CLAUDE.md» в начале файла кода (или null). */
export function pointerIn(text) {
  const head = text.replace(/\r/g, '').split('\n').slice(0, POINTER_LINES).join('\n')
  return head.match(POINTER)?.[1] ?? null
}

/** Описание файла: указатель, если он ведёт на существующее описание, иначе ближайший CLAUDE.md вверх. */
export function docFor(path, docs, pointer = null) {
  if (pointer && docs.has(pointer)) return pointer
  const parts = path.split('/').slice(0, -1)
  for (let i = parts.length; i >= 0; i--) {
    const doc = [...parts.slice(0, i), 'CLAUDE.md'].join('/')
    if (docs.has(doc)) return doc
  }
  return null
}

/** Текст описания без блока generated — то, что пишут руками. */
export const handWritten = (text) => text.replace(/\r/g, '').replace(GENERATED, '').replace(/[ \t]+$/gm, '').trim()

/** Тронули ли описание руками: было → стало (null — файла не было / не стало). */
export const touchedByHand = (before, after) => before === null || after === null || handWritten(before) !== handWritten(after)

/** Есть ли в сообщении осмысленная причина (хотя бы два слова после «потому что»). */
export function hasReason(message) {
  // сообщение из редактора на Windows приходит с CRLF, а «.» в регулярке
  // не проходит через \r — причина со второй строки терялась бы
  const text = message
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .join(' ')
  const m = text.match(REASON)
  return Boolean(m && m[1].split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length >= 2)
}

/**
 * Что не так с коммитом: по строке на каждое нетронутое описание.
 *   pointers — путь кода → его указатель «Описание:» (если есть);
 *   touched  — описания, тронутые руками (по умолчанию — все изменённые CLAUDE.md).
 */
export function verdict({ files, message, docs, pointers = new Map(), touched = null }) {
  const byHand = touched ?? new Set(files.filter((f) => f.endsWith('CLAUDE.md')))
  const missing = new Map()
  for (const f of files.filter(isCode)) {
    const doc = docFor(f, docs, pointers.get(f))
    if (doc && !byHand.has(doc)) missing.set(doc, [...(missing.get(doc) ?? []), f])
  }
  if (!missing.size || hasReason(message)) return []
  return [...missing].map(([doc, fs]) => {
    const shown = fs.slice(0, 4).join(', ') + (fs.length > 4 ? ` и ещё ${fs.length - 4}` : '')
    return `не изменён ${doc}, а код под ним изменён: ${shown}`
  })
}

/** Содержимое файла в ревизии (`HEAD`, `<sha>`, `` — индекс) или null, если его там нет. */
function fileAt(rev, path) {
  try {
    return git('show', `${rev}:${path}`)
  } catch {
    return null
  }
}

/** Факты одного коммита для verdict: указатели изменённого кода и тронутые руками описания. */
function factsOf({ files, before, after }) {
  const pointers = new Map()
  for (const f of files.filter(isCode)) {
    const text = after(f) ?? before(f) // удалённый файл — по старому тексту
    const p = text && pointerIn(text)
    if (p) pointers.set(f, p)
  }
  const touched = new Set(files.filter((f) => f.endsWith('CLAUDE.md') && touchedByHand(before(f), after(f))))
  return { pointers, touched }
}

const docsIn = (ref) => new Set(lines(git('ls-tree', '-r', '--name-only', ref)).filter((p) => p.endsWith('CLAUDE.md')))

function commitProblems(sha) {
  const parents = lines(git('rev-list', '--parents', '-n', '1', sha)).join(' ').split(' ').slice(1)
  const files = lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha))
  const docs = docsIn(sha)
  if (parents[0]) for (const d of docsIn(parents[0])) docs.add(d)
  const facts = factsOf({
    files,
    before: (f) => (parents[0] ? fileAt(parents[0], f) : null),
    after: (f) => fileAt(sha, f),
  })
  return verdict({ files, message: git('log', '-1', '--format=%B', sha), docs, ...facts })
}

function explain(problems) {
  for (const p of problems) console.log(`  ${p}`)
  console.log('  Обнови описание в том же коммите (пересборка блока generated не в счёт)')
  console.log('  или напиши в сообщении коммита: «описание не меняется, потому что <причина>»')
}

function checkRange(range) {
  let shas
  try {
    shas = lines(git('rev-list', '--no-merges', '--reverse', range))
  } catch {
    console.log(`✖ описания: не удалось прочитать коммиты «${range}» (нет истории? в CI нужен fetch-depth: 0)`)
    return false
  }
  let bad = 0
  for (const sha of shas) {
    const problems = commitProblems(sha)
    if (!problems.length) continue
    bad++
    console.log(`✖ описания: коммит ${sha.slice(0, 7)} «${git('log', '-1', '--format=%s', sha).trim()}»`)
    explain(problems)
  }
  if (!bad) console.log(`✔ описания: ${plural(shas.length, 'коммит', 'коммита', 'коммитов')} в ${range} — в порядке`)
  return bad === 0
}

function defaultRange() {
  for (const base of ['@{upstream}', 'origin/main']) {
    try {
      git('rev-parse', '--verify', '--quiet', base)
      return `${base}..HEAD`
    } catch {
      /* пробуем следующую базу */
    }
  }
  return null
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2)
  const msgAt = argv.indexOf('--message-file')
  const rangeAt = argv.indexOf('--range')
  let ok = true

  if (msgAt !== -1) {
    const message = readFileSync(argv[msgAt + 1], 'utf8')
    const files = lines(git('diff', '--cached', '--name-only', '--diff-filter=ACDMR'))
    const docs = docsIn('HEAD')
    const staged = (f) => fileAt('', f) // «:путь» — версия в индексе
    for (const f of files) if (f.endsWith('CLAUDE.md') && staged(f) !== null) docs.add(f)
    const facts = factsOf({ files, before: (f) => fileAt('HEAD', f), after: staged })
    const problems = verdict({ files, message, docs, ...facts })
    if (problems.length) {
      console.log('✖ описания: изменён код модуля, а его описание — нет')
      explain(problems)
      ok = false
    }
  } else {
    const range = rangeAt !== -1 ? argv[rangeAt + 1] : process.env.CHECK_RANGE || defaultRange()
    if (!range) console.log('✔ описания: нет ни upstream, ни origin/main — проверять не с чем')
    else ok = checkRange(range)
  }
  process.exitCode = ok ? 0 : 1
}
