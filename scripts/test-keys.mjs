/**
 * Проверка ключей Supabase (scripts/_keys.mjs, PLAN.md Ф1.9).
 *
 * Ловим ровно то, ради чего она есть: старый JWT-ключ вместо нового, секретный
 * ключ в VITE_-переменной (ушёл бы в бандл каждому ученику), забытая
 * переменная на Vercel. Правильное окружение и сборка в CI без .env проходят;
 * значение ключа в текст ошибки не попадает.
 *
 * Запуск: node scripts/test-keys.mjs
 */
import { buildEnvProblems, keyProblem } from './_keys.mjs'

let ok = 0
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  pass ? ok++ : failed++
}

const jwt = (role) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ iss: 'supabase', role })).toString('base64url'), 'sig'].join('.')
const PUB = 'sb_publishable_AbCdEf123'
const SEC = 'sb_secret_ZyXwVu987'
const URL_ = 'https://abc.supabase.co'

// --- один ключ ------------------------------------------------------------------
check('publishable на своём месте — ок', keyProblem('K', PUB, 'publishable') === null)
check('secret на своём месте — ок', keyProblem('K', SEC, 'secret') === null)
check('пустой — беда', /пусто/.test(keyProblem('K', '', 'publishable') ?? ''))
check('старый anon вместо publishable — беда', /старый ключ anon/.test(keyProblem('K', jwt('anon'), 'publishable') ?? ''))
check('старый service_role вместо secret — беда', /старый ключ service_role/.test(keyProblem('K', jwt('service_role'), 'secret') ?? ''))
check('secret вместо publishable — беда', /секретный/.test(keyProblem('K', SEC, 'publishable') ?? ''))
check('publishable вместо secret — беда', keyProblem('K', PUB, 'secret') !== null)
check('мусор — беда', /не похоже/.test(keyProblem('K', 'ВСТАВЬ_СЮДА', 'publishable') ?? ''))
check('значение ключа в текст не попадает', !(keyProblem('K', SEC, 'publishable') ?? '').includes('ZyXwVu'))

// --- окружение сборки -------------------------------------------------------------
// ключи push (Ф2.9): публичный — 65 байт с 0x04 в начале, приватный — 32 байта
const VAPID_PUB = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url')
const VAPID_PRIV = Buffer.alloc(32, 9).toString('base64url')
/** Копия окружения без одного ключа. */
const without = (env, key) => Object.fromEntries(Object.entries(env).filter(([k]) => k !== key))
const good = { VITE_SUPABASE_URL: URL_, VITE_SUPABASE_PUBLISHABLE_KEY: PUB, SUPABASE_SECRET_KEY: SEC, VITE_VAPID_PUBLIC_KEY: VAPID_PUB, VAPID_PRIVATE_KEY: VAPID_PRIV }
check('правильное окружение на Vercel — ок', buildEnvProblems(good, { onVercel: true }).length === 0)
check('CI без .env — ок', buildEnvProblems({}, { onVercel: false }).length === 0)
{
  const p = buildEnvProblems(without(good, 'VITE_SUPABASE_PUBLISHABLE_KEY'), { onVercel: true })
  check('Vercel без ключа — сборка падает', p.length === 1 && /не задан/.test(p[0]), p.join('; '))
}
check('Vercel без адреса — сборка падает', buildEnvProblems(without(good, 'VITE_SUPABASE_URL'), { onVercel: true }).length === 1)
check(
  'старый anon в VITE_SUPABASE_PUBLISHABLE_KEY — падает и локально',
  buildEnvProblems({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: jwt('anon') }, { onVercel: false }).length === 1,
)
{
  const p = buildEnvProblems({ ...good, VITE_SUPABASE_PUBLISHABLE_KEY: SEC }, { onVercel: false })
  check('secret в VITE_SUPABASE_PUBLISHABLE_KEY — одна беда, не две', p.length === 1 && /бандл/.test(p[0]), p.join('; '))
}
check(
  'secret в ЛЮБОЙ VITE_-переменной — беда',
  buildEnvProblems({ ...good, VITE_ANALYTICS: SEC }, { onVercel: false }).some((x) => x.startsWith('VITE_ANALYTICS')),
)
check(
  'старый service_role в VITE_-переменной — беда',
  buildEnvProblems({ ...good, VITE_OLD: jwt('service_role') }, { onVercel: false }).some((x) => x.startsWith('VITE_OLD')),
)
check('secret без VITE_ — не беда', buildEnvProblems({ ...good, SUPABASE_SECRET_KEY: SEC }, { onVercel: false }).length === 0)
check('Vercel без ключей push — сборка падает (оба названы)', (() => {
  const p = buildEnvProblems(without(without(good, 'VITE_VAPID_PUBLIC_KEY'), 'VAPID_PRIVATE_KEY'), { onVercel: true })
  return p.length === 2 && p.some((x) => x.startsWith('VITE_VAPID_PUBLIC_KEY')) && p.some((x) => x.startsWith('VAPID_PRIVATE_KEY'))
})())
check('приватный ключ push в VITE_ — беда, даже без значения-ключа Supabase',
  buildEnvProblems({ ...good, VITE_VAPID_PRIVATE_KEY: VAPID_PRIV }, { onVercel: false }).some((x) => x.startsWith('VITE_VAPID_PRIVATE_KEY')))
check('публичный ключ push не того размера — беда',
  buildEnvProblems({ ...good, VITE_VAPID_PUBLIC_KEY: VAPID_PRIV }, { onVercel: false }).some((x) => x.startsWith('VITE_VAPID_PUBLIC_KEY')))

console.log(`\n${ok} ✓, ${failed} ✗`)
process.exit(failed ? 1 : 0)
