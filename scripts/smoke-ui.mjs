/**
 * Смоук дизайн-системы (PLAN.md Ф1.4): тема за флагом, шторка боковой
 * панелью, общие раскладки, клавиатура в упражнениях.
 *
 *   1. тема: у обычного человека тёмная даже при светлом телефоне; владелец в
 *      /admin выбирает светлую — меняются data-theme, фон страницы и цвет строки
 *      состояния, выбор переживает перезагрузку; «как в системе» идёт за
 *      телефоном; в Настройках переключателя нет;
 *   2. шторка: на телефоне — снизу во всю ширину, на компьютере — панелью
 *      справа на всю высоту;
 *   3. раскладки (витрина /dev/ui, только в разработке): колонка упражнения,
 *      колонка чтения с панелью сбоку, «список + подробности» — на 1280 и 390;
 *   4. клавиатура: 1–4 выбирают вариант, Enter — «дальше», Esc — выход из
 *      раунда.
 *
 * Запуск: `npm run dev:test` (5174, тестовая база), затем
 * `node scripts/smoke-ui.mjs [--shots <папка>]`. Аккаунт создаётся и
 * удаляется сам (service_role тестовой базы).
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { settledScreenshot } from './_shots.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = APP_URL
const EMAIL = 'ui-smoke@recall.test'
const PASSWORD = 'UiSmoke!2026'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt !== -1 ? process.argv[shotsAt + 1] : null

const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const px = (n) => Math.round(n)

const waitText = (page, text, timeout = 15000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout }, text)
    .then(() => true)
    .catch(() => false)

/** Нажать кнопку по видимому тексту (первую подходящую). */
const clickText = (page, text, sel = 'button') =>
  page.evaluate(
    (t, s) => {
      const b = [...document.querySelectorAll(s)].find((e) => (e.textContent || '').trim() === t)
      b?.click()
      return !!b
    },
    text,
    sel,
  )

/** Состояние темы на странице. */
const themeState = (page) =>
  page.evaluate(() => ({
    attr: document.documentElement.dataset.theme ?? null,
    bg: getComputedStyle(document.body).backgroundColor,
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null,
  }))

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'ui-smoke (временный)' })
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
  await admin.from('profiles').update({ level: 'B1', is_admin: false }).eq('id', id)
  return id
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('ui-smoke')}`, 'about:blank'],
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

async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: join(SHOTS, `${name}.png`) })
}

// ── 1. тема ─────────────────────────────────────────────────────────────────
async function theme(page, userId) {
  // обычный человек со светлым телефоном — всё равно тёмная
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  let t = await themeState(page)
  check('без выбора: тёмная даже при светлом телефоне', t.attr === 'dark' && t.bg === 'rgb(22, 24, 38)', JSON.stringify(t))
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Настройки')
  check('в Настройках переключателя темы нет', !(await page.evaluate(() => !!document.querySelector('[aria-label="Тема оформления"]'))))

  // владелец: блок в админке
  await admin.from('profiles').update({ is_admin: true }).eq('id', userId)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  check('в админке есть «Тема на этом устройстве»', await waitText(page, 'Тема на этом устройстве'))
  await clickText(page, 'Светлая')
  await sleep(300)
  t = await themeState(page)
  check('владелец выбрал светлую: data-theme, фон, строка состояния', t.attr === 'light' && t.bg === 'rgb(245, 245, 249)' && t.meta === '#f5f5f9', JSON.stringify(t))
  await shot(page, 'theme-light-admin')

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' })
  await sleep(800)
  t = await themeState(page)
  check('выбор переживает перезагрузку', t.attr === 'light', JSON.stringify(t))
  await shot(page, 'theme-light-home')

  // «как в системе» идёт за телефоном — и при смене на лету
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Тема на этом устройстве')
  await clickText(page, 'Как в системе')
  await sleep(300)
  const sysLight = (await themeState(page)).attr
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await page.screenshot({ encoding: 'base64' }) // кадр: событие медиа-запроса приходит с ним
  await sleep(300)
  const sysDark = (await themeState(page)).attr
  check('«как в системе»: светлый телефон → светлая, сменил на тёмный → тёмная', sysLight === 'light' && sysDark === 'dark', `${sysLight} → ${sysDark}`)

  await clickText(page, 'Тёмная')
  await admin.from('profiles').update({ is_admin: false }).eq('id', userId)
  await page.emulateMediaFeatures([])
}

/** Прямоугольник элемента по селектору (null — нет на странице). */
const rect = (page, sel) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)?.getBoundingClientRect()
    return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } : null
  }, sel)

/** Ширина окна (без полосы прокрутки) и высота. */
const viewport = (page) =>
  page.evaluate(() => ({ vw: document.documentElement.clientWidth, vh: window.innerHeight }))

/** Сменить ширину и дождаться, пока раскладка её заметит (кадр — скриншотом). */
async function resize(page, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  await page.screenshot({ encoding: 'base64' })
  await sleep(500)
}

async function openShowcase(page, query = '') {
  await page.goto(`${BASE}/dev/ui${query}`, { waitUntil: 'networkidle2' })
  await waitText(page, query ? '' : 'Витрина дизайн-системы')
  await sleep(700)
}

// ── 2. шторка ─────────────────────────────────────────────────────────────────
async function sheet(page, tag) {
  await openShowcase(page)
  await clickText(page, 'Открыть шторку')
  await sleep(600)
  const r = await rect(page, '[role="dialog"]')
  const { vw, vh } = await viewport(page)
  if (tag === 'phone') {
    check('телефон: шторка снизу во всю ширину', !!r && px(r.left) === 0 && px(r.width) === vw && Math.abs(r.bottom - vh) <= 1, JSON.stringify(r))
    check('телефон: у шторки есть ручка', await page.evaluate(() => !!document.querySelector('[role="dialog"] .cursor-grab')))
  } else {
    check(
      'компьютер: шторка — панель справа на всю высоту',
      !!r && Math.abs(r.right - vw) <= 1 && px(r.top) === 0 && Math.abs(r.height - vh) <= 1 && r.width >= 380 && r.width <= 440,
      JSON.stringify(r),
    )
    check('компьютер: ручки нет', !(await page.evaluate(() => !!document.querySelector('[role="dialog"] .cursor-grab'))))
  }
  await shot(page, `${tag}-sheet`)
  await page.keyboard.press('Escape')
  await sleep(400)
  check(`${tag}: Escape закрывает шторку`, !(await rect(page, '[role="dialog"]')))
}

// ── 3. раскладки ──────────────────────────────────────────────────────────────
async function layouts(page, tag) {
  const desk = tag === 'desk'
  const mainW = async () => (await rect(page, 'main'))?.width ?? 0

  // колонка по центру
  await openShowcase(page, '?l=center')
  const c = await rect(page, '[data-demo="center"]')
  const m = await rect(page, 'main')
  check(
    `${tag}: «колонка по центру» не шире 576 и по центру`,
    !!c && !!m && c.width <= 577 && Math.abs(c.left - m.left - (m.right - c.right)) <= 2,
    c && m ? `ширина ${px(c.width)}, поля ${px(c.left - m.left)}/${px(m.right - c.right)}` : 'нет',
  )

  // колонка чтения
  await openShowcase(page, '?l=reading')
  const textBefore = await rect(page, '[data-demo="reading"]')
  const aside = await rect(page, 'aside[aria-label="Перевод слова"]')
  if (desk) {
    check('компьютер: чтению дана ширина страницы (шире 640)', (await mainW()) > 700, `${px(await mainW())}px`)
    check('компьютер: панель перевода справа от текста, место под неё есть сразу', !!aside && !!textBefore && aside.left >= textBefore.right, JSON.stringify(aside))
  } else {
    check('телефон: панели сбоку нет', !aside)
  }
  await page.evaluate(() => document.querySelector('[data-demo="reading"] button')?.click())
  await sleep(600)
  const textAfter = await rect(page, '[data-demo="reading"]')
  if (desk) {
    const word = await page.evaluate(() => document.querySelector('aside[aria-label="Перевод слова"]')?.textContent ?? '')
    check('компьютер: тап по слову — перевод в панели', word.includes('Every'), word.slice(0, 40))
    check('компьютер: текст не сдвинулся', !!textAfter && !!textBefore && textAfter.left === textBefore.left && textAfter.width === textBefore.width)
    check('компьютер: шторки поверх текста нет', !(await rect(page, '[role="dialog"]')))
  } else {
    const d = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? '')
    check('телефон: тап по слову — перевод шторкой снизу', d.includes('Every'), d.slice(0, 40))
  }
  await shot(page, `${tag}-reading`)
  await page.keyboard.press('Escape')

  // список + подробности
  await openShowcase(page, '?l=list')
  const list = await rect(page, '[data-demo="list"]')
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-demo="list"] button')].find((b) => (b.textContent || '').startsWith('Мадина'))?.click(),
  )
  await sleep(500)
  const listAfter = await rect(page, '[data-demo="list"]')
  const detail = await rect(page, '[data-demo="detail"]')
  if (desk) {
    check('компьютер: список слева, подробности справа', !!listAfter && !!detail && detail.left > listAfter.right, detail ? `список до ${px(listAfter?.right ?? 0)}, подробности с ${px(detail.left)}` : 'нет подробностей')
  } else {
    check('телефон: выбрал — подробности вместо списка', !!list && !listAfter && !!detail)
    await page.goBack()
    await sleep(500)
    check('телефон: «назад» — снова список', !!(await rect(page, '[data-demo="list"]')) && !(await rect(page, '[data-demo="detail"]')))
  }
  await shot(page, `${tag}-list`)

  // ушли с раскладки — колонка снова 640
  await openShowcase(page)
  check(`${tag}: без раскладки экран снова колонкой ≤ 640`, (await mainW()) <= 640, `${px(await mainW())}px`)
}

// ── раскрывашка: одна на всё приложение (shared/ui/Reveal) ────────────────────
async function reveal(page) {
  await openShowcase(page)
  const inPage = () => page.evaluate(() => document.body.innerText.includes('монтируется, только пока открыто'))
  check('раскрывашка: закрыта — содержимого в странице нет', !(await inPage()))
  await clickText(page, 'Как это работает?')
  await sleep(500)
  const opened = await page.evaluate(() => document.querySelector('.reveal')?.getAttribute('data-open'))
  check('раскрывашка: открыли — содержимое есть и развёрнуто', (await inPage()) && opened === 'true', `data-open=${opened}`)
  await clickText(page, 'Как это работает?')
  // размонтирование — таймером 360 мс, а фоновой вкладке без окна браузер
  // сдвигает таймеры к целой секунде
  await sleep(1500)
  check('раскрывашка: закрыли — содержимое убрано после анимации', !(await inPage()))
}

// ── 4. клавиатура ─────────────────────────────────────────────────────────────
const keysLine = (page) => page.evaluate(() => document.querySelector('[data-demo="keys"]')?.textContent ?? '')

async function keyboard(page) {
  await openShowcase(page)
  const hint = await page.evaluate(() => {
    const b = document.querySelector('button[data-key="2"]')
    return b ? { before: getComputedStyle(b, '::before').content, text: (b.textContent || '').trim() } : null
  })
  check(
    'компьютер: на вариантах видны цифры-подсказки, а текст кнопки — сам ответ',
    !!hint && hint.before.includes('2') && hint.text === 'goes',
    JSON.stringify(hint),
  )
  await page.keyboard.press('2') // верный вариант — «goes»
  await sleep(300)
  check('«2» выбирает второй вариант (верный)', (await keysLine(page)).includes('Отвечено: 1'), await keysLine(page))
  await page.keyboard.press('Enter')
  await sleep(300)
  check('Enter после ответа — «Дальше»', (await keysLine(page)).includes('вопрос 2'), await keysLine(page))
  await page.keyboard.press('1')
  await page.keyboard.press('3')
  await sleep(300)
  await page.keyboard.press('Enter')
  await sleep(300)
  check('две ошибки цифрами — ответ показан, Enter ведёт дальше', (await keysLine(page)).includes('вопрос 3'), await keysLine(page))

  // настоящий раунд «Практики»: грамматика вперемешку не требует своих слов
  await page.goto(`${BASE}/practice?m=gr-mcq`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Упражнение')
  const progress = () => page.evaluate(() => (document.body.innerText.match(/Упражнение\s+(\d+)/) || [])[1] ?? '')
  const before = await progress()
  for (const k of ['1', '2', '3', '4']) {
    await page.keyboard.press(k)
    await sleep(250)
  }
  await page.keyboard.press('Enter')
  await sleep(500)
  const after = await progress()
  check('«Практика»: цифры отвечают, Enter — следующее упражнение', before === '1' && after === '2', `${before} → ${after}`)
  await page.keyboard.press('Escape')
  await sleep(700)
  check('«Практика»: Esc — выход из раунда', new URL(page.url()).search === '', page.url())
}

async function run(browser, userId) {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await clickText(page, 'Войти')
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })

  await theme(page, userId)

  // Геометрию меряем без анимации появления: в headless-вкладке кадры не
  // выдаются, и шторка застывает на середине сдвига (правило «уважает
  // prefers-reduced-motion» у нас глобальное — index.css).
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  for (const [w, h, tag] of [
    [390, 844, 'phone'],
    [1280, 800, 'desk'],
  ]) {
    await resize(page, w, h)
    await sheet(page, tag)
    await layouts(page, tag)
  }
  await reveal(page)
  await keyboard(page)

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  try {
    await run(browser, userId)
  } catch (e) {
    check('смоук дошёл до конца', false, String(e?.message ?? e).split('\n')[0])
  } finally {
    await browser.close().catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    console.log('Тестовый аккаунт удалён.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}

void px
await main()
