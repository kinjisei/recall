/**
 * Замер замены упражнения по видам (PLAN.md Ф2.25-4а, журнал п.76 (22)):
 * одна модель — по одному упражнению каждого вида каталога, A2 и B1, EN и ES
 * (`ai-quality/examples/swap.mjs`). Промпт и разбор ответа — те же, что у
 * кнопки «↻ Заменить» (`domains/materials/swap.ts`); запрос — тот же
 * `callGemini`, что на сервере, со схемой ответа, как у кнопки (`swapSchema`,
 * Ф2.20-3), только одной моделью, без запасных (видно, что умеет ИМЕННО она)
 * и на ключе `TEST_GEMINI_API_KEY`. Схему модель не приняла — «нет ответа»,
 * причина (400) — в выводе.
 *
 * Что считает сам (🤖, критерии «З*» в criteria.md): ответ разобран, вид тот,
 * упражнение прошло фильтр приложения, не повторяет заменяемое, время. Уровень,
 * «только из текста» и однозначность (👁) — по answers.json в папке прогона.
 *
 * Запуск (вне CI, только тестовый ключ):
 *   node scripts/check-ai-swap.mjs --model=gemini-3.6-flash [--only=id,id] [--gap=13]
 *   --gap — пауза между запросами, с (бесплатный лимит в минуту: Flash — 5).
 */
import './ai-quality/loader.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const { readEnv } = await import('./_env.mjs')
const { SWAP } = await import('./ai-quality/examples/swap.mjs')
const { swapMessages, readSwap } = await import('../src/domains/materials/swap.ts')
const { swapSchema } = await import('../src/domains/materials/schema.ts')
const { loadIrregular } = await import('../src/lib/wordForms.ts')
const { callGemini } = await import('../api/_core.ts')
const { TIMEOUTS, chainTime } = await import('../api/_timeouts.ts')

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const model = arg('model')
const only = arg('only')?.split(',')
const gap = Number(arg('gap') ?? 13) * 1000
if (!model) {
  console.error('Нужна модель: --model=gemini-3.6-flash')
  process.exit(1)
}
const key = readEnv().TEST_GEMINI_API_KEY
if (!key) {
  console.error('Нет TEST_GEMINI_API_KEY в .env.local — замер только на тестовом ключе (журнал п.70).')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** Текст упражнения для сравнения «не повторяет»: вопрос или слова пар. */
const face = (e) => (e?.type === 'match' ? e.pairs.map((p) => p.left).sort().join('|') : String(e?.prompt ?? '').trim().toLowerCase())

const cases = SWAP.filter((c) => !only || only.includes(c.id))
const rows = []
for (const [i, c] of cases.entries()) {
  if (i > 0) await sleep(gap)
  const { system, user } = swapMessages(c)
  const irregular = await loadIrregular(c.lang).catch(() => undefined)
  const t0 = Date.now()
  let raw = ''
  let error = null
  try {
    raw = await callGemini([{ role: 'user', content: user }], system, key, model, [], 'standard', chainTime(TIMEOUTS, 'standard'), undefined, swapSchema(c.lang, c.level, c.format))
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }
  const ms = Date.now() - t0
  const r = error ? { ok: false, reason: `нет ответа: ${error}` } : readSwap(raw, c, irregular)
  const repeats = r.ok && [c.replacing, ...c.others].some((o) => face(o) === face(r.exercise))
  const row = { id: c.id, title: c.title, ms, ok: r.ok, reason: r.ok ? '' : r.reason, repeats, exercise: r.ok ? r.exercise : null, raw }
  rows.push(row)
  console.log(`${r.ok && !repeats ? '✓' : '✗'} ${c.id.padEnd(18)} ${String(ms).padStart(6)} мс  ${r.ok ? (repeats ? 'повторяет заменяемое или соседнее' : '') : r.reason}`)
  if (r.ok) console.log(`    ${JSON.stringify(r.exercise).slice(0, 400)}`)
}

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const dir = new URL(`./ai-quality/runs/swap-${model}-${stamp}/`, import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('answers.json', dir), JSON.stringify({ model, cases: SWAP.filter((c) => rows.some((r) => r.id === c.id)), rows }, null, 2))
const good = rows.filter((r) => r.ok && !r.repeats).length
const avg = Math.round(rows.reduce((n, r) => n + r.ms, 0) / Math.max(1, rows.length))
console.log(`\n${model}: прошли ${good} из ${rows.length}, среднее ${avg} мс. Ответы: ${decodeURIComponent(dir.pathname).replace(/^\/([A-Za-z]:)/, '$1')}`)
process.exitCode = good === rows.length ? 0 : 1
