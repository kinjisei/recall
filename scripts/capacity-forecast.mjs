/**
 * Прогноз нагрузки на AI по коду (PLAN.md Ф2.12): N пользователей → запросов
 * в сутки к каждой модели, кто откажет первым и в котором часу, при скольких
 * пользователях ломается каждая задача, деньги платного Gemini. Задачи,
 * цепочки и лимиты — из api/ и src/domains/ai/limits.ts, допущения об
 * активности — scripts/_capacity-model.mjs. Числа отчёта
 * docs/capacity-2026-11.md — отсюда.
 *
 * Чистый: без сети, базы и ключей.
 * Запуск: node scripts/capacity-forecast.mjs [--users=200] [--mode=free|dec1|paid] [--optimistic]
 *   [--teachers=1 --students=10 --solo=0] — своя студия вместо пропорции 200
 *   --mode=free — бесплатный Gemini сейчас; dec1 — после 01.12.2026 (2.5-flash →
 *   3.5-flash-lite); paid — платный Gemini (RECALL_CHEAP_MODELS=1);
 *   --optimistic — у переадресованной модели своя квота (по умолчанию — общая).
 */
import './_api-loader.mjs'
import {
  ACTIVE_SHARE, BASE, GOOGLE_ROUTES, almatyClock, breakUsers, buildCapacity, buildRoutes, dailyDemand,
  failShare, paidCost, simulateDay, taskOf, usersFor,
} from './_capacity-model.mjs'

/** Код сервера: free — как сейчас на проде; paid — с RECALL_CHEAP_MODELS=1 (порядок standard другой). */
export async function loadCode(paid = false) {
  if (paid) process.env.RECALL_CHEAP_MODELS = '1'
  const { GEMINI_TIER_CHAINS } = await import(`../api/_core.ts${paid ? '?paid' : ''}`)
  if (paid) delete process.env.RECALL_CHEAP_MODELS
  const { GROQ_MODELS } = await import('../api/_groq.ts')
  const { STT_MODEL } = await import('../api/_stt.ts')
  const { AI_TASKS } = await import('../api/_tasks.ts')
  const { SWAP_CHAINS } = await import('../api/_swap.ts')
  const { MODEL_LIMITS } = await import('../src/domains/ai/limits.ts')
  return { tasks: AI_TASKS, chains: GEMINI_TIER_CHAINS, swapChains: SWAP_CHAINS, groq: GROQ_MODELS, stt: STT_MODEL, limits: MODEL_LIMITS }
}

/** Всё, что нужно расчёту, для режима: маршруты, лимиты, переадресация. */
export async function setup(mode = 'free', { optimistic = false } = {}) {
  const code = await loadCode(mode === 'paid')
  const routes = buildRoutes(code)
  const capacity = buildCapacity({ limits: code.limits, paid: mode === 'paid' })
  const alias = optimistic ? {} : mode === 'dec1' || mode === 'paid' ? GOOGLE_ROUTES.dec1 : GOOGLE_ROUTES.now
  return { code, routes, capacity, alias }
}

const fmt = (x) => (x === Infinity ? '∞' : x >= 100 ? Math.round(x).toLocaleString('ru-RU') : (Math.round(x * 10) / 10).toString().replace('.', ','))
const pct = (x) => `${Math.round(x * 100)} %`

function report(users, mode, opts) {
  const { routes, capacity, alias } = opts
  const n = Math.round(users.teacher + users.student + users.solo)
  const demand = dailyDemand(users, routes)
  const { perKey, perModel } = simulateDay({ demand, routes, capacity, alias })
  const out = []
  out.push(`## ${n} пользователей, режим ${mode}${opts.optimistic ? ' (своя квота у переадресованных)' : ''}`)
  out.push('')
  out.push(`Учителей ${fmt(users.teacher)}, учеников репетиторов ${fmt(users.student)}, одиночек ${fmt(users.solo)}; ` +
    `активны в день ${pct(ACTIVE_SHARE.teacher)} / ${pct(ACTIVE_SHARE.student)} / ${pct(ACTIVE_SHARE.solo)}.`)
  out.push('')
  out.push('| Задача | Спрос в сутки | Без ответа | Первый отказ (Алматы) | Кто ответил |')
  out.push('|---|---|---|---|---|')
  for (const [key, r] of Object.entries(perKey)) {
    if (r.demand < 0.05) continue
    const who = Object.entries(r.byModel)
      .filter(([, x]) => x >= 0.5)
      .sort((a, b) => b[1] - a[1])
      .map(([m, x]) => `${m} ${fmt(x)}`)
      .join(', ')
    out.push(`| ${key} | ${fmt(r.demand)} | ${pct(r.failed / r.demand)} | ${r.firstFail === null ? '—' : almatyClock(r.firstFail)} | ${who || '—'} |`)
  }
  out.push('')
  out.push('| Модель | Запросов | Лимит в сутки | Кончилась (Алматы) | Пик в минуту / RPM | Токенов (сек.) / в сутки |')
  out.push('|---|---|---|---|---|---|')
  for (const [m, r] of Object.entries(perModel)) {
    if (r.requests < 0.5 && !alias[m]) continue
    const c = capacity[m]
    const used = alias[m] ? `→ счётчик ${alias[m]}` : fmt(r.requests)
    out.push(`| ${m} | ${used} | ${fmt(c.rpd)} | ${r.exhaustedAt === null ? '—' : almatyClock(r.exhaustedAt)} | ${fmt(r.peakRpm)} / ${fmt(c.rpm)} | ${c.tpd === Infinity ? '—' : `${fmt(r.units)} / ${fmt(c.tpd)}`} |`)
  }
  if (mode === 'paid') {
    const usd = paidCost(perKey)
    out.push('')
    out.push(`Платный Gemini: ~$${fmt(usd)} в сутки, ~$${fmt(usd * 30)} в месяц (Groq и Whisper — бесплатный тир).`)
  }
  return { text: out.join('\n'), perKey }
}

function breaks(opts, label) {
  const tasks = [...new Set(Object.keys(opts.routes).map(taskOf))]
  const cache = new Map()
  const rows = tasks.map((t) => [t, breakUsers(t, { ...opts, cache })])
  rows.sort((a, b) => (a[1] ?? 1e9) - (b[1] ?? 1e9))
  return [`| Задача | Ломается (>5 % без ответа) при — ${label} |`, '|---|---|', ...rows.map(([t, n]) => `| ${t} | ${n === null ? 'не до 2000' : `${n} польз.`} |`)].join('\n')
}

// ---- запуск ---------------------------------------------------------------------------
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('capacity-forecast.mjs')
if (isMain) {
  const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def
  const n = Number(arg('users', String(BASE.teacher + BASE.student + BASE.solo)))
  // своя студия вместо пропорции BASE: --teachers=1 --students=10 [--solo=0]
  const own = ['teachers', 'students', 'solo'].some((k) => arg(k, null) !== null)
  const users = own
    ? { teacher: Number(arg('teachers', '0')), student: Number(arg('students', '0')), solo: Number(arg('solo', '0')) }
    : usersFor(n)
  const mode = arg('mode', 'free')
  if (!['free', 'dec1', 'paid'].includes(mode)) throw new Error(`--mode: free | dec1 | paid, а не ${mode}`)
  const optimistic = process.argv.includes('--optimistic')
  const opts = { ...(await setup(mode, { optimistic })), optimistic }
  console.log(report(users, mode, opts).text)
  if (own) process.exit(0)
  console.log('')
  console.log(breaks(opts, `${mode}${optimistic ? ', своя квота' : ''}`))
  if (mode === 'paid') {
    console.log('')
    console.log('| Пользователей | $ в сутки | $ в месяц |')
    console.log('|---|---|---|')
    for (const k of [25, 50, 100, 200, 400]) {
      const { perKey } = simulateDay({ demand: dailyDemand(usersFor(k), opts.routes), ...opts })
      const usd = paidCost(perKey)
      console.log(`| ${k} | ${fmt(usd)} | ${fmt(usd * 30)} |`)
    }
  } else {
    const { perKey } = simulateDay({ demand: dailyDemand(usersFor(n), opts.routes), ...opts })
    console.log('')
    console.log(`Диалог без ответа при ${n}: ${pct(failShare(perKey, 'dialog'))}`)
  }
}
