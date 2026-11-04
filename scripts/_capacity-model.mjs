/**
 * Модель нагрузки на AI (PLAN.md Ф2.12): сколько запросов за сутки Google
 * придёт к каждой модели при N пользователях, кто из них откажет и в котором
 * часу. Чистая — без сети и базы. Цепочки моделей, задачи и лимиты приходят
 * ПАРАМЕТРОМ из кода (`capacity-forecast.mjs` и `test-capacity.mjs` берут их
 * из api/ и src/domains/ai/limits.ts); здесь — только допущения об активности
 * и арифметика. Отчёт с числами — docs/capacity-2026-11.md.
 *
 * ⚠️ Допущения — оценки, а не замеры: журнала вызовов (ai_call_log) у
 * расчёта нет. Каждое число ниже подписано; заменить замером — правка здесь,
 * а отчёт пересобирает `node scripts/capacity-forecast.mjs`.
 */

// ---- кто пользователи -----------------------------------------------------------------
/** Цель «15 учителей × 5–10 учеников» (журнал п.12) + одиночки с лендинга до 200. */
export const BASE = { teacher: 15, student: 150, solo: 35 }

/** Доля зарегистрированных, кто занимается в обычный день (допущение). */
export const ACTIVE_SHARE = { student: 0.6, teacher: 0.9, solo: 0.3 }

/**
 * Запросов в день на ОДНОГО активного — по задачам сервера (AiTask) и речи.
 * Допущения: ученик репетитора — домашка + 2 урока в неделю; потолок — пул
 * ⚡ студии (Start 110 в день на 10 мест, под-кап ученика 55). Одиночка —
 * Free, 5 ⚡ в день. У задачи, которой роль не пользуется, — 0: новая задача
 * без строки здесь сделает test-capacity красным.
 */
export const PER_ACTIVE = {
  student: {
    dialog: 6, quest: 2, analyze: 1, writing: 0.3, review: 0, word: 15, definition: 2, speech: 6,
    homework: 0, material: 0, material_plan: 0, material_replan: 0, program: 0, exercise_swap: 0, self_material: 0,
  },
  teacher: {
    dialog: 0, quest: 0, analyze: 0, writing: 0, review: 3, word: 5, definition: 0, speech: 0,
    homework: 1, material: 0.5, material_plan: 0.5, material_replan: 0.3, program: 0.1, exercise_swap: 5, self_material: 0,
  },
  solo: {
    dialog: 3, quest: 0.5, analyze: 0.3, writing: 0.1, review: 0, word: 10, definition: 1, speech: 4,
    homework: 0, material: 0, material_plan: 0, material_replan: 0, program: 0, exercise_swap: 0, self_material: 0,
  },
}

/** Из замен упражнений — доля сильных (лимит базы 5 из 25 в сутки, допущение — 20 %). */
export const STRONG_SWAP_SHARE = 0.2

/**
 * Токены запроса: вход / выход (Groq: TPM и TPD; платный Gemini: деньги).
 * Источник — docs/energy-design.md §4 «типичные замеры»; у Диалога вход
 * поднят до 2500 (20 реплик истории + инструкция ~4 тыс. знаков); у речи —
 * секунды аудио (Whisper считает их, ASH/ASD). Дополнить локально: AI Studio
 * → Usage, токены ÷ запросы по модели.
 */
export const TOKENS = {
  word: [250, 60], definition: [250, 60], dialog: [2500, 350], quest: [700, 200], analyze: [500, 500],
  writing: [3900, 1300], review: [1500, 600], homework: [2000, 800], material_plan: [1500, 1000],
  material: [4000, 4500], material_replan: [1500, 1000], program: [2500, 3000], self_material: [4000, 4500],
  exercise_swap: [1200, 400], speech: [6, 0],
}
/** «Размышления» gpt-oss (reasoning_effort low) — к выходу, токенов (допущение). */
export const GROQ_REASONING = 100
/** «Размышления» Gemini у standard/max (_geminiBody не выключает) — множитель выхода (допущение). */
export const THINKING_X = 2

/**
 * Доля суточных запросов по часам Алматы (0…23): вечер после школы и работы
 * — пик 19–21 (допущение; у всех ролей одна кривая).
 */
export const HOURLY = [1, 0.5, 0.2, 0.1, 0.1, 0.2, 0.5, 1.5, 2, 3, 3.5, 3.5, 3.5, 4, 4.5, 5.5, 6.5, 7, 8, 9, 9.5, 8.5, 6, 3]

/**
 * Сутки Google начинаются в полночь по Тихоокеанскому — в Алматы (UTC+5)
 * это 13:00 зимой (PST, с 01.11.2026) и 12:00 летом (PDT). Квота, кончившаяся
 * вечером, вернётся только к обеду следующего дня.
 */
export const GOOGLE_DAY_START_ALMATY = 13

// ---- лимиты сверх src/domains/ai/limits.ts ------------------------------------------
/** Токены и аудио Groq: console.groq.com/docs/rate-limits, 04.11.2026 (страница зовёт их «base limits for the Developer plan» — свои числа: console.groq.com/settings/limits, дополнить локально). */
export const GROQ_UNITS = {
  'openai/gpt-oss-20b': { tpm: 8_000, tpd: 200_000 },
  'openai/gpt-oss-120b': { tpm: 8_000, tpd: 200_000 },
  'whisper-large-v3-turbo': { tpm: 7_200 / 60, tpd: 28_800 }, // секунды аудио: ASH 7200, ASD 28 800
}

/** Бесплатно у модели ноль (в limits.ts — null, «число после платного»). */
export const FREE_ZERO = ['gemini-3.1-pro-preview']

/**
 * Переадресация Google (aistudio.google.com/docs/deprecations, 04.11.2026):
 * запрос к 3.5-flash уже уходит в 3.6-flash; к 2.5-flash с 01.12.2026 —
 * в 3.5-flash-lite. Чей счётчик квоты растёт, Google не пишет — `shared`
 * считает худшее: общий с моделью, куда переадресовано.
 */
export const GOOGLE_ROUTES = {
  now: { 'gemini-3.5-flash': 'gemini-3.6-flash' },
  dec1: { 'gemini-3.5-flash': 'gemini-3.6-flash', 'gemini-2.5-flash': 'gemini-3.5-flash-lite' },
}

/** Цены платного Gemini, $ за 1 млн токенов вход / выход (aistudio.google.com/docs/pricing, 04.11.2026). */
export const PRICE = {
  'gemini-3.6-flash': [0.75, 3.75], // акция до 31.12.2026; с 01.01.2027 — 1,50 / 7,50
  'gemini-3.5-flash': [0.75, 3.75], // переадресована в 3.6-flash — считаем по её цене (допущение)
  'gemini-2.5-flash': [0.3, 2.5], // с 01.12.2026 — в 3.5-flash-lite по её цене (та же)
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.1-flash-lite': [0.25, 1.5],
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-3.1-pro-preview': [2, 12],
}

// ---- маршруты: что зовёт задача (повторяет api/gemini.ts) ------------------------------
/** Цепочка без повторов: [первая, ...запасные], как `chain` в callGemini. */
const dedupe = (list) => list.filter((m, i) => list.indexOf(m) === i)

/**
 * Ключ спроса → цепочка моделей. Правила — из api/gemini.ts:
 *  • lite — Groq fast первым, затем Gemini lite;
 *  • dialog — поток: только Gemini standard, Groq у потока НЕТ;
 *  • exercise_swap — своя ступень (SWAP_CHAINS), без Groq;
 *  • прочие standard/max — Gemini своего уровня, затем Groq last;
 *  • speech — Whisper, без запасных.
 */
export function buildRoutes({ tasks, chains, swapChains, groq, stt }) {
  const routes = {}
  for (const [task, spec] of Object.entries(tasks)) {
    if (spec.swap) {
      routes[`${task}:light`] = dedupe([...swapChains.light])
      routes[`${task}:strong`] = dedupe([...swapChains.strong])
    } else if (spec.tier === 'lite') routes[task] = dedupe([groq.fast, ...chains.lite])
    else if (task === 'dialog') routes[task] = dedupe([...chains[spec.tier]])
    else routes[task] = dedupe([...chains[spec.tier], groq.last])
  }
  routes.speech = [stt]
  return routes
}

/** Задача по ключу спроса («exercise_swap:strong» → «exercise_swap»). */
export const taskOf = (key) => key.split(':')[0]

/**
 * Лимиты моделей для расчёта: requests (RPD/RPM из limits.ts) + units (токены
 * или секунды Groq). paid — платный Gemini: квоты в сутки нет (ограничение —
 * деньги и RPM тира, его Google не публикует — смотреть в AI Studio).
 */
export function buildCapacity({ limits, paid = false }) {
  const cap = {}
  for (const [model, l] of Object.entries(limits)) {
    const gemini = model.startsWith('gemini') || model.startsWith('gemma')
    const zero = !paid && FREE_ZERO.includes(model)
    const unlimitedGemini = paid && gemini && !model.startsWith('gemma')
    cap[model] = {
      rpd: zero ? 0 : unlimitedGemini ? Infinity : (l.rpd ?? Infinity),
      rpm: zero ? 0 : unlimitedGemini ? Infinity : (l.rpm ?? Infinity),
      tpd: GROQ_UNITS[model]?.tpd ?? Infinity,
      tpm: GROQ_UNITS[model]?.tpm ?? Infinity,
    }
  }
  return cap
}

// ---- спрос ----------------------------------------------------------------------------
/** Пользователи сценария: N в пропорции BASE (дробные — модель «жидкая»). */
export function usersFor(n, base = BASE) {
  const total = base.teacher + base.student + base.solo
  return { teacher: (n * base.teacher) / total, student: (n * base.student) / total, solo: (n * base.solo) / total }
}

/** Запросов в сутки по ключам маршрутов. */
export function dailyDemand(users, routes) {
  const out = Object.fromEntries(Object.keys(routes).map((k) => [k, 0]))
  for (const role of Object.keys(PER_ACTIVE)) {
    const active = (users[role] ?? 0) * ACTIVE_SHARE[role]
    for (const [task, perDay] of Object.entries(PER_ACTIVE[role])) {
      const n = active * perDay
      if (!n) continue
      if (`${task}:light` in routes) {
        out[`${task}:light`] += n * (1 - STRONG_SWAP_SHARE)
        out[`${task}:strong`] += n * STRONG_SWAP_SHARE
      } else if (task in routes) out[task] += n
      else throw new Error(`задача «${task}» в допущениях, но сервер её не знает`)
    }
  }
  return out
}

/** Единиц (токенов, секунд) на запрос к модели: Groq считает размышления, Whisper — секунды. */
export function unitsPerRequest(key, model) {
  const [inp, out] = TOKENS[taskOf(key)] ?? [0, 0]
  if (model.startsWith('whisper')) return inp
  return inp + out + (model.startsWith('openai/gpt-oss') ? GROQ_REASONING : 0)
}

// ---- сутки Google по минутам ----------------------------------------------------------
const HOUR_SUM = HOURLY.reduce((a, b) => a + b, 0)
/** Минута суток Google → час Алматы. */
export const almatyHour = (minute, start = GOOGLE_DAY_START_ALMATY) => (start + Math.floor(minute / 60)) % 24
/** Минута суток Google → «ЧЧ:ММ» по Алматы. */
export function almatyClock(minute, start = GOOGLE_DAY_START_ALMATY) {
  const m = (start * 60 + minute) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Сутки Google поминутно. Каждую минуту спрос каждого ключа идёт по своей
 * цепочке: модель берёт, сколько позволяют остаток суток (RPD, TPD) и минуты
 * (RPM, TPM); остальное — следующей модели, после последней — отказ человеку.
 * Отказ 429 квоту не тратит (так считает и Google, src/domains/ai/CLAUDE.md).
 * Делят модель пропорционально спросу. routesAlias — переадресация Google:
 * модель-ключ тратит счётчик модели-значения.
 */
export function simulateDay({ demand, routes, capacity, alias = {} }) {
  const counter = (m) => alias[m] ?? m
  const left = {}
  const usedReq = {}
  const usedUnits = {}
  const peakRpm = {}
  const exhaustedAt = {}
  for (const m of Object.keys(capacity)) {
    left[m] = { req: capacity[m].rpd, units: capacity[m].tpd }
    usedReq[m] = 0
    usedUnits[m] = 0
    peakRpm[m] = 0
  }
  const perKey = Object.fromEntries(
    Object.keys(routes).map((k) => [k, { demand: demand[k] ?? 0, served: 0, failed: 0, byModel: {}, firstFail: null }]),
  )
  const maxLen = Math.max(...Object.values(routes).map((r) => r.length))
  for (let minute = 0; minute < 1440; minute++) {
    const share = HOURLY[almatyHour(minute)] / HOUR_SUM / 60
    let pending = Object.fromEntries(Object.keys(routes).map((k) => [k, (demand[k] ?? 0) * share]))
    const minuteReq = {}
    const minuteUnits = {}
    for (let step = 0; step < maxLen; step++) {
      const next = {}
      const byCounter = {}
      for (const [key, amt] of Object.entries(pending)) {
        if (amt <= 1e-12) continue
        const model = routes[key][step]
        if (!model) {
          perKey[key].failed += amt
          if (perKey[key].firstFail === null && perKey[key].failed > 0.5) perKey[key].firstFail = minute
          continue
        }
        const c = counter(model)
        if (!capacity[c]) throw new Error(`нет лимитов у модели ${c}`)
        ;(byCounter[c] ??= []).push({ key, model, amt })
      }
      for (const [c, list] of Object.entries(byCounter)) {
        const cap = capacity[c]
        const reqRoom = Math.max(0, Math.min(left[c].req, cap.rpm - (minuteReq[c] ?? 0)))
        const unitRoom = Math.max(0, Math.min(left[c].units, cap.tpm - (minuteUnits[c] ?? 0)))
        const reqAsk = list.reduce((s, x) => s + x.amt, 0)
        const unitAsk = list.reduce((s, x) => s + x.amt * unitsPerRequest(x.key, x.model), 0)
        const ratio = Math.min(1, reqAsk ? reqRoom / reqAsk : 1, unitAsk ? unitRoom / unitAsk : 1)
        for (const x of list) {
          const served = x.amt * ratio
          const units = served * unitsPerRequest(x.key, x.model)
          perKey[x.key].served += served
          perKey[x.key].byModel[x.model] = (perKey[x.key].byModel[x.model] ?? 0) + served
          usedReq[c] += served
          usedUnits[c] += units
          left[c].req -= served
          left[c].units -= units
          minuteReq[c] = (minuteReq[c] ?? 0) + served
          minuteUnits[c] = (minuteUnits[c] ?? 0) + units
          if (x.amt - served > 1e-12) next[x.key] = (next[x.key] ?? 0) + (x.amt - served)
        }
        if (exhaustedAt[c] === undefined && (left[c].req < 0.5 || left[c].units < 1)) exhaustedAt[c] = minute
      }
      pending = next
    }
    for (const [key, amt] of Object.entries(pending)) {
      perKey[key].failed += amt
      if (perKey[key].firstFail === null && perKey[key].failed > 0.5) perKey[key].firstFail = minute
    }
    for (const [c, n] of Object.entries(minuteReq)) peakRpm[c] = Math.max(peakRpm[c], n)
  }
  const perModel = Object.fromEntries(
    Object.keys(capacity).map((m) => [m, { requests: usedReq[m], units: usedUnits[m], peakRpm: peakRpm[m], exhaustedAt: exhaustedAt[m] ?? null }]),
  )
  return { perKey, perModel }
}

/** Доля отказов задачи (по всем её ключам). */
export function failShare(perKey, task) {
  const keys = Object.keys(perKey).filter((k) => taskOf(k) === task)
  const d = keys.reduce((s, k) => s + perKey[k].demand, 0)
  return d ? keys.reduce((s, k) => s + perKey[k].failed, 0) / d : 0
}

/**
 * Наименьшее N (кратное step), при котором у задачи отказов больше threshold;
 * null — не до max. Спрос растёт с N, лимиты — нет, поэтому доля отказов не
 * убывает, и хватает двоичного поиска; расчёты по N кэшируются (cache — Map).
 */
export function breakUsers(task, { routes, capacity, alias, threshold = 0.05, step = 5, max = 2000, cache = new Map() }) {
  const fails = (n) => {
    if (!cache.has(n)) cache.set(n, simulateDay({ demand: dailyDemand(usersFor(n), routes), routes, capacity, alias }).perKey)
    return failShare(cache.get(n), task) > threshold
  }
  let lo = 0
  let hi = Math.floor(max / step)
  if (!fails(hi * step)) return null
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (fails(mid * step)) hi = mid
    else lo = mid
  }
  return hi * step
}

/** Деньги платного Gemini за сутки, $: ответившие модели × токены × цена (Groq и Whisper — бесплатный тир). */
export function paidCost(perKey) {
  let usd = 0
  for (const [key, r] of Object.entries(perKey)) {
    const [inp, out] = TOKENS[taskOf(key)] ?? [0, 0]
    for (const [model, n] of Object.entries(r.byModel)) {
      const p = PRICE[model]
      if (!p) continue
      // lite (перевод слова, определение) — без «размышлений», остальные — с ними
      const thinking = ['word', 'definition'].includes(taskOf(key)) ? 1 : THINKING_X
      usd += (n * (inp * p[0] + out * thinking * p[1])) / 1e6
    }
  }
  return usd
}
