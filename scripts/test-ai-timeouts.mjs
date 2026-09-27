/**
 * Чистый тест: у каждого запроса из api/ к внешним сервисам есть срок
 * (PLAN.md Ф1.10).
 *
 * 27.09.2026 сторож прода получил 504: поставщик AI завис, функция ждала до
 * обрыва Vercel (maxDuration), запасные модели не спрашивались, энергия не
 * возвращалась. Здесь подставной fetch «зависает» так же, как настоящий:
 * соединение висит, пока его не оборвут отменой (AbortSignal).
 *
 * Проверяем обе стороны:
 *   • зависла одна модель — цепочка идёт дальше и отвечает;
 *   • зависло всё — отказ и возврат энергии РАНЬШЕ maxDuration;
 *   • обычные ответы, 429 и 503 ведут себя как раньше;
 *   • в api/ нет голого fetch( — только через api/_timeouts.ts.
 * Сроки передаются параметром (handle(req, res, сроки)), поэтому весь прогон
 * занимает секунды. Без сети, базы и ключей.
 * Запуск: node scripts/test-ai-timeouts.mjs
 */
import { registerHooks } from 'node:module'
import { readdirSync, readFileSync } from 'node:fs'

// api/*.ts импортируют друг друга с расширением .js (так требует Vercel в
// ESM), а Node со срезом типов ищет файл буквально — подставляем .ts.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (e) {
      if (specifier.startsWith('.') && specifier.endsWith('.js')) {
        return nextResolve(specifier.slice(0, -3) + '.ts', context)
      }
      throw e
    }
  },
})

const SB = 'https://sb.test'
process.env.VITE_SUPABASE_URL = SB
process.env.VITE_SUPABASE_ANON_KEY = 'anon'
process.env.GEMINI_API_KEY = 'gemini-key'
process.env.GROQ_API_KEY = 'groq-key'
delete process.env.RECALL_CHEAP_MODELS

// --- подставной fetch ---------------------------------------------------------

let plan = {}
let log = []
let t0 = 0
const now = () => Date.now() - t0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const enc = new TextEncoder()

const json = (status, obj) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

/** Зависший поставщик: ответа нет, пока соединение не оборвут отменой. */
const hang = (signal) =>
  new Promise((_, reject) => {
    signal?.addEventListener(
      'abort',
      () => reject(new DOMException('The operation was aborted.', 'AbortError')),
      { once: true },
    )
  })

/** Заголовки пришли, а тело — никогда, и отмену оно не слушает (худший случай). */
const endless = (parts = []) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const p of parts) c.enqueue(enc.encode(p))
      },
    }),
    { status: 200 },
  )

const sse = (text, stop) =>
  `data: ${JSON.stringify({
    candidates: [{ content: { parts: [{ text }] }, ...(stop ? { finishReason: 'STOP' } : {}) }],
  })}\n\n`

const answerOf = (model) => `ответ ${model}`

function geminiReply(kind, signal, model) {
  if (kind === 'hang') return hang(signal)
  if (kind === 'hang-body') return endless()
  if (typeof kind === 'number') return json(kind, { error: { message: `status ${kind}` } })
  return json(200, {
    candidates: [{ content: { parts: [{ text: answerOf(model) }] }, finishReason: 'STOP' }],
  })
}

function streamReply(kind, signal, model) {
  if (kind === 'hang') return hang(signal)
  if (typeof kind === 'number') return json(kind, { error: { message: `status ${kind}` } })
  if (kind === 'no-text') return endless()
  if (kind === 'stall') return endless([sse('Hola, ')])
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(sse('Hola, ')))
        c.enqueue(enc.encode(sse(answerOf(model), true)))
        c.close()
      },
    }),
    { status: 200 },
  )
}

const countCalls = (re) => log.filter((c) => re.test(c.url)).length

globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const { signal } = init
  const nth = (re) => countCalls(re) // сколько раз этот адрес уже звали
  const entry = { url, at: now(), signal, body: init.body }
  const model = url.match(/models\/([^:]+):/)?.[1]

  if (url === `${SB}/rest/v1/rpc/spend_energy`) {
    log.push(entry)
    return plan.spend === 'hang' ? hang(signal) : new Response('null', { status: 200 })
  }
  if (url === `${SB}/rest/v1/rpc/refund_ai_call`) {
    log.push(entry)
    return new Response('true', { status: 200 })
  }
  if (url === `${SB}/auth/v1/user`) {
    log.push(entry)
    return plan.supabaseRead === 'hang' ? hang(signal) : json(200, { id: 'u1' })
  }
  if (url.startsWith(`${SB}/rest/v1/profiles`)) {
    log.push(entry)
    return plan.supabaseRead === 'hang' ? hang(signal) : json(200, [{ role: 'teacher' }])
  }
  if (url.includes(':generateContent')) {
    const n = nth(new RegExp(`models/${model}:generateContent`))
    log.push(entry)
    return geminiReply(plan.gemini(model, n), signal, model)
  }
  if (url.includes(':streamGenerateContent')) {
    const n = nth(new RegExp(`models/${model}:streamGenerateContent`))
    log.push(entry)
    return streamReply(plan.stream(model, n), signal, model)
  }
  if (url.endsWith('/chat/completions')) {
    log.push(entry)
    if (plan.groq === 'hang') return hang(signal)
    if (typeof plan.groq === 'number') return json(plan.groq, { error: { message: 'groq' } })
    return json(200, { choices: [{ message: { content: 'ответ groq' } }] })
  }
  if (url.endsWith('/audio/transcriptions')) {
    log.push(entry)
    return plan.stt === 'hang' ? hang(signal) : json(200, { text: 'hello' })
  }
  throw new Error(`тест не ждал запроса ${url}`)
}

// --- подставные req/res ---------------------------------------------------------

const makeReq = (body) => ({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body })

function makeRes() {
  const r = { code: 200, payload: undefined, chunks: [], ended: false, destroyed: false, at: null }
  const done = () => {
    r.at ??= now()
  }
  r.status = (c) => ((r.code = c), r)
  r.json = (p) => ((r.payload = p), (r.ended = true), done(), r)
  r.setHeader = () => r
  r.write = (c) => (r.chunks.push(String(c)), true)
  r.end = () => ((r.ended = true), done(), r)
  r.destroy = () => ((r.destroyed = true), done(), r)
  return r
}

// --- сроки теста: те же пути, что в проде, только в миллисекундах ----------------

const FN = 1000 // «maxDuration» функции в тесте
const T = {
  functionMs: FN,
  safetyMs: 50,
  supabaseMs: 80,
  groqMs: 120,
  sttMs: 150,
  attemptMs: { lite: 100, standard: 150, max: 150 },
  minAttemptMs: 20,
  firstTextMs: 150,
  idleMs: 100,
}
const WATCHDOG = FN + 1500 // дольше — функцию уже оборвал бы Vercel

const gemini = await import('../api/gemini.ts')
const transcribe = await import('../api/transcribe.ts')
const { GEMINI_TIER_CHAINS } = await import('../api/_core.ts')
const aiApi = gemini.handle ?? ((req, res) => gemini.default(req, res))
const sttApi = transcribe.handle ?? ((req, res) => transcribe.default(req, res))

const M = [{ role: 'user', content: 'hi' }]
const LITE = GEMINI_TIER_CHAINS.lite
const STD = GEMINI_TIER_CHAINS.standard

/** Вместо сроков теста — сроки прода: обработчик зовётся без третьего параметра. */
const PROD = null

async function scenario(handler, body, planOverride = {}, limits = T) {
  plan = {
    spend: 'ok',
    gemini: () => 'hang',
    stream: () => 'hang',
    groq: 'hang',
    stt: 'hang',
    ...planOverride,
  }
  log = []
  t0 = Date.now()
  const res = makeRes()
  const outcome = await Promise.race([
    Promise.resolve(
      limits === PROD ? handler(makeReq(body), res) : handler(makeReq(body), res, limits),
    ).then(
      () => 'done',
      (e) => `бросила: ${e?.message ?? e}`,
    ),
    sleep(WATCHDOG).then(() => 'hung'),
  ])
  const refunds = log.filter((c) => c.url.endsWith('/rpc/refund_ai_call'))
  return { res, outcome, refunds, finished: now() }
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const describe = (s) =>
  s.outcome === 'hung'
    ? `функция висит дольше ${WATCHDOG} мс — Vercel оборвал бы её на ${FN}`
    : `исход ${s.outcome}, код ${s.res.code}, ответ ${JSON.stringify(s.res.payload ?? s.res.chunks)}, ` +
      `возвратов ${s.refunds.length}, закончила на ${s.res.at ?? s.finished} мс`
const inTime = (s, fn = FN) => s.outcome === 'done' && (s.res.at ?? s.finished) < fn
const refundedInTime = (s, fn = FN) =>
  s.refunds.length === 1 && s.refunds[0].at < fn && inTime(s, fn)

// --- 1. перевод слова: ровно запрос сторожа 27.09 -----------------------------------
console.log('\n— перевод слова (task word: сначала Groq, потом Gemini-lite)')
{
  const s = await scenario(aiApi, { task: 'word', messages: M }, {
    groq: 'hang',
    gemini: (m) => (m === LITE[0] ? 'ok' : 'hang'),
  })
  check('Groq завис → ответила Gemini-lite', s.res.code === 200 && s.res.payload?.text === answerOf(LITE[0]), describe(s))
  const groq = log.find((c) => c.url.endsWith('/chat/completions'))
  check('зависший запрос к Groq оборван, а не брошен висеть', groq?.signal?.aborted === true)
  check('энергию не возвращали — ответ доставлен', inTime(s) && s.refunds.length === 0, describe(s))
}
{
  const s = await scenario(aiApi, { task: 'word', messages: M })
  check('зависло всё → отказ и возврат раньше maxDuration', s.res.code === 502 && refundedInTime(s), describe(s))
  const asked = LITE.filter((m) => countCalls(new RegExp(`models/${m}:generateContent`)) > 0)
  check('спрошена вся цепочка lite, а не только первая модель', asked.length === LITE.length, `спрошены: ${asked.join(', ')}`)
}

// --- 2. обычные задачи: цепочка Gemini + Groq последним рубежом --------------------
console.log('\n— обычные задачи (цепочка Gemini, затем Groq)')
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, {
    gemini: (m) => (m === STD[0] ? 'hang' : 'ok'),
  })
  check('первая модель зависла → ответила вторая', s.res.code === 200 && s.res.payload?.text === answerOf(STD[1]), describe(s))
  const first = log.find((c) => c.url.includes(`models/${STD[0]}:`))
  check('запрос к зависшей модели оборван', first?.signal?.aborted === true)
  check('без возврата — ответ доставлен', inTime(s) && s.refunds.length === 0, describe(s))
}
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, {
    gemini: (m) => (m === STD[0] ? 'hang-body' : 'ok'),
  })
  check('заголовки пришли, тело зависло → тоже следующая модель', s.res.code === 200 && s.res.payload?.text === answerOf(STD[1]), describe(s))
}
{
  const s = await scenario(aiApi, { task: 'writing', messages: M }, { groq: 'ok' })
  check('вся цепочка Gemini зависла → ответил Groq', s.res.code === 200 && s.res.payload?.text === 'ответ groq', describe(s))
  check('без возврата — ответ доставлен', inTime(s) && s.refunds.length === 0, describe(s))
}
{
  const s = await scenario(aiApi, { task: 'writing', messages: M })
  check('зависло всё, включая Groq → отказ и возврат раньше maxDuration', s.res.code === 502 && refundedInTime(s), describe(s))
  check('Groq спрошен', inTime(s) && countCalls(/chat\/completions/) === 1)
}
{
  // Окно одной модели шире, чем вся цепочка: спасает только общий срок.
  const wide = { ...T, attemptMs: { ...T.attemptMs, standard: 600 } }
  const s = await scenario(aiApi, { task: 'writing', messages: M }, {}, wide)
  check('общий срок цепочки держит время для Groq и возврата', countCalls(/chat\/completions/) === 1 && refundedInTime(s), describe(s))
}
{
  // Pro-модели учителя: проверка роли — тоже запрос в Supabase.
  const s = await scenario(aiApi, { task: 'material', messages: M }, { supabaseRead: 'hang' })
  check(
    'Supabase завис на проверке роли → 503 «недоступен», а не «только преподавателю»',
    s.res.code === 503 && inTime(s),
    describe(s),
  )
  check('энергию при этом не списывали', inTime(s) && countCalls(/rpc\/spend_energy/) === 0)
}

// --- 3. списание энергии -------------------------------------------------------------
console.log('\n— списание энергии (Supabase)')
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, { spend: 'hang' })
  check('Supabase завис на списании → 503, а не «требуется вход»', s.res.code === 503 && inTime(s), describe(s))
  check('модели не спрашивали — доступ не подтверждён', inTime(s) && countCalls(/generativelanguage|groq/) === 0)
  const spent = log.find((c) => c.url.endsWith('/rpc/spend_energy'))
  const nonce = spent && JSON.parse(spent.body).p_nonce
  check(
    'списание могло пройти на той стороне → возврат по тому же номеру',
    s.refunds.length === 1 && JSON.parse(s.refunds[0].body ?? '{}').p_nonce === nonce,
    describe(s),
  )
}

// --- 4. потоковый «Диалог» -------------------------------------------------------------
console.log('\n— потоковый «Диалог»')
const streamBody = { task: 'dialog', messages: M, stream: true }
{
  const s = await scenario(aiApi, streamBody, { stream: (m) => (m === STD[0] ? 'hang' : 'ok') })
  const text = s.res.chunks.join('')
  check('первая модель зависла до заголовков → поток от второй', s.res.code === 200 && text === `Hola, ${answerOf(STD[1])}`, describe(s))
  check('поток закрыт чисто, без возврата', s.res.ended && !s.res.destroyed && s.refunds.length === 0, describe(s))
}
{
  const s = await scenario(aiApi, streamBody, { stream: (m) => (m === STD[0] ? 'no-text' : 'ok') })
  check('заголовки есть, слов нет → следующая модель', s.res.code === 200 && s.res.chunks.join('').endsWith(answerOf(STD[1])), describe(s))
}
{
  const s = await scenario(aiApi, streamBody, { stream: () => 'stall' })
  check('поток встал на середине → возврат раньше maxDuration', refundedInTime(s), describe(s))
  check(
    'соединение оборвано, а не закрыто чисто — иначе клиент примет обрывок за целый ответ',
    s.res.destroyed && !s.res.ended,
    describe(s),
  )
}
{
  const s = await scenario(aiApi, streamBody)
  check('в потоке зависли все модели → отказ JSON и возврат', s.res.code === 502 && refundedInTime(s), describe(s))
}

// --- 5. распознавание речи ---------------------------------------------------------------
console.log('\n— распознавание речи (/api/transcribe)')
{
  const FN_STT = 600
  const s = await scenario(sttApi, { audio: 'aGVsbG8=', mime: 'audio/webm', lang: 'en' }, {}, { ...T, functionMs: FN_STT })
  check('Whisper завис → отказ и возврат раньше maxDuration', s.res.code === 502 && refundedInTime(s, FN_STT), describe(s))
}

// --- 6. обычное поведение не изменилось (сроки прода) -----------------------------------
console.log('\n— без зависаний всё как раньше (сроки прода)')
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, { gemini: () => 'ok' }, PROD)
  check('обычный ответ: первая модель, один запрос, без возврата',
    s.res.code === 200 && s.res.payload?.text === answerOf(STD[0]) && countCalls(/generativelanguage/) === 1 && s.refunds.length === 0,
    describe(s))
}
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, { gemini: (m) => (m === STD[0] ? 429 : 'ok') }, PROD)
  check('429 → сразу следующая модель',
    s.res.payload?.text === answerOf(STD[1]) && countCalls(new RegExp(`models/${STD[0]}:`)) === 1,
    describe(s))
}
{
  const s = await scenario(aiApi, { task: 'dialog', messages: M }, { gemini: (m, n) => (n === 0 ? 503 : 'ok') }, PROD)
  check('503 → повтор той же модели после паузы',
    s.res.payload?.text === answerOf(STD[0]) && countCalls(new RegExp(`models/${STD[0]}:`)) === 2,
    describe(s))
}
{
  const s = await scenario(aiApi, { task: 'word', messages: M }, { groq: 429, gemini: () => 429 }, PROD)
  check('все 429 → «общий дневной запас» (429) и возврат',
    s.res.code === 429 && /общий дневной запас/.test(s.res.payload?.error ?? '') && s.refunds.length === 1,
    describe(s))
}
{
  const s = await scenario(aiApi, streamBody, { stream: () => 'ok' }, PROD)
  check('поток без сбоев: текст целиком, чистое закрытие, без возврата',
    s.res.chunks.join('') === `Hola, ${answerOf(STD[0])}` && s.res.ended && !s.res.destroyed && s.refunds.length === 0,
    describe(s))
}

// --- 7. класс закрыт: новый голый fetch в api/ не пройдёт ----------------------------
console.log('\n— запросы наружу только через api/_timeouts.ts')
{
  const dir = new URL('../api/', import.meta.url)
  const raw = []
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== '_timeouts.ts')) {
    readFileSync(new URL(f, dir), 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '').trim()
        if (code.startsWith('*') || code.startsWith('/*')) return
        if (/\bfetch\(/.test(code)) raw.push(`${f}:${i + 1}`)
      })
  }
  check('в api/ нет голого fetch( — каждый запрос наружу со сроком', raw.length === 0, raw.join(', '))
}

const failed = results.filter((ok) => !ok).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exit(failed ? 1 : 0)
