#!/usr/bin/env node
// Все чистые тесты — по шаблону имени scripts/test-*.mjs, а не списком руками:
// новый тест подхватывается сам (раньше его надо было не забыть вписать в CI).
//
// Правило имени: test-* — только чистые тесты, без сети, базы и секретов (в CI
// их нет). Проверка, которой нужна живая база, называется check-*
// (check-db-equal, check-answermatches-sql…).
// Прогоняем ВСЕ, а не до первого падения: полезнее увидеть сразу все
// сломанные места. Запуск: npm test
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { plural, rootPath } from './_baseline.mjs'

const dir = rootPath('scripts/').pathname.replace(/^\/([A-Za-z]:)/, '$1')
const tests = readdirSync(dir).filter((f) => /^test-.+\.mjs$/.test(f)).sort()
if (!tests.length) {
  console.log('✖ тесты: не найдено ни одного scripts/test-*.mjs — сломан шаблон')
  process.exit(1)
}

const failed = []
for (const t of tests) {
  console.log(`── ${t}`)
  const r = spawnSync(process.execPath, [`${dir}${t}`], { stdio: 'inherit' })
  if (r.status !== 0) failed.push(t)
}
console.log('')
if (failed.length) {
  console.log(`✖ тесты: упало ${failed.length} из ${tests.length}: ${failed.join(', ')}`)
  process.exitCode = 1
} else {
  console.log(`✔ тесты: ${plural(tests.length, 'файл', 'файла', 'файлов')} — все прошли`)
}
