#!/usr/bin/env node
// Все сторожа разом (PLAN.md Ф1.1, архитектура §10).
//
//   npm run check          всё по всему коду + неотправленные коммиты (описания)
//   npm run check:prune    сузить все списки «к исправлению» после исправлений
//   (хук pre-commit)       node scripts/checks/run.mjs --staged — линтер только
//                          по файлам коммита, остальные сторожа целиком
//
// Сторожа идут параллельно, вывод печатается по порядку. Красный хотя бы
// один — код возврата 1.
import { execFileSync, spawn } from 'node:child_process'
import { rootPath } from './_baseline.mjs'

const cwd = rootPath('.').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const argv = process.argv.slice(2)
const staged = argv.includes('--staged')
const prune = argv.includes('--prune')

const ESLINT = ['node_modules/eslint/bin/eslint.js', '--suppressions-location', 'scripts/checks/baseline/eslint.json']
const LINTABLE = /\.(js|mjs|cjs|ts|tsx)$/

function eslintArgs() {
  if (prune) return [...ESLINT, '--prune-suppressions', '.']
  // кэш — только на своей машине: в CI каждый прогон с чистого листа
  const cache = process.env.CI ? [] : ['--cache', '--cache-location', 'node_modules/.cache/eslint/']
  if (!staged) return [...ESLINT, ...cache, '--concurrency', 'auto', '.']
  const files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd, encoding: 'utf8' })
    .split('\n')
    .map((f) => f.trim())
    .filter((f) => LINTABLE.test(f))
  return files.length ? [...ESLINT, ...cache, '--no-warn-ignored', ...files] : null
}

const script = (name) => [`scripts/checks/${name}.mjs`, ...(prune ? ['--prune'] : [])]
const guards = [
  ['линтер', eslintArgs()],
  ['границы', script('boundaries')],
  ['токены', script('tokens')],
  ['размер', script('size')],
  ['план', script('plan')],
  // описаниям нужно сообщение коммита: перед коммитом их проверяет хук
  // commit-msg, при сужении списков им нечего сужать
  ['описания', staged || prune ? null : script('docs')],
]

function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, FORCE_COLOR: '0' } })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('close', (code) => resolve({ code, out }))
  })
}

const results = await Promise.all(guards.map(([, args]) => (args ? run(args) : null)))
const summary = []
guards.forEach(([name, args], i) => {
  if (!args) return
  const { code, out } = results[i]
  const ok = code === 0
  if (out.trim()) console.log(`── ${name}\n${out.trim()}\n`)
  else if (name === 'линтер') console.log(`── ${name}\n✔ линтер: ${prune ? 'список сужен' : 'новых нарушений нет'}\n`)
  summary.push(`${ok ? '✔' : '✖'} ${name}`)
})
const failed = summary.filter((s) => s.startsWith('✖')).length
console.log(`Сторожа: ${summary.join(' · ')}`)
if (failed) {
  console.log('Что делать с красным — scripts/checks/README.md')
  process.exitCode = 1
}
