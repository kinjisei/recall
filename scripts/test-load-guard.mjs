/**
 * Сторож нагрузки (scripts/_load-guard.mjs, PLAN.md Ф2.12) — чистый тест.
 *
 * Ловим ровно то, ради чего он есть: --prod, адрес живой базы в
 * TEST_SUPABASE_URL (зашитый ref и ref из VITE_SUPABASE_URL), один ключ на
 * обе базы, запуск без подтверждения или с чужим ref. Правильное окружение с
 * подтверждением проходит; ключи в текст бед не попадают.
 *
 * Запуск: node scripts/test-load-guard.mjs
 */
import { PROD_REF, loadTargetProblems, supabaseRef } from './_load-guard.mjs'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${!pass && extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}

const TEST = 'https://testref123.supabase.co'
const PROD = `https://${PROD_REF}.supabase.co`
const good = {
  TEST_SUPABASE_URL: TEST,
  TEST_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TEST123',
  VITE_SUPABASE_URL: PROD,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_PROD456',
}
const yes = ['--confirm=testref123']
const has = (problems, re) => problems.some((p) => re.test(p))

check('ref из адреса', supabaseRef(TEST) === 'testref123' && supabaseRef('http://x.supabase.co') === null && supabaseRef('https://evil.com') === null)
check('тестовая база + подтверждение — можно', loadTargetProblems(good, yes).length === 0, loadTargetProblems(good, yes).join('; '))
check('без VITE_ в .env.local — тоже можно', loadTargetProblems({ TEST_SUPABASE_URL: TEST }, yes).length === 0)

check('--prod — нельзя', has(loadTargetProblems(good, [...yes, '--prod']), /--prod/))
check('нет TEST_SUPABASE_URL — нельзя', has(loadTargetProblems({ VITE_SUPABASE_URL: PROD }, yes), /Нет TEST_SUPABASE_URL/))
check('адрес не Supabase или не https — нельзя', has(loadTargetProblems({ TEST_SUPABASE_URL: 'http://testref123.supabase.co' }, yes), /не https/) && has(loadTargetProblems({ TEST_SUPABASE_URL: 'https://example.com' }, yes), /не https/))
check(
  'TEST_SUPABASE_URL = живая база (зашитый ref) — нельзя, даже без VITE_ и с подтверждением',
  has(loadTargetProblems({ TEST_SUPABASE_URL: PROD }, [`--confirm=${PROD_REF}`]), /ЖИВУЮ/),
)
{
  const other = 'https://otherprod.supabase.co'
  const p = loadTargetProblems({ ...good, TEST_SUPABASE_URL: other, VITE_SUPABASE_URL: other }, ['--confirm=otherprod'])
  check('TEST_SUPABASE_URL = VITE_SUPABASE_URL — нельзя', has(p, /совпадает с VITE_SUPABASE_URL/), p.join('; '))
}
{
  const p = loadTargetProblems({ ...good, TEST_SUPABASE_PUBLISHABLE_KEY: good.VITE_SUPABASE_PUBLISHABLE_KEY }, yes)
  check('один публичный ключ на обе базы — нельзя', has(p, /один проект/), p.join('; '))
  check('значение ключа в текст не попадает', !p.join(' ').includes('PROD456'))
}
check('без --confirm — нельзя, и подсказка с ref', has(loadTargetProblems(good, []), /--confirm=testref123/))
check('--confirm с чужим ref — нельзя', has(loadTargetProblems(good, ['--confirm=otherref']), /не совпадает/))
check('--confirm=ref живой — нельзя', loadTargetProblems(good, [`--confirm=${PROD_REF}`]).length > 0)

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
