/**
 * Шлюз AI целиком на живой ТЕСТОВОЙ базе (PLAN.md Ф1.6): настоящие
 * обработчики api/gemini.ts и api/transcribe.ts, настоящие списание, журнал и
 * возврат — поддельны только ответы моделей (Google и Groq не зовутся, квоту
 * AI проверка не тратит).
 *
 * Что доказывает:
 *   • удачный вызов: ответ дошёл, в журнале модель, что ответила, и все
 *     попытки; энергия списана;
 *   • все модели отказали: отказ человеку, в журнале «failed», энергия
 *     вернулась (строки списания нет);
 *   • поток «Диалога»: итог «ok» с временем до первых слов;
 *   • речь: в журнале задача speech и модель Whisper;
 *   • ученику учительская задача — 403, и энергия не тронута.
 *
 * Запуск: node scripts/check-ai-gateway.mjs   (только тестовая база)
 */
import './_api-loader.mjs'
import { createClient } from '@supabase/supabase-js'
import { dbTarget, runSql, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Проверка заводит аккаунты — только тестовая база.')
  process.exit(1)
}

const env = scriptEnv()
const target = dbTarget([])
const sql = (q) => runSql(target, q)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// серверным функциям — адрес ТЕСТОВОЙ базы; ключи моделей — подставные
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY
process.env.GEMINI_API_KEY = 'fake-gemini'
process.env.GROQ_API_KEY = 'fake-groq'
delete process.env.RECALL_CHEAP_MODELS

// --- поддельные модели, настоящая база ---------------------------------------------
const realFetch = globalThis.fetch
let models = {}
const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
const sse = (text, stop) =>
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(stop ? { finishReason: 'STOP' } : {}) }] })}\n\n`

globalThis.fetch = async (input, init = {}) => {
  const url = String(input)
  const model = url.match(/models\/([^:]+):/)?.[1]
  if (url.includes(':streamGenerateContent')) {
    if (models.gemini?.(model) !== 'ok') return json(429, { error: { message: 'quota' } })
    const enc = new TextEncoder()
    return new Response(new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(sse('Hola, ')))
        c.enqueue(enc.encode(sse(`ответ ${model}`, true)))
        c.close()
      },
    }), { status: 200 })
  }
  if (url.includes(':generateContent')) {
    return models.gemini?.(model) === 'ok'
      ? json(200, { candidates: [{ content: { parts: [{ text: `ответ ${model}` }] }, finishReason: 'STOP' }] })
      : json(429, { error: { message: 'quota' } })
  }
  if (url.endsWith('/chat/completions')) {
    return models.groq === 'ok' ? json(200, { choices: [{ message: { content: 'ответ groq' } }] }) : json(429, { error: { message: 'quota' } })
  }
  if (url.endsWith('/audio/transcriptions')) return json(200, { text: 'hello world' })
  return realFetch(input, init) // Supabase — настоящий
}

const gemini = await import('../api/gemini.ts')
const transcribe = await import('../api/transcribe.ts')
const { GEMINI_TIER_CHAINS } = await import('../api/_core.ts')
const { GROQ_MODELS } = await import('../api/_groq.ts')
const { STT_MODEL } = await import('../api/_stt.ts')
const STD = GEMINI_TIER_CHAINS.standard

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

function makeRes() {
  const r = { code: 200, payload: undefined, chunks: [], ended: false, destroyed: false }
  r.status = (c) => ((r.code = c), r)
  r.json = (p) => ((r.payload = p), (r.ended = true), r)
  r.setHeader = () => r
  r.write = (c) => (r.chunks.push(String(c)), true)
  r.end = () => ((r.ended = true), r)
  r.destroy = () => ((r.destroyed = true), r)
  return r
}

async function call(handler, token, body, plan = {}) {
  models = plan
  const res = makeRes()
  await handler({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body }, res)
  return res
}

const lastLog = async (uid) =>
  (await sql(`select * from public.ai_call_log where user_id = '${uid}' order by id desc limit 1`))[0]
const spentRow = async (token) =>
  (await sql(`select count(*)::int as n from public.ai_calls where refund_token = '${token}'`))[0].n > 0
const callsOf = async (uid) => (await sql(`select count(*)::int as n from public.ai_calls where user_id = '${uid}'`))[0].n

const EMAIL = 'aigw-check@recall.test'
const PASSWORD = 'AiGateway!2026'
let uid

try {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'check-ai-gateway (временный)' })
  const { data: made, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  uid = made?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === EMAIL)?.id
  const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: session, error: e2 } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (e2) throw new Error(`вход: ${e2.message}`)
  const jwt = session.session.access_token
  const M = [{ role: 'user', content: 'hola' }]

  console.log('\n— удачный вызов')
  {
    const res = await call(gemini.handle, jwt, { task: 'dialog', messages: M }, { gemini: (m) => (m === STD[0] ? 'no' : 'ok') })
    const row = await lastLog(uid)
    check('ответ дошёл', res.code === 200 && res.payload?.text === `ответ ${STD[1]}`, JSON.stringify(res.payload))
    check('в журнале — «ok» и модель, что ответила', row?.status === 'ok' && row.model === STD[1] && row.task === 'dialog', JSON.stringify(row))
    check('в журнале обе попытки: 429 и ответ', row?.attempts?.map((a) => a.status).join(',') === '429,ok', JSON.stringify(row?.attempts))
    check('энергия списана — строка списания на месте', await spentRow(row?.call_token))
  }
  {
    const res = await call(gemini.handle, jwt, { task: 'word', messages: M }, { groq: 'ok' })
    const row = await lastLog(uid)
    check('перевод слова — Groq первым, в журнале его модель', res.code === 200 && row?.model === GROQ_MODELS.fast && row.tier === 'lite', JSON.stringify(row))
  }

  console.log('\n— все модели отказали')
  {
    const res = await call(gemini.handle, jwt, { task: 'dialog', messages: M }, { gemini: () => 'no', groq: 'no' })
    const row = await lastLog(uid)
    check('человеку — отказ, а не пустой ответ', res.code === 429 || res.code === 502, `${res.code} ${JSON.stringify(res.payload)}`)
    check('в журнале «failed» без модели и все попытки', row?.status === 'failed' && row.model === null && row.attempts?.length === STD.length + 1, JSON.stringify(row))
    check('энергия вернулась — строки списания нет', !(await spentRow(row?.call_token)))
  }

  console.log('\n— поток «Диалога» и речь')
  {
    const res = await call(gemini.handle, jwt, { task: 'dialog', messages: M, stream: true }, { gemini: () => 'ok' })
    const row = await lastLog(uid)
    check('поток дописан', res.ended && !res.destroyed && res.chunks.join('') === `Hola, ответ ${STD[0]}`, res.chunks.join(''))
    check('в журнале «ok» и время до первых слов', row?.status === 'ok' && typeof row.attempts?.[0]?.first === 'number', JSON.stringify(row?.attempts))
  }
  {
    const res = await call(transcribe.handle, jwt, { audio: 'aGVsbG8=', mime: 'audio/webm', lang: 'en' })
    const row = await lastLog(uid)
    check('речь распознана, в журнале speech и Whisper', res.code === 200 && row?.task === 'speech' && row.model === STT_MODEL, JSON.stringify(row))
  }

  console.log('\n— права')
  {
    const before = await callsOf(uid)
    const res = await call(gemini.handle, jwt, { task: 'material', messages: M }, { gemini: () => 'ok' })
    check('ученику учительская задача — 403', res.code === 403, `${res.code} ${JSON.stringify(res.payload)}`)
    check('и энергия не тронута', (await callsOf(uid)) === before)
  }
} catch (e) {
  check('прогон дошёл до конца', false, e.message)
} finally {
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
}

const failed = results.filter((r) => !r).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exit(failed ? 1 : 0)
