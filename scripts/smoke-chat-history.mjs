/**
 * Смоук памяти «Диалога»: переписка продолжается и НЕ выворачивается.
 *
 * Два бага в одном месте:
 *  1. реплики писались в базу и никогда не читались — уход за словом обнулял чат;
 *  2. пара «вопрос + ответ» уходила одним insert-ом, и обе строки получали
 *     одинаковый created_at (now() в Postgres — время транзакции). Порядок
 *     внутри пары становился произвольным, и чат открывался вывернутым:
 *     сначала ответ AI, под ним вопрос, на который он отвечает.
 *
 * Здесь сеем ИМЕННО такую переписку — с одинаковым временем и «ответом
 * впереди», как в уже сохранённых у людей данных, — и проверяем, что на экране
 * порядок правильный.
 *
 * AI не зовём: проверяем чтение и порядок, а не саму модель.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-chat-history.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const EMAIL = 'chat-history@recall.test'
const PASSWORD = 'ChatHist!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tap = async (page, text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find((e) =>
      (e.textContent || '').trim().includes(t),
    )
    if (el) el.click()
    return !!el
  }, text)
  await sleep(800)
  return ok
}

async function main() {
  let browser = null
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'chat-history (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let userId = cu?.user?.id ?? null
  if (!userId) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = l.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!userId) throw new Error('не создан аккаунт')
  await admin.from('activity_log').upsert(
    { user_id: userId, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )

  // ---- сеем «испорченную» переписку: пары с ОДИНАКОВЫМ временем ----------
  const { data: conv } = await admin
    .from('conversations')
    .insert({ user_id: userId })
    .select('id')
    .single()
  const t1 = new Date(Date.now() - 60_000).toISOString()
  const t2 = new Date(Date.now() - 30_000).toISOString()
  // ⚠️ ассистента вставляем ПЕРВЫМ и с тем же временем — ровно так выглядят
  // записи, сделанные до починки
  await admin.from('messages').insert([
    { conversation_id: conv.id, role: 'assistant', content: 'ОТВЕТ ОДИН', created_at: t1 },
    { conversation_id: conv.id, role: 'user', content: 'ВОПРОС ОДИН', created_at: t1 },
    { conversation_id: conv.id, role: 'assistant', content: 'ОТВЕТ ДВА', created_at: t2 },
    { conversation_id: conv.id, role: 'user', content: 'ВОПРОС ДВА', created_at: t2 },
  ])

  // ---- вторая переписка, ЯВНО испанская: в английском чате её быть не должно
  const { data: esConv } = await admin
    .from('conversations')
    .insert({ user_id: userId, lang: 'es' })
    .select('id')
    .single()
  await admin.from('messages').insert([
    {
      conversation_id: esConv.id,
      role: 'user',
      content: 'ИСПАНСКАЯ РЕПЛИКА',
      // свежее английской: если бы язык не учитывался, подняли бы именно её
      created_at: new Date().toISOString(),
    },
  ])

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${process.env.TEMP}\\chathist-${Date.now()}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.bringToFront()
  await page.setViewport({ width: 420, height: 900 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await tap(page, 'Войти')
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4500)

  await page.goto(`${BASE}/conversation`, { waitUntil: 'networkidle2' })
  const loaded = await page
    .waitForFunction(() => (document.body.innerText || '').includes('ВОПРОС ОДИН'), {
      timeout: 15000,
      polling: 300,
    })
    .then(() => true)
    .catch(() => false)
  check('прошлая переписка поднимается', loaded)

  // Порядок на экране = порядок ПО ВЕРТИКАЛИ, а не по классам вёрстки.
  // ⚠️ Так надёжнее: реплики AI отрисованы вложенными узлами (подсветка
  // «✏️ …»), и цепляться за классы пузыря — значит переписывать смоук после
  // каждой правки стилей. Спрашиваем то же, что видит человек: что выше.
  const order = await page.evaluate(() => {
    const marks = ['ВОПРОС ОДИН', 'ОТВЕТ ОДИН', 'ВОПРОС ДВА', 'ОТВЕТ ДВА']
    const found = []
    for (const m of marks) {
      const els = [...document.querySelectorAll('*')].filter(
        (e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === m,
      )
      const deepest = els[els.length - 1]
      if (deepest) found.push({ m, top: deepest.getBoundingClientRect().top })
    }
    return found.sort((a, b) => a.top - b.top).map((x) => x.m)
  })
  check(
    'вопрос идёт ПЕРЕД ответом, а не после',
    JSON.stringify(order) ===
      JSON.stringify(['ВОПРОС ОДИН', 'ОТВЕТ ОДИН', 'ВОПРОС ДВА', 'ОТВЕТ ДВА']),
    order.join(' → ') || 'реплик не нашлось',
  )

  check(
    'испанская переписка не попала в английский чат',
    !(await page.evaluate(() => (document.body.innerText || '').includes('ИСПАНСКАЯ РЕПЛИКА'))),
  )

  // «Начать заново» — старая переписка не должна возвращаться после выхода
  const restarted = await tap(page, 'Новый диалог')
  check('кнопка «Новый диалог» есть', restarted)
  // ⚠️ Ждём ФАКТ создания новой переписки, а не «полторы секунды»: запись идёт
  // по сети, и при медленном ответе смоук уходил со страницы раньше — проверка
  // краснела на исправном продукте.
  let convCount = 0
  for (let i = 0; i < 30 && convCount < 2; i++) {
    const { data } = await admin.from('conversations').select('id').eq('user_id', userId)
    convCount = (data ?? []).length
    if (convCount < 2) await sleep(400)
  }
  check('новая переписка заведена сразу', convCount >= 2, `переписок: ${convCount}`)
  await page.goto(`${BASE}/study`, { waitUntil: 'networkidle2' })
  await sleep(1200)
  await page.goto(`${BASE}/conversation`, { waitUntil: 'networkidle2' })
  await sleep(3000)
  const stillEmpty = await page.evaluate(
    () => !(document.body.innerText || '').includes('ВОПРОС ОДИН'),
  )
  const { data: convs } = await admin
    .from('conversations')
    .select('id, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
  check(
    'после «Нового диалога» старая переписка не возвращается',
    stillEmpty,
    `переписок в базе: ${(convs ?? []).length}`,
  )

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')

  await browser.close()
  await admin.auth.admin.deleteUser(userId).catch(() => {})
  await admin.from('allowed_emails').delete().eq('email', EMAIL)
  console.log('Тестовый аккаунт удалён (переписка ушла каскадом).')

  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

main()
  .catch((e) => {
    console.error('Смоук упал:', e)
    process.exitCode = 1
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 500))
