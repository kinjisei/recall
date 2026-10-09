/**
 * Блок «Расход AI» в /admin на живом экране (PLAN.md Ф1.6).
 *
 * Готовит журнал как настоящий сервер (spend_energy + log_ai_call под токеном
 * ученика): три удачных перевода слова на Groq и один Диалог, где модель
 * отказала по квоте и энергия вернулась. Затем владелец открывает /admin.
 *
 * Что доказывает:
 *   • модель видна с расходом против дневного лимита («3 из 1 000»), отказ по
 *     квоте — отдельно от ответов;
 *   • вызовы по задачам: «Перевод слова», «Диалог · без ответа 1»;
 *   • виден момент обнуления квот (сутки Google);
 *   • «7 дн» показывает таблицу по дням;
 *   • на 360 px нет горизонтальной прокрутки.
 * Скриншот блока — в папку из SHOT_DIR (по умолчанию не сохраняется).
 *
 * Нужен `npm run dev:test` (порт 5174). Запуск: node scripts/smoke-ai-usage.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { settleAnimations } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты и пишет журнал — только тестовая база.')
  process.exit(1)
}

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PASSWORD = 'AiUsageSmoke!2026'
const BOSS = 'aiusage-boss@recall.test'
const PUPIL = 'aiusage-pupil@recall.test'

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function makeUser(email) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-ai-usage (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  return data?.user?.id ?? (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)?.id
}

/** Вызов как у сервера: списание со своим номером, затем итог в журнал. */
async function serverCall(client, { kind, cost, task, tier, model, status, attempts }) {
  const nonce = randomUUID()
  const spent = await client.rpc('spend_energy', { p_kind: kind, p_cost: cost, p_generation: false, p_nonce: nonce })
  if (spent.error) throw new Error(`spend_energy: ${spent.error.message}`)
  const logged = await client.rpc('log_ai_call', {
    p_nonce: nonce, p_task: task, p_tier: tier, p_model: model, p_status: status,
    p_latency_ms: 420, p_attempts: attempts, p_refund: status !== 'ok',
  })
  if (logged.error || logged.data !== true) throw new Error(`log_ai_call: ${logged.error?.message ?? logged.data}`)
}

const ids = []
let browser = null
try {
  const bossId = await makeUser(BOSS)
  const pupilId = await makeUser(PUPIL)
  ids.push(bossId, pupilId)
  await admin.from('profiles').update({ is_admin: true }).eq('id', bossId)

  const pupil = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: loginErr } = await pupil.auth.signInWithPassword({ email: PUPIL, password: PASSWORD })
  if (loginErr) throw new Error(`вход ученика: ${loginErr.message}`)
  for (let i = 0; i < 3; i++) {
    await serverCall(pupil, {
      kind: 'light', cost: 0, task: 'word', tier: 'lite', model: 'openai/gpt-oss-20b', status: 'ok',
      attempts: [{ model: 'openai/gpt-oss-20b', status: 'ok', ms: 300 + i * 10 }],
    })
  }
  await serverCall(pupil, {
    kind: 'heavy', cost: 1, task: 'dialog', tier: 'standard', model: null, status: 'failed',
    attempts: [{ model: 'gemini-3.6-flash', status: '429', ms: 180 }],
  })

  const PORT = 9400 + Math.floor(Math.random() * 500)
  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('ai-usage-smoke')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !browser; i++) {
    await sleep(500)
    browser = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setViewport({ width: 360, height: 800 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim().includes('Войти'))?.click())
  await sleep(600)
  await page.type('input[type=email]', BOSS)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await sleep(4000)

  await page.goto(`${APP_URL}/admin`, { waitUntil: 'networkidle2' })
  await page.waitForFunction(
    () => /Расход AI/.test(document.body.innerText) && /gpt-oss-20b/.test(document.body.innerText),
    { timeout: 20000, polling: 250 },
  ).catch(() => {})
  const block = () =>
    page.evaluate(() => {
      const h = [...document.querySelectorAll('h2')].find((x) => x.textContent?.trim() === 'Расход AI')
      return h?.closest('section')?.innerText ?? ''
    })
  const text = await block()
  check('блок «Расход AI» на месте', text.length > 0)
  check('модель видна с расходом против дневного лимита', /openai\/gpt-oss-20b\s+3 из 1\s?000/.test(text), text.slice(0, 300))
  check('отказ по квоте — отдельно от ответов', /gemini-3\.6-flash[\s\S]*?отказ по квоте 1/.test(text), text)
  check('вызовы по задачам: перевод слова и Диалог без ответа',
    /Перевод слова\s+3 вызова/.test(text) && /Диалог\s+1 вызов · без ответа 1/.test(text), text)
  check('виден момент обнуления квот', /обнулятся в \d\d:\d\d \(через/.test(text), text.slice(0, 200))
  check('на 360 px нет горизонтальной прокрутки',
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))

  await page.evaluate(() => [...document.querySelectorAll('[role=tab]')].find((b) => b.textContent?.trim() === '7 дн')?.click())
  await page.waitForFunction(() => /По дням/.test(document.body.innerText), { timeout: 10000, polling: 250 }).catch(() => {})
  check('«7 дн» — таблица по дням', /По дням/.test(await block()))
  check('без ошибок JavaScript', jsErrors.length === 0, jsErrors.join(' | '))

  if (process.env.SHOT_DIR) {
    await settleAnimations(page)
    const el = await page.evaluateHandle(() =>
      [...document.querySelectorAll('h2')].find((x) => x.textContent?.trim() === 'Расход AI')?.closest('section'))
    await el.asElement()?.screenshot({ path: join(process.env.SHOT_DIR, 'ai-usage-360.png') })
    console.log(`  скриншот: ${join(process.env.SHOT_DIR, 'ai-usage-360.png')}`)
  }
} catch (e) {
  check('прогон дошёл до конца', false, e.message)
} finally {
  await browser?.close().catch(() => {})
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [BOSS, PUPIL])
}

const failed = results.filter((r) => !r).length
console.log(`\n${failed ? '✗' : '✓'} ${results.length - failed}/${results.length}`)
process.exit(failed ? 1 : 0)
