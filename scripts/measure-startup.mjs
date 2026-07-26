/**
 * Замер стартового пути: какие JS-чанки реально грузятся при входе на Главную
 * и при переходах. Ловит, не приезжает ли тяжёлое (слова/pdf/mammoth/грамматика)
 * до того, как пользователь открыл соответствующий раздел.
 *
 * Логин без UI — инжект сессии (как в smoke-onboarding-placement).
 * Запуск: node scripts/measure-startup.mjs [BASE]   (по умолчанию прод)
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'https://recall-pgkz.vercel.app'
const EMAIL = 'startup-measure@recall.test'
const PASSWORD = 'Startup!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})
const REF = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]

async function user() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'startup-measure (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)
  return id
}
async function session() {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) throw new Error(error.message)
  return data.session
}

const short = (u) => u.replace(/^.*\/assets\//, '').replace(/-[A-Za-z0-9_-]{6,}\.js$/, '.js')

const main = async () => {
  let id = null
  const PORT = 9800 + (Date.now() % 150)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}\\recall-startup-${Date.now()}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    id = await user()
    const sess = await session()
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 800, isMobile: true, hasTouch: true })
    await page.evaluateOnNewDocument((ref, s) => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
        localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(s))
      } catch {}
    }, REF, sess)

    // Реальные размеры и факт загрузки — из Performance API (encodedBodySize —
    // размер тела на проводе; transferSize=0 → из кэша/SW). initiatorType
    // 'script'/'link' различает исполняемый импорт и prefetch.
    const seen = new Set()
    const snapshot = async () =>
      page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .filter((e) => /\/assets\/.*\.js/.test(e.name))
          .map((e) => ({
            name: e.name,
            enc: e.encodedBodySize || 0,
            transfer: e.transferSize || 0,
            init: e.initiatorType,
          })),
      )

    console.log(`Хост: ${BASE}\n`)
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 40000 })
    await new Promise((r) => setTimeout(r, 3000))

    const report = async (label, alarm) => {
      const all = await snapshot()
      const fresh = all
        .filter((e) => !seen.has(e.name))
        .map((e) => {
          seen.add(e.name)
          return { name: short(e.name), kb: Math.round(e.enc / 1024), cached: e.transfer === 0, init: e.init }
        })
        .sort((a, b) => b.kb - a.kb)
      const total = fresh.reduce((s, i) => s + i.kb, 0)
      console.log(`\n=== ${label} — новых JS: ${fresh.length}, ${total}КБ (тела, gzip) ===`)
      for (const i of fresh.slice(0, 14)) {
        console.log(`  ${String(i.kb).padStart(4)}КБ ${i.cached ? '(кэш)' : '     '} ${i.init.padEnd(6)} ${i.name}`)
      }
      const heavy = fresh.filter((i) => /words|pdf|mammoth|grammar|phrasal|spanish|conjugation|irregular/.test(i.name))
      if (alarm && heavy.length) {
        console.log('  ⚠️ ТЯЖЁЛОЕ, ЧЕГО ТУТ БЫТЬ НЕ ДОЛЖНО:', heavy.map((h) => `${h.name} ${h.kb}КБ${h.cached ? ' (кэш)' : ''}`).join(', '))
      }
      return total
    }
    const startupKb = await report('СТАРТ (Главная)', true)

    for (const [label, path, alarm] of [
      ['→ Практика', '/practice', false],
      ['→ Учёба', '/study', false],
      ['→ Диалог', '/conversation', false],
    ]) {
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 40000 })
      await new Promise((r) => setTimeout(r, 2500))
      await report(label, alarm)
    }

    console.log(`\nИТОГ: стартовый JS ≈ ${startupKb}КБ (тела по сети, gzip).`)
  } finally {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    await browser.close().catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
