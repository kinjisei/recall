/**
 * Чистый тест: бесплатный «Пересоставить план» материала (PLAN.md
 * Ф2.17-4в-2б, миграция 0014, api/_replan.ts, api/_planShape.ts).
 *
 * Держит:
 *   1. оплаченный план (material_plan) — генерация, и к ответу-плану право
 *      на 3 повтора; право просят ТЕМ ЖЕ номером списания, что ушёл в
 *      spend_energy, — клиент его не видит;
 *   2. ответ не план — права нет (иначе «план» с текстом внутри даёт повторы);
 *   3. повтор (material_replan) без права — 409 с кодом, до модели не доходит,
 *      генерацию не трогает;
 *   4. повтор с правом — spend_replan вместо spend_energy, в ответе — сколько
 *      осталось;
 *   5. повторы кончились — 409; база ответила незнакомо — AI закрыт (503);
 *   6. повтор ответил не планом — 422, и повтор НЕ возвращается (иначе по
 *      кругу гоняли бы дорогую модель бесплатно);
 *   7. модель не ответила — повтор возвращается тем же refund_ai_call;
 *   8. форма плана: ключи, длины, типы.
 * Без сети, базы и ключей. Запуск: node scripts/test-replan.mjs
 */
import './_api-loader.mjs'

const SB = 'https://sb.test'
process.env.VITE_SUPABASE_URL = SB
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
process.env.GEMINI_API_KEY = 'gemini-key'
delete process.env.GROQ_API_KEY
delete process.env.RECALL_CHEAP_MODELS

const GRANT = '11111111-2222-4333-8444-555555555555'
const PLAN = JSON.stringify({
  comments: 'Проверил заявку: слова подходят уровню A2.',
  vocabulary: ['delay', 'luggage', 'gate'],
  grammar_focus: 'Past Simple',
  exercise_plan: [{ kind: 'comprehension', type: 'mcq', count: 3, note: 'вопросы по сюжету' }],
})
const TEXT = JSON.stringify({ title: 'A long day', body: 'Last summer Dana flew…', exercises: [] })

let stub = {}
let log = []
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const body = init.body ? JSON.parse(init.body) : null
  log.push({ url, body })
  if (url === `${SB}/auth/v1/user`) return json(200, { id: 'u1' })
  if (url.startsWith(`${SB}/rest/v1/profiles`)) return json(200, [{ role: 'teacher' }])
  if (url === `${SB}/rest/v1/rpc/spend_energy`) return new Response('null', { status: 200 })
  if (url === `${SB}/rest/v1/rpc/grant_material_replans`) return json(200, stub.grant ?? GRANT)
  if (url === `${SB}/rest/v1/rpc/spend_replan`) return stub.spendReplan ?? new Response('2', { status: 200 })
  if (url === `${SB}/rest/v1/rpc/refund_ai_call`) return new Response('true', { status: 200 })
  if (url === `${SB}/rest/v1/rpc/log_ai_call`) return new Response('true', { status: 200 })
  if (url.includes(':generateContent')) {
    if (stub.gemini === 'fail') return json(500, { error: { message: 'down' } })
    return json(200, { candidates: [{ content: { parts: [{ text: stub.text ?? PLAN }] }, finishReason: 'STOP' }] })
  }
  throw new Error(`тест не ждал запроса ${url}`)
}

const gemini = await import('../api/gemini.ts')
const { isPlanShaped } = await import('../api/_planShape.ts')
const T = {
  functionMs: 1000, safetyMs: 50, supabaseMs: 80, logMs: 60, groqMs: 120, sttMs: 150,
  attemptMs: { lite: 100, standard: 150, max: 150 }, minAttemptMs: 20, firstTextMs: 150, idleMs: 100,
}
const M = [{ role: 'user', content: 'план' }]

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
  return { res, rpc, refunded, models: log.filter((c) => c.url.includes(':generateContent')).length }
}

let pass = 0
let fail = 0
const check = (name, ok, got) => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — получено: ${JSON.stringify(got)}`}`)
}

// 1. оплаченный план → право на 3 повтора тем же номером списания
{
  const r = await call({ messages: M, task: 'material_plan' })
  const spent = r.rpc('spend_energy')[0]?.body
  const granted = r.rpc('grant_material_replans')[0]?.body
  check('1. план — генерация', spent?.p_generation === true, spent)
  check('1. право просят тем же номером списания', !!granted && granted.p_nonce === spent?.p_nonce, { spent, granted })
  check('1. в ответе право и 3 повтора', r.res.code === 200 && r.res.payload?.replan?.id === GRANT && r.res.payload?.replan?.left === 3, r.res.payload)
}
// 2. ответ не план — без права
{
  const r = await call({ messages: M, task: 'material_plan' }, { text: TEXT })
  check('2. не план — права не просят и не дают', r.rpc('grant_material_replans').length === 0 && r.res.code === 200 && !r.res.payload?.replan, r.res.payload)
}
// 3. повтор без права
{
  const r = await call({ messages: M, task: 'material_replan' })
  check('3. без права — 409 с кодом', r.res.code === 409 && r.res.payload?.code === 'RECALL_REPLAN_LIMIT', r.res)
  check('3. …до модели не дошло, генерацию не тронул', r.models === 0 && r.rpc('spend_energy').length === 0 && r.rpc('spend_replan').length === 0, r)
}
// 4. повтор с правом
{
  const r = await call({ messages: M, task: 'material_replan', replan: GRANT })
  check('4. повтор — spend_replan, а не spend_energy', r.rpc('spend_replan').length === 1 && r.rpc('spend_energy').length === 0, r.rpc('spend_energy'))
  check('4. …с тем правом, что прислал клиент', r.rpc('spend_replan')[0]?.body?.p_replan === GRANT, r.rpc('spend_replan')[0]?.body)
  check('4. в ответе — сколько осталось', r.res.code === 200 && r.res.payload?.replan?.left === 2 && r.res.payload?.replan?.id === GRANT, r.res.payload)
  check('4. повтор права не выдаёт заново', r.rpc('grant_material_replans').length === 0, r.rpc('grant_material_replans'))
}
// 5. повторы кончились; база ответила незнакомо
{
  const r = await call({ messages: M, task: 'material_replan', replan: GRANT }, { spendReplan: json(400, { message: 'RECALL_REPLAN_LIMIT' }) })
  check('5. кончились — 409, модель не зовём', r.res.code === 409 && r.res.payload?.code === 'RECALL_REPLAN_LIMIT' && r.models === 0, r.res)
  const z = await call({ messages: M, task: 'material_replan', replan: GRANT }, { spendReplan: json(404, { message: 'Could not find the function' }) })
  check('5. функции нет — AI закрыт, а не бесплатно', z.res.code === 503 && z.models === 0, z.res)
}
// 6. повтор ответил не планом
{
  const r = await call({ messages: M, task: 'material_replan', replan: GRANT }, { text: TEXT })
  check('6. не план — 422', r.res.code === 422, r.res)
  check('6. …и повтор не вернулся', r.refunded === 0, r.refunded)
}
// 7. модель не ответила — повтор возвращается
{
  const r = await call({ messages: M, task: 'material_replan', replan: GRANT }, { gemini: 'fail' })
  check('7. сбой AI — возврат повтора', r.res.code >= 500 && r.refunded === 1, { code: r.res.code, refunded: r.refunded })
}
// 8. форма плана
check('8. план — да', isPlanShaped(PLAN), PLAN)
check('8. план в ```json — да', isPlanShaped('```json\n' + PLAN + '\n```'), null)
check('8. лишний ключ body — нет', !isPlanShaped(JSON.stringify({ ...JSON.parse(PLAN), body: 'text' })), null)
check('8. длинный комментарий — нет', !isPlanShaped(JSON.stringify({ ...JSON.parse(PLAN), comments: 'x'.repeat(1300) })), null)
check('8. упражнение с текстом задания — нет', !isPlanShaped(JSON.stringify({ ...JSON.parse(PLAN), exercise_plan: [{ kind: 'grammar', type: 'fill', count: 2, note: 'n', prompt: 'I ___ go' }] })), null)
check('8. слова не строками — нет', !isPlanShaped(JSON.stringify({ ...JSON.parse(PLAN), vocabulary: [{ w: 'gate' }] })), null)
check('8. без упражнений — нет', !isPlanShaped(JSON.stringify({ ...JSON.parse(PLAN), exercise_plan: [] })), null)

console.log(`\n${pass}/${pass + fail}`)
process.exit(fail ? 1 : 0)
