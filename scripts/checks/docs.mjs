#!/usr/bin/env node
// Сторож описаний (журнал п.8): изменил код модуля — измени его описание в том
// же коммите, или напиши в сообщении коммита
//     описание не меняется, потому что <причина>
// Иначе коммит не проходит — ни локально (хук commit-msg), ни в CI.
//
// «Описание модуля» — ближайший CLAUDE.md вверх по папкам от изменённого файла
// (так их подгружает и Claude Code). У разделов, где своего CLAUDE.md ещё нет,
// это корневой CLAUDE.md: пока механика раздела описана там (PLAN.md Ф1.7).
// Проверяется, что описание ТРОНУЛИ; верность содержания — самопроверка и
// приёмка владельцем.
//
// Код — src/ и api/, кроме контента (src/data, src/content) и сгенерированных
// типов базы.
//
// Запуск:
//   node scripts/checks/docs.mjs                        неотправленные коммиты (@{upstream}..HEAD)
//   node scripts/checks/docs.mjs --range A..B           коммиты диапазона (CI; или CHECK_RANGE=A..B)
//   node scripts/checks/docs.mjs --message-file <файл>  готовящийся коммит (хук commit-msg)
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { isMain, plural, rootPath } from './_baseline.mjs'

const CODE = /^(src|api)\/.+\.(tsx?|jsx?|mjs|cjs|css)$/
const NOT_CODE = [/^src\/data\//, /^src\/content\//, /database\.types\.ts$/]
const REASON = /описание не меняется,?\s+потому что\s+(.+)/i

const cwd = rootPath('.').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)

export const isCode = (path) => CODE.test(path) && !NOT_CODE.some((re) => re.test(path))

/** Ближайший CLAUDE.md вверх от файла среди существующих описаний. */
export function docFor(path, docs) {
  const parts = path.split('/').slice(0, -1)
  for (let i = parts.length; i >= 0; i--) {
    const doc = [...parts.slice(0, i), 'CLAUDE.md'].join('/')
    if (docs.has(doc)) return doc
  }
  return null
}

/** Есть ли в сообщении осмысленная причина (хотя бы два слова после «потому что»). */
export function hasReason(message) {
  const text = message
    .split('\n')
    .filter((l) => !l.startsWith('#'))
    .join(' ')
  const m = text.match(REASON)
  return Boolean(m && m[1].split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w)).length >= 2)
}

/** Что не так с коммитом: по строке на каждое нетронутое описание. */
export function verdict({ files, message, docs }) {
  const changed = new Set(files)
  const missing = new Map()
  for (const f of files.filter(isCode)) {
    const doc = docFor(f, docs)
    if (doc && !changed.has(doc)) missing.set(doc, [...(missing.get(doc) ?? []), f])
  }
  if (!missing.size || hasReason(message)) return []
  return [...missing].map(([doc, fs]) => {
    const shown = fs.slice(0, 4).join(', ') + (fs.length > 4 ? ` и ещё ${fs.length - 4}` : '')
    return `не изменён ${doc}, а код под ним изменён: ${shown}`
  })
}

const docsIn = (ref) => new Set(lines(git('ls-tree', '-r', '--name-only', ref)).filter((p) => p.endsWith('CLAUDE.md')))

function commitProblems(sha) {
  const parents = lines(git('rev-list', '--parents', '-n', '1', sha)).join(' ').split(' ').slice(1)
  const files = lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha))
  const docs = docsIn(sha)
  if (parents[0]) for (const d of docsIn(parents[0])) docs.add(d)
  return verdict({ files, message: git('log', '-1', '--format=%B', sha), docs })
}

function explain(problems) {
  for (const p of problems) console.log(`  ${p}`)
  console.log('  Обнови описание в том же коммите или напиши в сообщении коммита:')
  console.log('  «описание не меняется, потому что <причина>»')
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
    for (const f of files) if (f.endsWith('CLAUDE.md') && existsSync(rootPath(f))) docs.add(f)
    const problems = verdict({ files, message, docs })
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
