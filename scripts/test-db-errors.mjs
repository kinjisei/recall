/**
 * Наши коды RECALL_* из базы → текст для человека и код для экрана
 * (`src/shared/api/errors.ts`).
 *
 * Ловим: (1) код узнаётся целым словом — `RECALL_BAD_PLAN` не съедает
 * `RECALL_BAD_PLAN_ITEM` (было: ученик, отметивший пункт программы, видел
 * «Такого тарифа нет»); и так для любой пары кодов, где один — начало
 * другого.
 *
 * Запуск: node scripts/test-db-errors.mjs
 */
import { readFileSync } from 'node:fs'
import { dbError, describeDbError } from '../src/shared/api/errors.ts'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${!pass && extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}
// dbError пишет подробность в консоль — в тесте она не нужна
const quiet = (fn) => {
  const was = console.error
  console.error = () => {}
  try {
    return fn()
  } finally {
    console.error = was
  }
}
const pg = (code) => ({ message: code, code: 'P0001' })

const src = readFileSync(new URL('../src/shared/api/errors.ts', import.meta.url), 'utf8')
const codes = [...src.matchAll(/^\s*(RECALL_[A-Z0-9_]+):/gm)].map((m) => m[1])
check('коды текстов найдены (тест не пустой)', codes.length >= 40, `${codes.length}`)

// (1) каждый код — своим текстом, даже если он начало другого кода
const prefixPairs = codes.flatMap((a) => codes.filter((b) => b !== a && b.startsWith(a)).map((b) => [a, b]))
check('пары «код — начало другого кода» есть (иначе (1) ничего не проверяет)', prefixPairs.length > 0)
for (const [short, long] of prefixPairs) {
  check(`${long} — свой текст, а не текст ${short}`, describeDbError(pg(long), 'x') !== describeDbError(pg(short), 'x'))
  check(`${long} — свой код`, quiet(() => dbError(pg(long), 'x')).code === long)
}
check('RECALL_BAD_PLAN_ITEM — про программу, а не про тариф', /программ/.test(describeDbError(pg('RECALL_BAD_PLAN_ITEM'), 'x')))
check('код внутри текста Postgres узнаётся', describeDbError({ message: 'ERROR: RECALL_BAD_PLAN_ITEM (P0001)' }, 'x').includes('программ'))

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exit(failed ? 1 : 0)
