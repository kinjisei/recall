/**
 * Сервер доставки уведомлений api/notify.ts (PLAN.md Ф1.5; архитектура §17).
 *
 * Будит его база (pg_net), вход — только по секрету. Тест доказывает:
 *   • без NOTIFY_SECRET в окружении — отказ всем (503), даже с заголовком;
 *   • без секрета, с неверным, с секретом другой длины, без «Bearer» — 401;
 *   • кривое тело, лишнее число уведомлений — 400;
 *   • с верным секретом каждый канал получает каждое уведомление; сбой одного
 *     канала (и синхронный throw) не валит ответ и не мешает соседнему.
 * Чистый: без сети, базы и ключей.
 * Запуск: node scripts/test-notify-endpoint.mjs
 */
import { registerHooks } from 'node:module'

// api/*.ts импортируют друг друга с .js (так требует Vercel в ESM) — подставляем .ts
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (e) {
      if (specifier.startsWith('.') && specifier.endsWith('.js')) return nextResolve(specifier.slice(0, -3) + '.ts', context)
      throw e
    }
  },
})

const { handle, secretMatches } = await import('../api/notify.ts')

let fail = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

function makeRes() {
  const r = { code: 200, payload: undefined }
  r.status = (c) => ((r.code = c), r)
  r.json = (p) => ((r.payload = p), r)
  return r
}
const note = (id) => ({ id, user_id: 'u1', kind: 'manual', data: { title: 't' }, created_at: '2026-09-28T10:00:00Z' })
const SECRET = 's3cr3t-for-test-only'

async function call({ method = 'POST', auth, body, channels = [] } = {}) {
  const res = makeRes()
  await handle({ method, headers: auth === undefined ? {} : { authorization: auth }, body }, res, channels)
  return res
}

// ── настройка ───────────────────────────────────────────────────────────────
delete process.env.NOTIFY_SECRET
let r = await call({ auth: `Bearer ${SECRET}`, body: { notifications: [] } })
check('без NOTIFY_SECRET в окружении — отказ всем (503)', r.code === 503, String(r.code))

process.env.NOTIFY_SECRET = SECRET
r = await call({ method: 'GET', auth: `Bearer ${SECRET}` })
check('не POST — 405', r.code === 405)

// ── секрет ──────────────────────────────────────────────────────────────────
for (const [name, auth] of [
  ['без заголовка', undefined],
  ['пустой Bearer', 'Bearer '],
  ['неверный секрет', 'Bearer wrong-secret-of-same-len'],
  ['секрет другой длины', 'Bearer x'],
  ['без «Bearer»', SECRET],
  ['секрет с лишним хвостом', `Bearer ${SECRET}x`],
]) {
  r = await call({ auth, body: { notifications: [note('1')] } })
  check(`${name} — 401`, r.code === 401, String(r.code))
}
check('secretMatches: верный — да', secretMatches(`Bearer ${SECRET}`, SECRET) === true)
check('secretMatches: регистр важен', secretMatches(`Bearer ${SECRET.toUpperCase()}`, SECRET) === false)

// ── тело ────────────────────────────────────────────────────────────────────
const bad = [
  ['без тела', undefined],
  ['не массив', { notifications: 'x' }],
  ['без id', { notifications: [{ ...note('1'), id: undefined }] }],
  ['data — массив', { notifications: [{ ...note('1'), data: [] }] }],
  ['больше 100 за раз', { notifications: Array.from({ length: 101 }, (_, i) => note(String(i))) }],
]
for (const [name, body] of bad) {
  r = await call({ auth: `Bearer ${SECRET}`, body })
  check(`${name} — 400`, r.code === 400, String(r.code))
}

// ── каналы ──────────────────────────────────────────────────────────────────
const seen = []
const good = { name: 'good', deliver: async (n) => (seen.push(n.id), n.id === '2' ? 'skipped' : 'sent') }
const broken = { name: 'broken', deliver: async () => { throw new Error('упал') } }
const syncThrow = { name: 'sync', deliver: () => { throw new Error('упал сразу') } }
r = await call({ auth: `Bearer ${SECRET}`, body: { notifications: [note('1'), note('2'), note('3')] }, channels: [broken, syncThrow, good] })
check('с верным секретом — 200 и число принятых', r.code === 200 && r.payload?.received === 3, JSON.stringify(r.payload))
check('каждый канал получил каждое уведомление', seen.join(',') === '1,2,3', seen.join(','))
check('итоги канала посчитаны', JSON.stringify(r.payload?.results?.good) === JSON.stringify({ sent: 2, skipped: 1, failed: 0 }), JSON.stringify(r.payload?.results?.good))
check('упавший канал — failed, ответ не сорван', r.payload?.results?.broken?.failed === 3 && r.payload?.results?.sync?.failed === 3)

r = await call({ auth: `Bearer ${SECRET}`, body: { notifications: [] } })
check('пустая пачка — 200, ноль принятых', r.code === 200 && r.payload?.received === 0)

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
