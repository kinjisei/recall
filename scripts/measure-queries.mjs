/**
 * Считает реальные round-trip к Supabase (REST/RPC) на горячих экранах.
 * Показывает, сколько запросов делает открытие каждого экрана и нет ли дублей
 * одного и того же запроса.
 * Логин без UI (инжект сессии). Запуск: node scripts/measure-queries.mjs [BASE]
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'https://recall-pgkz.vercel.app'
const EMAIL = 'queries-measure@recall.test'
const PASSWORD = 'Queries!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const REF = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const SUPA = env.VITE_SUPABASE_URL

async function ensureUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'queries-measure (временный)' })
  const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)
  // немного данных, чтобы экраны что-то грузили
  const { data: decks } = await admin.from('decks').select('id').eq('owner_id', id).eq('lang', 'en')
  if (decks?.[0]) {
    const { count } = await admin.from('cards').select('id', { count: 'exact', head: true }).eq('deck_id', decks[0].id)
    if (!count) {
      await admin.from('cards').insert(
        Array.from({ length: 12 }, (_, i) => ({ deck_id: decks[0].id, front: `w${i}`, back: `с${i}` })),
      )
    }
  }
  return id
}
async function session() {
  const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (error) throw new Error(error.message)
  return data.session
}

/** rest?table или rpc/fn — короткая метка запроса. */
function label(url) {
  const u = new URL(url)
  if (u.pathname.includes('/rest/v1/rpc/')) return 'rpc:' + u.pathname.split('/rpc/')[1]
  if (u.pathname.includes('/rest/v1/')) {
    const table = u.pathname.split('/rest/v1/')[1]
    const cols = (u.searchParams.get('select') || '').slice(0, 24)
    return `${table}${cols ? '?select=' + cols : ''}`
  }
  if (u.pathname.includes('/auth/v1/')) return 'auth:' + u.pathname.split('/auth/v1/')[1]
  return u.pathname
}

const main = async () => {
  let id = null
  const PORT = 9850 + (Date.now() % 120)
  spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}\\recall-q-${Date.now()}`, '--no-first-run', 'about:blank'],
    { detached: true, stdio: 'ignore' }).unref()
  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    id = await ensureUser()
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

    let bucket = []
    page.on('request', (r) => {
      // OPTIONS — это CORS-preflight, не сам запрос; иначе каждый запрос считался
      // бы дважды (preflight + POST/GET)
      if (r.method() === 'OPTIONS') return
      if (r.url().startsWith(SUPA) && /\/(rest|rpc|auth)\//.test(r.url())) bucket.push(label(r.url()))
    })

    console.log(`Хост: ${BASE}\n`)
    const screen = async (name, path) => {
      bucket = []
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 40000 })
      await new Promise((r) => setTimeout(r, 3000))
      const counts = {}
      for (const l of bucket) counts[l] = (counts[l] || 0) + 1
      const dupes = Object.entries(counts).filter(([, n]) => n > 1)
      console.log(`=== ${name} (${path}) — запросов к Supabase: ${bucket.length} ===`)
      for (const [l, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(2)}×  ${l}`)
      }
      if (dupes.length) console.log(`  ⚠️ ДУБЛИ: ${dupes.map(([l, n]) => `${l}×${n}`).join(', ')}`)
      console.log()
    }

    await screen('Главная', '/')
    await screen('Практика', '/practice')
    await screen('Учёба', '/study')
    await screen('Прогресс', '/progress')
  } finally {
    if (id) await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    await browser.close().catch(() => {})
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
