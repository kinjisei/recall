/**
 * Учёт расхода AI — чистый тест (PLAN.md Ф1.6): лимиты моделей и правила
 * блока «Расход AI» в /admin (src/domains/ai).
 *
 * Что доказывает:
 *   • у каждой модели, которую может позвать сервер, есть строка лимитов с
 *     источником — новая модель в цепочке без неё не пройдёт; и наоборот, в
 *     лимитах нет выбывших моделей (их меняли 28.09, старые строки врали бы);
 *   • у каждой задачи сервера есть русская подпись;
 *   • доля лимита считается без отказов 429, сортировка — ближайшие к лимиту
 *     сверху, неизвестный лимит — после известных;
 *   • сутки Google и момент обнуления — по Тихоокеанскому времени, в том
 *     числе в ночь перевода часов.
 * Без сети, базы и ключей. Запуск: node scripts/test-ai-usage.mjs
 */
import './_api-loader.mjs'

const { GEMINI_TIER_CHAINS, DEFAULT_GEMINI_MODEL } = await import('../api/_core.ts')
const { GROQ_MODELS } = await import('../api/_groq.ts')
const { STT_MODEL } = await import('../api/_stt.ts')
const { AI_TASKS } = await import('../api/_tasks.ts')
const { MODEL_LIMITS } = await import('../src/domains/ai/limits.ts')
const { modelsOnDay, dayTotals, googleDay, quotaReset, untilLabel, secondsLabel, TASK_LABELS } =
  await import('../src/domains/ai/model.ts')

let failed = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

// --- лимиты и модели сервера совпадают ------------------------------------------------
console.log('\n— лимиты: у каждой модели сервера есть строка, лишних нет')
const served = new Set([
  DEFAULT_GEMINI_MODEL,
  ...Object.values(GEMINI_TIER_CHAINS).flat(),
  ...Object.values(GROQ_MODELS),
  STT_MODEL,
])
const missing = [...served].filter((m) => !MODEL_LIMITS[m])
check('у каждой модели, которую зовёт сервер, есть строка лимитов', missing.length === 0, missing.join(', '))
const stale = Object.keys(MODEL_LIMITS).filter((m) => !served.has(m))
check('в лимитах нет моделей, которых сервер больше не зовёт', stale.length === 0, stale.join(', '))
const bad = Object.entries(MODEL_LIMITS).filter(
  ([, l]) => !l.source?.trim() || !(l.rpd === null || (Number.isInteger(l.rpd) && l.rpd > 0)),
)
check('у каждой строки есть источник, а лимит — целое > 0 или «неизвестно»', bad.length === 0, bad.map(([m]) => m).join(', '))

console.log('\n— подписи задач')
const unnamed = [...Object.keys(AI_TASKS), 'speech'].filter((t) => !TASK_LABELS[t])
check('у каждой задачи сервера и у речи есть русская подпись', unnamed.length === 0, unnamed.join(', '))

// --- доля лимита и порядок --------------------------------------------------------------
console.log('\n— модели за сутки: доля лимита и порядок')
const LIMITS = {
  a: { rpd: 20, rpm: 5, source: 't' },
  b: { rpd: 1000, rpm: 30, source: 't' },
  c: { rpd: null, rpm: null, source: 't' },
}
const row = (day, model, requests, refused = 0) => ({
  day, model, requests, ok: requests - refused, refused, failed: 0, avg_ms: 100, p95_ms: 200, avg_first_ms: null,
})
const rows = [
  row('2026-09-28', 'b', 500),
  row('2026-09-28', 'c', 900),
  row('2026-09-28', 'a', 19, 4),
  row('2026-09-28', 'x', 3),
  row('2026-09-27', 'a', 20),
]
const today = modelsOnDay(rows, '2026-09-28', LIMITS)
check('берутся только нужные сутки', today.length === 4 && today.every((r) => r.day === '2026-09-28'))
const a = today.find((r) => r.model === 'a')
check('в счёт лимита идут попытки без отказов 429', a?.used === 15 && a.share === 15 / 20, JSON.stringify(a))
check(
  'сверху — ближайшие к лимиту, неизвестный лимит — после известных, по числу попыток',
  today.map((r) => r.model).join(',') === 'a,b,c,x',
  today.map((r) => r.model).join(','),
)
check('модель без строки лимитов — без шкалы, но в списке', today.find((r) => r.model === 'x')?.share === null)

const totals = dayTotals(rows)
check(
  'итог по дням: суммы по всем моделям, свежие сверху',
  totals.length === 2 && totals[0].day === '2026-09-28' && totals[0].requests === 1422 && totals[0].refused === 4 && totals[1].requests === 20,
  JSON.stringify(totals),
)

// --- сутки Google -----------------------------------------------------------------------
console.log('\n— сутки Google (Тихоокеанское время)')
const at = (iso) => new Date(iso)
check('в 11:30 по Алматы у Google ещё вчерашние сутки', googleDay(at('2026-09-28T06:30:00Z')) === '2026-09-27')
check('после полуночи в Калифорнии — новые сутки', googleDay(at('2026-09-28T07:00:00Z')) === '2026-09-28')
const cases = [
  ['летом (UTC−7): обнуление в 07:00 UTC', '2026-09-28T12:00:00Z', '2026-09-29T07:00:00.000Z'],
  ['зимой (UTC−8): обнуление в 08:00 UTC', '2026-12-01T12:00:00Z', '2026-12-02T08:00:00.000Z'],
  ['за секунду до полуночи — через секунду', '2026-09-29T06:59:59Z', '2026-09-29T07:00:00.000Z'],
  ['накануне перевода часов — полночь ещё летняя', '2026-10-31T12:00:00Z', '2026-11-01T07:00:00.000Z'],
  ['в день перевода часов — следующая полночь уже зимняя', '2026-11-01T12:00:00Z', '2026-11-02T08:00:00.000Z'],
  // Сейчас ещё летнее время (01:30), а ближайшая полночь — уже зимняя: без
  // пересчёта смещения на саму полночь ответ съехал бы на час.
  ['ночью до перевода часов на зимнее — смещение берётся на полночь', '2026-11-01T08:30:00Z', '2026-11-02T08:00:00.000Z'],
  ['ночью до перевода часов на летнее — так же', '2026-03-08T09:30:00Z', '2026-03-09T07:00:00.000Z'],
]
for (const [name, now, want] of cases) {
  const got = quotaReset(at(now)).toISOString()
  check(name, got === want, `${got} вместо ${want}`)
}

// --- подписи ------------------------------------------------------------------------------
console.log('\n— подписи')
check('«через 3 ч 20 мин»', untilLabel(200 * 60_000) === 'через 3 ч 20 мин', untilLabel(200 * 60_000))
check('«через 40 мин»', untilLabel(40 * 60_000) === 'через 40 мин', untilLabel(40 * 60_000))
check('«0,3 с» и «12 с»', secondsLabel(300) === '0,3 с' && secondsLabel(12_400) === '12 с', `${secondsLabel(300)} / ${secondsLabel(12_400)}`)
check('нет замера — прочерк', secondsLabel(null) === '—')

console.log(`\n${failed ? '✗' : '✓'} ${total - failed}/${total}`)
process.exit(failed ? 1 : 0)
