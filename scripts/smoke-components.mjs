/**
 * Смоук общих компонентов по листам s3 и s4 (PLAN.md Ф2.17-3) — на витрине
 * /dev/ui (только `npm run dev`/`dev:test`), на 390 и 1280:
 *   1. все разделы листа s3 и иконки s4 на месте;
 *   2. кнопки: высоты 44 / 48 / 56; нажатая — другой тон и scale .97;
 *      выключенная — подложка input; загрузка держит ширину и не нажимается;
 *   3. поле: ошибка — aria-invalid, рамка danger, фраза; выключенное поле;
 *      чипы — галочка у выбранного; сегмент — плашка; счётчик «99+»;
 *      аватар — инициалы, пунктир у «только карточка»;
 *   4. диалог подтверждения — по центру, фокус на «Отмене», Escape — отмена;
 *   5. движение s4: шторка/панель уходит анимацией (ещё видна сразу после
 *      Escape, снята через ~240 мс), тост выезжает и уходит; при «уменьшить
 *      движение» — только прозрачность (animation-name fade-*);
 *   6. каркас: шапка телефона — стекло, знак и EN/ES слева; панель вкладок —
 *      стекло glass-bar, подложка активной вкладки accent-soft.
 * `--shots <папка>` — снимки витрины и каркаса в четырёх вариантах вида
 * (390 и 1280) для сверки с s3 и s4.
 *
 * Запуск: `npm run dev:test`, затем `node scripts/smoke-components.mjs [--shots shots-f2173]`.
 * Аккаунт создаётся и удаляется сам.
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
const EMAIL = 'components-smoke@recall.test'
const PASSWORD = 'CompSmoke!2026'
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
const waitText = (page, text, timeout = 15000) =>
  page
    .waitForFunction((t) => (document.body.innerText || '').includes(t), { polling: 250, timeout }, text)
    .then(() => true)
    .catch(() => false)

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'components-smoke (временный)' })
  const { data: cu, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true })
  if (error && !/already/i.test(error.message)) throw new Error(error.message)
  let id = cu?.user?.id ?? null
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => (u.email ?? '').toLowerCase() === EMAIL)?.id ?? null
  }
  if (!id) throw new Error('не удалось получить id тестового пользователя')
  await admin.from('profiles').update({ level: 'B1', is_admin: false }).eq('id', id)
  await admin.auth.admin.updateUserById(id, { user_metadata: { display_name: 'Айгерим Нурланова' } })
  return id
}

async function openBrowser() {
  const port = 9400 + Math.floor(Math.random() * 500)
  spawn(
    EDGE,
    ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', `--user-data-dir=${profileDir('components-smoke')}`, 'about:blank'],
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

const resize = (page, width, height) => page.setViewport({ width, height, deviceScaleFactor: 1 })

async function openShowcase(page) {
  await page.goto(`${APP_URL}/dev/ui`, { waitUntil: 'networkidle2' })
  await waitText(page, 'Витрина дизайн-системы')
  await sleep(600)
}

/** Кнопка по тексту внутри раздела витрины: n-я из подходящих. */
const btn = (title, text, n = 0) =>
  `[...document.querySelectorAll('[data-board="${title}"] button')].filter((b) => (b.textContent || '').trim() === '${text}')[${n}]`

async function states(page, tag) {
  await openShowcase(page)
  const boards = await page.evaluate(() => [...document.querySelectorAll('[data-board]')].map((b) => b.getAttribute('data-board')))
  const need = ['Кнопки', 'Поле ввода', 'Выбор: чипы, сегмент, тумблер', 'Строка списка', 'Карточка, статусная карточка, плашка', 'Бейджи, счётчик, аватары', 'Тост «Вернуть», пустое состояние, загрузка', 'Иконки · 17', 'Движение']
  check(`${tag}: все разделы s3 и s4 на витрине`, need.every((b) => boards.includes(b)), need.filter((b) => !boards.includes(b)).join(', '))

  const b = await page.evaluate((exprs) => {
    const read = (el) => {
      if (!el) return null
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return { h: Math.round(r.height), w: Math.round(r.width), bg: cs.backgroundColor, scale: cs.scale, busy: el.getAttribute('aria-busy'), disabled: el.disabled }
    }
    const input = getComputedStyle(document.documentElement).getPropertyValue('--color-input').trim()
    return {
      sizes: exprs.sizes.map((e) => read(eval(e))),
      normal: read(eval(exprs.normal)),
      pressed: read(eval(exprs.pressed)),
      off: read(eval(exprs.off)),
      busy: read(eval(exprs.busy)),
      input,
    }
  }, {
    sizes: [btn('Кнопки', 'Малая 44'), btn('Кнопки', 'Обычная 48'), btn('Кнопки', 'Главная 56')],
    normal: btn('Кнопки', 'Сохранить', 0),
    pressed: btn('Кнопки', 'Сохранить', 1),
    off: btn('Кнопки', 'Сохранить', 2),
    busy: `document.querySelectorAll('[data-board="Кнопки"] button[aria-busy]')[0]`,
  })
  check(`${tag}: кнопки 44 · 48 · 56`, b.sizes.map((s) => s?.h).join() === '44,48,56', b.sizes.map((s) => s?.h).join())
  // смоук идёт с «уменьшить движение»: нажатие — только тон (s4); scale .97 — в motion()
  check(`${tag}: нажатая — другой тон; при «уменьшить движение» без масштаба`, !!b.pressed && b.pressed.bg !== b.normal.bg && b.pressed.scale === '1', `${b.normal?.bg} → ${b.pressed?.bg}, scale ${b.pressed?.scale}`)
  const hex = (rgb) => '#' + (rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  check(`${tag}: выключенная — подложка input`, !!b.off && b.off.disabled && hex(b.off.bg) === b.input.toLowerCase(), `${b.off?.bg} / ${b.input}`)
  check(`${tag}: загрузка — не нажимается, ширина та же, что у обычной`, !!b.busy && b.busy.disabled && b.busy.w === b.normal.w, `${b.busy?.w} / ${b.normal?.w}`)

  const f = await page.evaluate(() => {
    const err = [...document.querySelectorAll('[data-board="Поле ввода"] input')].find((i) => i.getAttribute('aria-invalid') === 'true')
    const dis = [...document.querySelectorAll('[data-board="Поле ввода"] input')].find((i) => i.disabled)
    const chip = document.querySelector('[data-board="Выбор: чипы, сегмент, тумблер"] [role="radio"][aria-checked="true"]')
    const seg = document.querySelector('[data-board="Выбор: чипы, сегмент, тумблер"] [role="tab"][aria-selected="true"] > span[aria-hidden]')
    const board = document.querySelector('[data-board="Бейджи, счётчик, аватары"]')
    const dashed = [...board.querySelectorAll('span[aria-hidden]')].find((s) => s.textContent === 'КО')
    return {
      errBorder: err ? getComputedStyle(err).borderColor : null,
      danger: getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim(),
      errText: document.querySelector('[data-board="Поле ввода"]')?.textContent?.includes('Укажи время от 00:00 до 23:59'),
      disabled: !!dis,
      chipCheck: !!chip?.querySelector('svg'),
      segPlate: !!seg,
      counter: board?.textContent?.includes('99+'),
      kz: board?.textContent?.includes('ӘЖ'),
      dashed: dashed ? getComputedStyle(dashed).borderStyle : null,
    }
  })
  check(`${tag}: поле с ошибкой — рамка danger и фраза`, !!f.errBorder && f.errText, `${f.errBorder} / ${f.danger}`)
  check(`${tag}: выключенное поле`, f.disabled)
  check(`${tag}: выбранный чип — с галочкой`, f.chipCheck)
  check(`${tag}: сегмент — плашка выбранного`, f.segPlate)
  check(`${tag}: счётчик «99+», инициалы «ӘЖ», пунктир «только карточка»`, f.counter && f.kz && f.dashed === 'dashed', `${f.counter} ${f.kz} ${f.dashed}`)
}

async function confirmDialog(page, tag) {
  await page.evaluate(() => document.querySelector('[data-demo="confirm"]')?.click())
  await sleep(500)
  const d = await page.evaluate(() => {
    const el = document.querySelector('[role="alertdialog"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const { clientWidth: vw, clientHeight: vh } = document.documentElement
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, vw, vh, focus: document.activeElement?.textContent?.trim() }
  })
  check(`${tag}: подтверждение — диалог по центру окна`, !!d && Math.abs(d.cx - d.vw / 2) < 2 && Math.abs(d.cy - d.vh / 2) < 2, JSON.stringify(d))
  check(`${tag}: фокус — на «Отмене»`, d?.focus === 'Не отменять', d?.focus)
  if (SHOTS) await settledScreenshot(page, { path: join(SHOTS, `confirm-${tag}.png`) })
  await page.keyboard.press('Escape')
  // уход — таймером 140 мс, а фоновой вкладке без окна браузер сдвигает
  // таймеры к целой секунде (как в smoke-ui)
  await sleep(1500)
  const gone = await page.evaluate(() => !document.querySelector('[role="alertdialog"]') && document.querySelector('[data-demo="answer"]')?.textContent)
  check(`${tag}: Escape — отмена`, gone === 'Урок оставлен', String(gone))
}

async function motion(page, tag) {
  // движение — без «уменьшить движение»
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await openShowcase(page)
  const scale = await page.evaluate(() => {
    const b = [...document.querySelectorAll('[data-board="Кнопки"] button')].filter((x) => x.textContent?.trim() === 'Сохранить')[1]
    return b ? getComputedStyle(b).scale : null
  })
  check(`${tag}: нажатая кнопка — scale .97`, scale === '0.97', String(scale))
  await page.evaluate(() => document.querySelector('[data-demo="sheet"]')?.click())
  await sleep(700)
  const enter = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? getComputedStyle(d).animationName : null
  })
  check(`${tag}: появление — ${tag === 'phone' ? 'снизу (sheet-in)' : 'справа (panel-in)'}`, enter === (tag === 'phone' ? 'sheet-in' : 'panel-in'), String(enter))
  await page.keyboard.press('Escape')
  await sleep(60)
  const leaving = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? getComputedStyle(d).animationName : null
  })
  check(`${tag}: Escape — уходит анимацией (${tag === 'phone' ? 'вниз' : 'вправо'}), а не исчезает`, leaving === (tag === 'phone' ? 'sheet-out' : 'panel-out'), String(leaving))
  await sleep(1500)
  check(`${tag}: после ухода шторки на экране нет`, !(await page.$('[role="dialog"]')))

  // закрыть изнутри — «закрыть» в заголовке шторки уходит так же
  await page.evaluate(() => document.querySelector('[data-demo="sheet"]')?.click())
  await sleep(600)
  await page.evaluate(() => document.querySelector('[role="dialog"] button[aria-label="Закрыть"]')?.click())
  await sleep(60)
  const inner = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? getComputedStyle(d).animationName : null
  })
  check(`${tag}: «закрыть» в заголовке — тот же уход`, inner === (tag === 'phone' ? 'sheet-out' : 'panel-out'), String(inner))
  await sleep(1500)

  await page.evaluate(() => document.querySelector('[data-demo="toast"]')?.click())
  await sleep(300)
  const toast = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[role="status"]')].find((s) => s.textContent?.includes('Урок перенесён'))
    return t ? getComputedStyle(t.firstElementChild).animationName : null
  })
  check(`${tag}: тост выезжает снизу (toast-in)`, toast === 'toast-in', String(toast))
  await page.evaluate(() => [...document.querySelectorAll('[role="status"] button')].find((b) => b.textContent?.trim() === 'Вернуть')?.click())
  await sleep(40)
  const toastOut = await page.evaluate(() => {
    const t = [...document.querySelectorAll('[role="status"]')].find((s) => s.textContent?.includes('Урок перенесён'))
    return t ? getComputedStyle(t.firstElementChild).animationName : null
  })
  check(`${tag}: «Вернуть» — тост уходит вниз (toast-out)`, toastOut === 'toast-out', String(toastOut))
  await sleep(1500)

  // «уменьшить движение» — только прозрачность
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.evaluate(() => document.querySelector('[data-demo="sheet"]')?.click())
  await sleep(500)
  const reduced = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? getComputedStyle(d).animationName : null
  })
  check(`${tag}: «уменьшить движение» — шторка только проявляется (fade-in)`, reduced === 'fade-in', String(reduced))
  await page.keyboard.press('Escape')
  await sleep(40)
  const reducedOut = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return d ? getComputedStyle(d).animationName : null
  })
  check(`${tag}: «уменьшить движение» — уход только прозрачностью (fade-out)`, reducedOut === 'fade-out', String(reducedOut))
  await sleep(1500)
  check(`${tag}: и снимается после ухода`, !(await page.$('[role="dialog"]')))
}

async function shell(page, tag) {
  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' })
  await sleep(1200)
  if (tag === 'phone') {
    const s = await page.evaluate(() => {
      const h = document.querySelector('header.vt-topbar')
      const nav = document.querySelector('nav.vt-nav')
      const pill = nav?.querySelector('span[aria-hidden]')
      const root = getComputedStyle(document.documentElement)
      const left = h?.querySelector('div > div')
      return {
        headerBg: h ? getComputedStyle(h).backgroundColor : null,
        glass: root.getPropertyValue('--color-glass').trim(),
        blur: h ? getComputedStyle(h).backdropFilter : null,
        leftHasLang: !!left?.querySelector('[aria-label="Язык изучения"]'),
        navBg: nav ? getComputedStyle(nav).backgroundColor : null,
        navRadius: nav ? getComputedStyle(nav).borderTopLeftRadius : null,
        pillBg: pill ? getComputedStyle(pill).backgroundColor : null,
        soft: root.getPropertyValue('--color-accent-soft').trim(),
      }
    })
    check('телефон: шапка — стекло (полупрозрачный фон и размытие)', /rgba\(/.test(s.headerBg ?? '') && /blur/.test(s.blur ?? ''), `${s.headerBg} · ${s.blur}`)
    check('телефон: знак и EN/ES — слева', s.leftHasLang)
    check('телефон: панель вкладок — стекло, капсула', /rgba\(/.test(s.navBg ?? '') && parseFloat(s.navRadius ?? '0') > 30, `${s.navBg} · ${s.navRadius}`)
    check('телефон: подложка активной вкладки — accent-soft', !!s.pillBg, s.pillBg)
  }
}

async function shots(page) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  for (const [theme, palette] of [
    ['dark', 'twilight'],
    ['light', 'twilight'],
    ['dark', 'sunset'],
    ['light', 'sunset'],
  ]) {
    await page.evaluate(
      (t, p) => {
        localStorage.setItem('recall.theme', t)
        localStorage.setItem('recall.palette', p)
      },
      theme,
      palette,
    )
    for (const [w, h, tag] of [
      [390, 844, '390'],
      [1280, 800, '1280'],
    ]) {
      await resize(page, w, h)
      await openShowcase(page)
      const name = `${palette}-${theme}-${tag}`
      await settledScreenshot(page, { path: join(SHOTS, `ui-${name}.png`), fullPage: true })
      await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle2' })
      await sleep(1500)
      await settledScreenshot(page, { path: join(SHOTS, `home-${name}.png`) })
    }
  }
  await page.evaluate(() => {
    localStorage.removeItem('recall.theme')
    localStorage.removeItem('recall.palette')
  })
}

async function run(browser) {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true })
  const page = await browser.newPage()
  await resize(page, 390, 844)
  const jsErrors = []
  page.on('pageerror', (e) => jsErrors.push(String(e)))
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Войти')?.click())
  await sleep(500)
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 })

  for (const [w, h, tag] of [
    [390, 844, 'phone'],
    [1280, 800, 'desk'],
  ]) {
    await resize(page, w, h)
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await states(page, tag)
    await confirmDialog(page, tag)
    await motion(page, tag)
    await shell(page, tag)
  }
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await shots(page)
  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '))
}

async function main() {
  const userId = await createUser()
  const browser = await openBrowser()
  try {
    await run(browser)
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

await main()
