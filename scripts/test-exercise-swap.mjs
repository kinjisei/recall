/**
 * Чистый тест: замена упражнения через AI (PLAN.md Ф2.25-4а, миграция 0019,
 * api/_swap.ts, api/_exerciseShape.ts, domains/materials/swap.ts).
 *
 * Держит:
 *   1. замена — spend_exercise_swap, а не spend_energy: ни энергии, ни
 *      генерации; в ответе — сколько замен осталось;
 *   2. вид → ступень: каверзные True / False и «Собери предложение» —
 *      сильная (3.5-flash первой), остальное — лёгкая (3.5-flash-lite); без
 *      Groq; правило сильных у клиента = у сервера;
 *   3. неизвестный вид или «каверзные» не флагом — 400 до списания;
 *      ученик — 403 до списания;
 *   4. 26-я за сутки — 409 RECALL_SWAP_LIMIT, 6-я сильная — 409
 *      RECALL_SWAP_STRONG_LIMIT, модель не зовём; функции нет — AI закрыт;
 *   5. ответ не упражнение (текст, два упражнения, чужой вид) — 422
 *      RECALL_SWAP_SHAPE, и замена НЕ возвращается;
 *   6. модель не ответила — замена возвращается тем же refund_ai_call;
 *   7. лимиты 25 / 5 и список видов — одни у клиента, сервера и базы;
 *   8. разбор ответа клиентом (readSwap): одно, нужного вида, прошло фильтр.
 * Без сети, базы и ключей. Запуск: node scripts/test-exercise-swap.mjs
 */
// клиентский код (каталог, промпты) — импорты без расширения: загрузчик проверок AI их понимает
import './ai-quality/loader.mjs'
import { readFileSync } from 'node:fs'

const SB = 'https://sb.test'
process.env.VITE_SUPABASE_URL = SB
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
process.env.GEMINI_API_KEY = 'gemini-key'
process.env.GROQ_API_KEY = 'groq-key' // есть, но замене он не нужен: её на Groq не мерили
delete process.env.RECALL_CHEAP_MODELS

const MCQ = { kind: 'comprehension', type: 'mcq', prompt: 'How long did Dana have for her next flight?', options: ['Thirty minutes', 'Forty minutes', 'Three hours', 'One hour'], answer: 1 }
const ONE = JSON.stringify({ exercises: [MCQ] })
const TEXT = 'Конечно! Вот перевод вашего письма на английский: Dear John, …'

let stub = {}
let log = []
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const body = init.body ? JSON.parse(init.body) : null
  log.push({ url, body })
  if (url === `${SB}/auth/v1/user`) return json(200, { id: 'u1' })
  if (url.startsWith(`${SB}/rest/v1/profiles`)) return json(200, [{ role: stub.role ?? 'teacher' }])
  if (url === `${SB}/rest/v1/rpc/spend_energy`) return new Response('null', { status: 200 })
  if (url === `${SB}/rest/v1/rpc/spend_exercise_swap`) return stub.spend ?? json(200, [{ swaps_left: 24, strong_left: body?.p_strong ? 4 : 5 }])
  if (url === `${SB}/rest/v1/rpc/refund_ai_call`) return new Response('true', { status: 200 })
  if (url === `${SB}/rest/v1/rpc/log_ai_call`) return new Response('true', { status: 200 })
  if (url.includes('api.groq.com')) throw new Error('замена ушла в Groq')
  if (url.includes(':generateContent')) {
    if (stub.gemini === 'fail') return json(500, { error: { message: 'down' } })
    // квота кончилась только у первой модели — цепочка обязана перейти к следующей
    if (stub.gemini === 'quota' && url.includes('gemini-3.5-flash:')) return json(429, { error: { message: 'quota' } })
    return json(200, { candidates: [{ content: { parts: [{ text: stub.text ?? ONE }] }, finishReason: 'STOP' }] })
  }
  throw new Error(`тест не ждал запроса ${url}`)
}

const gemini = await import('../api/gemini.ts')
const { isExerciseShaped } = await import('../api/_exerciseShape.ts')
const server = await import('../api/_swap.ts')
const client = await import('../src/domains/materials/swap.ts')
const { FORMATS } = await import('../src/lib/exerciseFormats.ts')
const T = {
  functionMs: 1000, safetyMs: 50, supabaseMs: 80, logMs: 60, groqMs: 120, sttMs: 150,
  attemptMs: { lite: 100, standard: 150, max: 150 }, minAttemptMs: 20, firstTextMs: 150, idleMs: 100,
}
const M = [{ role: 'user', content: 'замени упражнение' }]

async function call(body, s = {}) {
  stub = s
  log = []
  const res = { code: 200, payload: undefined }
  res.status = (c) => ((res.code = c), res)
  res.json = (p) => ((res.payload = p), res)
  res.setHeader = () => res
  await gemini.handle({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body }, res, T)
  const rpc = (name) => log.filter((c) => c.url.endsWith(`/rpc/${name}`))
  const refunded = rpc('refund_ai_call').length + rpc('log_ai_call').filter((c) => c.body?.p_refund).length
  const models = log.filter((c) => c.url.includes(':generateContent')).map((c) => c.url.match(/models\/([^:]+):/)?.[1])
  return { res, rpc, refunded, models }
}
const swap = (format, tricky = false) => ({ messages: M, task: 'exercise_swap', swap: { format, tricky } })

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — получено: ${JSON.stringify(got)}`}`)
}

// 1. замена — своё списание, без энергии и генерации
{
  const r = await call(swap('mcq'))
  check('1. замена — spend_exercise_swap, а не spend_energy', r.rpc('spend_exercise_swap').length === 1 && r.rpc('spend_energy').length === 0, r.rpc('spend_energy'))
  check('1. ответ — текст и сколько осталось', r.res.code === 200 && r.res.payload?.text === ONE && r.res.payload?.swaps?.left === 24 && r.res.payload?.swaps?.strongLeft === 5, r.res.payload)
}
// 2. вид → ступень
{
  const light = await call(swap('mcq'))
  check('2. «Выбери ответ» — лёгкая: 3.5-flash-lite, p_strong=false', light.models[0] === 'gemini-3.5-flash-lite' && light.rpc('spend_exercise_swap')[0]?.body?.p_strong === false, light.models)
  const tf = await call(swap('tfng', false), { text: JSON.stringify({ exercises: [{ kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana was happy.', options: ['True', 'False'], answer: 1 }] }) })
  check('2. обычные True / False — лёгкая', tf.models[0] === 'gemini-3.5-flash-lite', tf.models)
  const tricky = await call(swap('tfng', true), { text: JSON.stringify({ exercises: [{ kind: 'comprehension', type: 'mcq', format: 'tfng', prompt: 'Dana was happy.', options: ['True', 'False'], answer: 1 }] }) })
  check('2. каверзные True / False — сильная: 3.5-flash, p_strong=true', tricky.models[0] === 'gemini-3.5-flash' && tricky.rpc('spend_exercise_swap')[0]?.body?.p_strong === true, tricky.models)
  const order = await call(swap('order'), { text: JSON.stringify({ exercises: [{ kind: 'grammar', type: 'order', prompt: 'Я опоздала', words: ['missed', 'I', 'it'], answer: ['I', 'missed', 'it'] }] }) })
  check('2. «Собери предложение» — сильная', order.models[0] === 'gemini-3.5-flash', order.models)
  const fallback = await call(swap('order'), { gemini: 'quota', text: JSON.stringify({ exercises: [{ kind: 'grammar', type: 'order', prompt: 'Я опоздала', words: ['missed', 'I', 'it'], answer: ['I', 'missed', 'it'] }] }) })
  check('2. квота сильной кончилась — запасная 3.6-flash, а не Groq и не лёгкая', fallback.res.code === 200 && fallback.models.join() === 'gemini-3.5-flash,gemini-3.6-flash', fallback.models)
  const all = FORMATS.flatMap((f) => [false, true].map((t) => [f.id, t]))
  check('2. правило сильных у клиента = у сервера (все виды × каверзные)', all.every(([f, t]) => client.isStrongSwap(f, t) === server.isStrongSwap(f, t)), all.filter(([f, t]) => client.isStrongSwap(f, t) !== server.isStrongSwap(f, t)))
}
// 3. плохой вид и ученик — до списания
{
  for (const [name, body] of [
    ['неизвестный вид', swap('essay')],
    ['вид не строкой', { messages: M, task: 'exercise_swap', swap: { format: 3 } }],
    ['«каверзные» не флагом', { messages: M, task: 'exercise_swap', swap: { format: 'tfng', tricky: 'да' } }],
    ['без swap', { messages: M, task: 'exercise_swap' }],
  ]) {
    const r = await call(body)
    check(`3. ${name} — 400, не списано, модель не звали`, r.res.code === 400 && r.rpc('spend_exercise_swap').length === 0 && r.models.length === 0, r.res)
  }
  const st = await call(swap('mcq'), { role: 'student' })
  check('3. ученик — 403, не списано', st.res.code === 403 && st.rpc('spend_exercise_swap').length === 0, st.res)
}
// 4. лимиты из базы
{
  const lim = await call(swap('mcq'), { spend: json(400, { message: 'RECALL_SWAP_LIMIT' }) })
  check('4. 26-я — 409 RECALL_SWAP_LIMIT, модель не звали', lim.res.code === 409 && lim.res.payload?.code === 'RECALL_SWAP_LIMIT' && lim.models.length === 0, lim.res)
  const strong = await call(swap('order'), { spend: json(400, { message: 'RECALL_SWAP_STRONG_LIMIT' }) })
  check('4. 6-я сильная — 409 RECALL_SWAP_STRONG_LIMIT', strong.res.code === 409 && strong.res.payload?.code === 'RECALL_SWAP_STRONG_LIMIT' && strong.models.length === 0, strong.res)
  const plan = await call(swap('mcq'), { spend: json(400, { message: 'RECALL_PLAN_REQUIRED' }) })
  check('4. без тарифа — 403 с кодом', plan.res.code === 403 && plan.res.payload?.code === 'RECALL_PLAN_REQUIRED', plan.res)
  const none = await call(swap('mcq'), { spend: json(404, { message: 'Could not find the function' }) })
  check('4. функции нет — AI закрыт (503), а не бесплатно', none.res.code === 503 && none.models.length === 0, none.res)
}
// 5. ответ не упражнение — 422 без возврата
{
  const two = JSON.stringify({ exercises: [MCQ, MCQ] })
  const otherKind = JSON.stringify({ exercises: [{ kind: 'grammar', type: 'fill', prompt: 'She ___ late.', answer: 'came' }] })
  for (const [name, text] of [['текст', TEXT], ['два упражнения', two], ['чужой вид', otherKind]]) {
    const r = await call(swap('mcq'), { text })
    check(`5. ${name} — 422 RECALL_SWAP_SHAPE`, r.res.code === 422 && r.res.payload?.code === 'RECALL_SWAP_SHAPE', r.res)
    check(`5. …и замена не вернулась`, r.refunded === 0, r.refunded)
  }
}
// 6. модель не ответила — возврат
{
  const r = await call(swap('mcq'), { gemini: 'fail' })
  check('6. сбой AI — замена возвращается', r.res.code >= 500 && r.refunded === 1, { code: r.res.code, refunded: r.refunded })
}
// 7. одни числа и виды у клиента, сервера и базы
{
  const sql = readFileSync(new URL('../supabase/migrations/0019_exercise_swaps.sql', import.meta.url), 'utf8')
  const day = Number(/n_all >= (\d+)/.exec(sql)?.[1])
  const strong = Number(/n_strong >= (\d+)/.exec(sql)?.[1])
  check('7. 25 в сутки: клиент = сервер = база', client.SWAPS_PER_DAY === 25 && server.SWAPS_PER_DAY === 25 && day === 25, { client: client.SWAPS_PER_DAY, server: server.SWAPS_PER_DAY, day })
  check('7. сильных 5: клиент = сервер = база', client.STRONG_PER_DAY === 5 && server.STRONG_PER_DAY === 5 && strong === 5, { client: client.STRONG_PER_DAY, server: server.STRONG_PER_DAY, strong })
  const ids = FORMATS.map((f) => f.id).sort()
  check('7. виды сервера = каталог клиента', JSON.stringify([...server.SWAP_FORMATS].sort()) === JSON.stringify(ids), { server: server.SWAP_FORMATS, ids })
}
// 8. форма ответа и разбор клиентом
{
  check('8. форма: одно упражнение нужного вида — да', isExerciseShaped(ONE, 'mcq'), ONE)
  check('8. форма: в ```json — да', isExerciseShaped('```json\n' + ONE + '\n```', 'mcq'), null)
  check('8. форма: лишний ключ сверху (title) — нет', !isExerciseShaped(JSON.stringify({ title: 'x', exercises: [MCQ] }), 'mcq'), null)
  check('8. форма: лишний ключ у упражнения (body) — нет', !isExerciseShaped(JSON.stringify({ exercises: [{ ...MCQ, body: 'текст' }] }), 'mcq'), null)
  check('8. форма: длинный вопрос (текст в поле) — нет', !isExerciseShaped(JSON.stringify({ exercises: [{ ...MCQ, prompt: 'x'.repeat(500) }] }), 'mcq'), null)
  check('8. форма: пары у «перевода» с format definition — нет', !isExerciseShaped(JSON.stringify({ exercises: [{ type: 'match', format: 'definition', prompt: 'p', pairs: [{ left: 'a', right: 'b' }] }] }), 'match_translation'), null)
  const body = 'Last summer Dana flew to Istanbul. In Istanbul Dana had only forty minutes for her next flight.'
  const input = { body, lang: 'en', level: 'A2', format: 'mcq', others: [] }
  check('8. readSwap: одно нужного вида — ok', client.readSwap(ONE, input).ok === true, client.readSwap(ONE, input))
  check('8. readSwap: чужой вид — причина', client.readSwap(JSON.stringify({ exercises: [{ kind: 'grammar', type: 'fill', prompt: 'She ___.', answer: 'came' }] }), input).ok === false, null)
  check('8. readSwap: пары со словом не из текста — отказ', client.readSwap(JSON.stringify({ exercises: [{ kind: 'vocab', type: 'match', format: 'translation', prompt: 'p', pairs: [{ left: 'passport', right: 'паспорт' }, { left: 'umbrella', right: 'зонт' }, { left: 'suitcase', right: 'чемодан' }], extra: ['билет'] }] }), { ...input, format: 'match_translation' }).ok === false, null)
}

console.log(`\n${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
