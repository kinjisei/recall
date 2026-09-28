/**
 * Скриншоты «до/после» и сравнение по пикселям — приёмка правок внешнего вида.
 *
 * Зачем. Правка токенов и общих компонентов (PLAN.md Ф1.4) обязана оставить
 * тёмную тему такой же, как была. «На глаз похоже» не проверка: разница в один
 * оттенок рамки не видна на скриншоте, но видна в счёте пикселей.
 *
 *   node scripts/shots-compare.mjs --save <папка>        снять экраны
 *   node scripts/shots-compare.mjs --compare <до> <после> [--out <папка>]
 *
 * Снимает список экранов на телефоне (390) и компьютере (1280) целиком, с
 * выключенной анимацией (prefers-reduced-motion) — иначе кадр ловит середину
 * появления. Сравнение пишет по каждому экрану число отличающихся пикселей и
 * кладёт картинку разницы (отличия красным) в --out.
 *
 * Нужен `npm run dev:test` (5174, тестовая база). Аккаунт — преподаватель,
 * создаётся и удаляется сам (service_role тестовой базы).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
// --url — снимать с другого сервера (например, vite preview отдельной сборки
// на тестовой базе: тогда код можно править, пока идёт съёмка)
const BASE = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : APP_URL
// свой аккаунт на каждый сервер: два прогона параллельно не удаляют друг другу вход
const EMAIL = `shots-compare-${new URL(BASE).port || 'p'}@recall.test`
const PASSWORD = 'ShotsCompare!2026'

// Экраны приёмки. Первые пять — «выглядит как раньше»; остальные — где правка
// меняет вид намеренно (кнопка «назад»), их сравнение показывает, ЧТО именно.
export const SCREENS = ['/', '/study', '/practice', '/conversation', '/grammar', '/teacher', '/settings', '/progress', '/pricing']
const SIZES = [
  [390, 844, 'phone'],
  [1280, 800, 'desk'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}
const fileName = (tag, path) => `${tag}-${path === '/' ? 'home' : path.slice(1)}.png`

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('shots')}`, 'about:blank'],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    const b = await puppeteer
      .connect({ browserURL: `http://127.0.0.1:${port}`, defaultViewport: null, protocolTimeout: 120000 })
      .catch(() => null)
    if (b) return b
  }
  throw new Error('Edge не поднялся')
}

async function save(dir) {
  const env = scriptEnv()
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'shots-compare (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  await admin.from('activity_log').upsert(
    { user_id: id, type: 'flashcards', day: new Date().toISOString().slice(0, 10), items_done: 1 },
    { onConflict: 'user_id,type,day' },
  )
  await admin.from('profiles').update({ level: 'B1', role: 'teacher', display_name: 'Снимок' }).eq('id', id)

  mkdirSync(dir, { recursive: true })
  const browser = await openBrowser()
  try {
    const page = await browser.newPage()
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    await page.goto(`${BASE}/login`, { waitUntil: 'load' })
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some((e) => (e.textContent || '').trim() === 'Войти'),
      { polling: 250, timeout: 20000 },
    )
    await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => (e.textContent || '').trim() === 'Войти')
      b?.click()
    })
    await sleep(500)
    await page.type('input[type=email]', EMAIL)
    await page.type('input[type=password]', PASSWORD)
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })

    for (const [w, h, tag] of SIZES) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
      await page.screenshot({ encoding: 'base64' }) // кадр: иначе медиа-запрос ширины не переключится
      for (const p of SCREENS) {
        // «тишины в сети» ждём не дольше 10 с: иначе экран с живым соединением
        // держит прогон по полминуты, а к этому моменту он давно нарисован
        await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
        await sleep(2500)
        // Досрочно завершить все анимации: у строк списков появление с
        // задержкой по очереди, а в headless-вкладке кадры идут рывками — без
        // этого снимок ловит разное число проявившихся строк, и «разница» —
        // это время, а не код.
        await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()))
        await sleep(200)
        await page.screenshot({ path: join(dir, fileName(tag, p)), fullPage: true })
      }
    }
    console.log(`снято ${SCREENS.length * SIZES.length} экранов → ${dir}`)
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(id).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
  }
}

/** Отличающиеся пиксели двух картинок; разница — красным поверх бледного «после». */
async function diff(a, b, out) {
  const [A, B] = await Promise.all([a, b].map((f) => sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })))
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) {
    return { size: `${A.info.width}×${A.info.height} → ${B.info.width}×${B.info.height}`, changed: null }
  }
  const px = A.data
  const qx = B.data
  const img = Buffer.alloc(qx.length)
  let changed = 0
  for (let i = 0; i < px.length; i += 4) {
    const d = Math.max(Math.abs(px[i] - qx[i]), Math.abs(px[i + 1] - qx[i + 1]), Math.abs(px[i + 2] - qx[i + 2]))
    if (d > 0) {
      changed++
      img[i] = 255
      img[i + 1] = img[i + 2] = 0
    } else {
      const g = Math.round((qx[i] + qx[i + 1] + qx[i + 2]) / 3 / 3)
      img[i] = img[i + 1] = img[i + 2] = g
    }
    img[i + 3] = 255
  }
  if (out && changed) await sharp(img, { raw: { width: B.info.width, height: B.info.height, channels: 4 } }).png().toFile(out)
  return { size: null, changed, total: px.length / 4 }
}

async function compare(before, after, out) {
  if (out) mkdirSync(out, { recursive: true })
  let same = 0
  const files = readdirSync(before).filter((f) => f.endsWith('.png'))
  for (const f of files) {
    if (!existsSync(join(after, f))) {
      console.log(`? ${f}: нет в «после»`)
      continue
    }
    const r = await diff(join(before, f), join(after, f), out ? join(out, f) : null)
    if (r.size) console.log(`≠ ${f}: другой размер ${r.size}`)
    else if (r.changed === 0) {
      same++
      console.log(`= ${f}: без различий`)
    } else console.log(`≠ ${f}: ${r.changed} пикс. из ${r.total} (${((100 * r.changed) / r.total).toFixed(3)}%)`)
  }
  console.log(`\nБез различий: ${same} из ${files.length}`)
}

const saveTo = arg('--save')
const cmpAt = process.argv.indexOf('--compare')
if (saveTo) await save(saveTo)
else if (cmpAt !== -1) await compare(process.argv[cmpAt + 1], process.argv[cmpAt + 2], arg('--out'))
else console.log('node scripts/shots-compare.mjs --save <папка> | --compare <до> <после> [--out <папка>]')
