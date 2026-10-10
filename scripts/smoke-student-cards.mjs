/**
 * Карточки учеников в браузере (PLAN.md Ф2.5; макеты t6, d3). Сам заводит
 * учителя (Mini, 5 мест) с одним учеником в приложении и второго ученика без
 * привязки, AI не трогает.
 *
 *   1. список: ученик в приложении со строкой «кем заняться», тихая строка
 *      «В приложении 1 из 5 мест тарифа»; шапка одной строкой «Ученики (?)
 *      ↻ + Ученик», фильтры — одной строкой, общий код — строкой (Ф2.11б-2);
 *   2. «+ Ученик» → «Пригласить по общему коду» — сообщение без имени и тот
 *      же код; → шторка → карточка без приложения открылась сама:
 *      «без приложения», приглашение с кодом, WhatsApp — на номер ученика,
 *      текст — от учителя про домашку (журнал п.71), значки кнопок целиком;
 *   3. меню «⋯»: «В архив» → тост «Вернуть» → статус вернулся; «Изменить
 *      данные» → заметка видна в карточке;
 *   4. ученик открывает ссылку-приглашение → на Главной код уже в поле →
 *      «Привязать» → у учителя та же карточка «в приложении», мест 2 из 5,
 *      под шапкой — студия (домашка); шесть плиток по t6-2 — каждая открывает
 *      экран раздела, «‹ Имя» — назад к плиткам; «Убрать из тарифа» → тост
 *      «Вернуть»;
 *   4а. учитель вернулся в приложение (вкладка снова видна после фона) —
 *      список перечитался сам: карточка, заведённая в базе, пока приложение
 *      было свёрнуто, видна без «Обновить»;
 *   4б. новичок по ссылке: «Вас пригласил преподаватель» → вход → онбординг
 *      → на последнем шаге код уже в поле → привязан к своей карточке;
 *   5. компьютер 1280: список и карточка рядом; ничего не выбрано — подсказка;
 *      страница не прокручивается — карточка своей прокруткой, раздел
 *      открывается с начала панели.
 *
 * Запуск: npm run dev:test, затем node scripts/smoke-student-cards.mjs
 *         [--shots <папка>] — сохранить скриншоты 390 и 1280.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'
import { APP_URL, scriptEnv } from './_env.mjs'
import { settledScreenshot } from './_shots.mjs'

if (process.argv.includes('--prod')) {
  console.error('Смоук заводит аккаунты — только тестовая база (npm run dev:test).')
  process.exit(1)
}

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const env = scriptEnv()
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PASS = 'CardsSmoke!2026'
const TEACHER = 'cards-smoke-teacher@recall.test'
const LINKED = 'cards-smoke-linked@recall.test'
const NEWBIE = 'cards-smoke-newbie@recall.test'
const ONBOARD = 'cards-smoke-onboard@recall.test'
const shotsAt = process.argv.indexOf('--shots')
const SHOTS = shotsAt > 0 ? process.argv[shotsAt + 1] : null
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${ok || !extra ? '' : ' — ' + extra}`)
}

const must = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`)
  return r.data
}

async function makeUser(email, name) {
  await admin.from('allowed_emails').upsert({ email, note: 'smoke-student-cards' })
  const { data: cu } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true })
  let id = cu?.user?.id
  if (!id) {
    const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = l.users.find((u) => (u.email ?? '').toLowerCase() === email)?.id
    await admin.auth.admin.updateUserById(id, { password: PASS })
  }
  await admin.from('profiles').update({ display_name: name }).eq('id', id)
  return id
}

async function openAs(b, email, width = 390) {
  const ctx = await b.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height: width > 600 ? 800 : 844 })
  await page.goto(`${APP_URL}/login`, { waitUntil: 'networkidle2' })
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await page.type('#f-email', email)
  await page.type('#f-password', PASS)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => location.pathname !== '/login', { polling: 250, timeout: 30000 })
  await sleep(1200)
  return page
}
const go = (page, path) => page.goto(`${APP_URL}${path}`, { waitUntil: 'networkidle2' })
const text = (page) => page.evaluate(() => document.body.innerText)
const waitText = (page, re, timeout = 15000) =>
  page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), { polling: 250, timeout }, re.source).then(() => true, () => false)
const waitSel = (page, sel, timeout = 15000) => page.waitForSelector(sel, { visible: true, timeout }).then(() => true, () => false)
// Кнопки экрана, а не вкладки меню: с меню учителя (Ф2.10) «Ученик» нашлось
// бы во вкладке «Ученики», и смоук жал бы её вместо «+ Ученик».
async function click(page, label, timeout = 15000) {
  const ok = await page
    .waitForFunction((l) => [...document.querySelectorAll('button, a, [role="menuitem"]')].some((x) => !x.closest('.vt-nav') && x.textContent.trim().includes(l)), { polling: 250, timeout }, label)
    .then(() => true, () => false)
  if (!ok) return false
  await page.evaluate((l) => [...document.querySelectorAll('button, a, [role="menuitem"]')].reverse().find((x) => !x.closest('.vt-nav') && x.textContent.trim().includes(l))?.click(), label)
  await sleep(600)
  return true
}
/** Нажать элемент как палец: сперва в середину экрана — у края его закрывает плавающее меню. */
async function tap(page, sel) {
  await page.waitForSelector(sel, { visible: true, timeout: 15000 })
  await page.$eval(sel, (el) => el.scrollIntoView({ block: 'center' }))
  await sleep(250)
  await page.click(sel)
  await sleep(400)
}
async function typeInto(page, sel, value) {
  await page.focus(sel)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await page.type(sel, value)
}
async function shot(page, name) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await settledScreenshot(page, { path: `${SHOTS}/${name}.png`, fullPage: true })
}

const PORT = 9400 + Math.floor(Math.random() * 500)
let b = null
const ids = []
try {
  const tId = await makeUser(TEACHER, 'Мадина Смоук')
  const lId = await makeUser(LINKED, 'Айгерим Нурланова')
  const nId = await makeUser(NEWBIE, 'Timur K')
  const onbId = await makeUser(ONBOARD, 'Новичок Онбординг')
  ids.push(tId, lId, nId, onbId)
  await admin.from('profiles').update({ role: 'teacher', plan: 'teacher_mini', plan_expires_at: new Date(Date.now() + 20 * 864e5).toISOString() }).eq('id', tId)
  const link = await admin.from('teacher_students').insert({ teacher_id: tId, student_id: lId })
  if (link.error) throw new Error(`привязка: ${link.error.message}`)

  spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--disable-gpu',
    `--user-data-dir=${profileDir('student-cards')}`, 'about:blank'], { detached: true, stdio: 'ignore' }).unref()
  for (let i = 0; i < 30 && !b; i++) {
    await sleep(500)
    b = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 180000 }).catch(() => null)
  }

  // ── 1. список ───────────────────────────────────────────────────────────────
  const te = await openAs(b, TEACHER)
  await go(te, '/teacher')
  check('список: ученик в приложении', await waitText(te, /Айгерим Нурланова/))
  let txt = await text(te)
  check('строка отвечает «кем заняться»: домашка и регулярность', /Домашка не выдана/.test(txt) && /занимался/.test(txt))
  check('тихая строка мест: 1 из 5', /В приложении 1 из 5 мест тарифа/.test(txt), (txt.match(/В приложении[^\n]*/) || [''])[0])
  const head = await te.evaluate(() => {
    const h = document.querySelector('main header')
    const els = [h?.querySelector('h1'), h?.querySelector('[aria-label="Как это работает?"]'), h?.querySelector('[aria-label="Обновить"]'), [...(h?.querySelectorAll('button') ?? [])].find((x) => x.textContent.includes('Ученик'))]
    const tops = els.map((el) => (el ? Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) : null))
    return { tops, oneRow: tops.every((t) => t !== null && Math.abs(t - tops[0]) <= 6) }
  })
  check('шапка одной строкой: «Ученики (?) ↻ + Ученик»', head.oneRow, JSON.stringify(head.tops))
  check('«Как это работает?» раскрыто при первом заходе', /Здесь все твои ученики/.test(txt))
  const filterRows = await te.evaluate(() => new Set([...document.querySelectorAll('[aria-label="Статус"] [role="radio"]')].map((r) => r.offsetTop)).size)
  check('фильтры — одной строкой (прокрутка вбок)', filterRows === 1, `строк: ${filterRows}`)
  const generalCode = await te.$eval('[data-general-code]', (el) => el.getAttribute('data-general-code')).catch(() => null)
  check('общий код — строкой под списком', /Общий код:/.test(txt) && /^[A-Z2-9]{6}$/.test(generalCode ?? '') && !/ученик вводит его у себя/.test(txt), generalCode)
  await shot(te, 'list-390')

  // ── 2. новый ученик без приложения ─────────────────────────────────────────────
  await click(te, 'Ученик')
  check('шторка «Новый ученик»', await waitText(te, /Новый ученик/))
  await shot(te, 'new-sheet-390')
  await click(te, 'Пригласить по общему коду')
  const general = await te.$eval('[data-general-invite] [data-invite-message]', (el) => el.textContent).catch(() => '')
  check('«+ Ученик → Пригласить по общему коду»: сообщение без имени, тот же код', general.startsWith('Домашку теперь буду давать в Recall') && general.endsWith(`Вот код: ${generalCode}`), general.slice(0, 80))
  await shot(te, 'general-code-390')
  await tap(te, '[aria-label="К новому ученику"]')
  check('…«‹» — обратно к форме нового ученика', await waitSel(te, 'input[placeholder="Имя и фамилия"]'))
  await typeInto(te, 'input[placeholder="Имя и фамилия"]', 'Тимур Ким')
  await typeInto(te, 'input[placeholder^="+7 700"]', '+7 701 123 45 67')
  await click(te, 'Занимается')
  await click(te, 'Добавить')
  check('карточка открылась: имя и «без приложения»', await waitText(te, /без приложения/) && /Тимур Ким/.test(await text(te)))
  check('приглашение с кодом', await waitSel(te, '[data-invite-code]'))
  const code = await te.$eval('[data-invite-code]', (el) => el.getAttribute('data-invite-code'))
  check('код из 6 знаков', /^[A-Z2-9]{6}$/.test(code ?? ''), code)
  const wa = await te.evaluate(() => [...document.querySelectorAll('[data-card-invite] a')].find((a) => a.textContent.includes('WhatsApp'))?.href ?? '')
  check('WhatsApp — сразу на номер ученика, с текстом и ссылкой', wa.startsWith('https://wa.me/77011234567?text=') && decodeURIComponent(wa).includes(`join=${code}`), wa.slice(0, 80))
  check('подпись мест: займёт место, будет 2 из 5', /будет 2 из 5/.test(await text(te)))
  const inv = await te.$eval('[data-card-invite] [data-invite-message]', (el) => el.textContent)
  check('приглашение — от учителя, про домашку, без «бесплатно» (журнал п.71)', inv.startsWith('Тимур, домашку теперь буду давать в Recall') && /разговор с AI на английском/.test(inv) && !/бесплатн/i.test(inv), inv.slice(0, 90))
  const share = await te.evaluate(() =>
    [...(document.querySelector('[data-card-invite] [data-share]')?.parentElement?.children ?? [])].map((el) => {
      const svg = el.querySelector('svg')?.getBoundingClientRect()
      return { icon: Math.round(svg?.width ?? 0), fits: el.scrollWidth <= el.clientWidth + 1 }
    }),
  )
  check('кнопки «поделиться»: значок не сплющен, подпись внутри кнопки', share.length === 3 && share.every((x) => x.icon >= 16 && x.fits), JSON.stringify(share))
  await shot(te, 'invite-390')

  // ── 3. меню: архив и откат, правка ─────────────────────────────────────────────
  await click(te, '⋯')
  await click(te, 'В архив')
  check('тост «в архиве» с «Вернуть»', await waitText(te, /Тимур Ким — в архиве/))
  check('в архиве — приглашения нет', await waitText(te, /Ученик в архиве/))
  await click(te, 'Вернуть')
  check('«Вернуть» вернул статус и приглашение', await waitSel(te, '[data-invite-code]'))
  await click(te, '⋯')
  await click(te, 'Изменить данные')
  await waitText(te, /Изменить данные/)
  await typeInto(te, 'textarea', 'IELTS, цель 7.0')
  await click(te, 'Сохранить')
  const noteSaved = await waitText(te, /IELTS, цель 7\.0/)
  await shot(te, 'after-edit-390')
  check('заметка сохранена и видна в карточке', noteSaved, (await text(te)).slice(0, 300).replace(/\n/g, ' | '))

  // ── 4. ученик по ссылке ─────────────────────────────────────────────────────────
  const st = await openAs(b, NEWBIE)
  await go(st, `/login?join=${code}`)
  await st.waitForFunction(() => location.pathname === '/', { polling: 250, timeout: 20000 }).catch(() => {})
  const prefilled = await st
    .waitForFunction((c) => [...document.querySelectorAll('input')].some((i) => i.value === c), { polling: 250, timeout: 20000 }, code)
    .then(() => true, () => false)
  check('ссылка → на Главной код уже в поле', prefilled)
  await shot(st, 'student-join-390')
  await click(st, 'Привязать')
  check('ученик привязался — на Главной его преподаватель', await waitText(st, /Преподаватель:\s*Мадина Смоук/))
  const left = await st.evaluate(() => localStorage.getItem('recall.pending_join'))
  check('код из ссылки больше не подставляется', left === null, String(left))

  await te.reload({ waitUntil: 'networkidle2' })
  check('у учителя та же карточка — «в приложении»', await waitText(te, /в приложении/) && /Тимур Ким/.test(await text(te)))
  check('заметка на месте после привязки', /IELTS, цель 7\.0/.test(await text(te)))
  check('под шапкой — студия ученика (домашка)', await waitText(te, /Собрать домашку|Домашка/))
  check('«Ещё: …» больше нет — плитки разделов', (await waitSel(te, '[data-section-tiles]')) && !/Ещё:/.test(await text(te)))
  const tileIds = await te.evaluate(() => [...document.querySelectorAll('[data-tile]')].map((x) => x.dataset.tile).join(','))
  check('шесть плиток по t6-2', tileIds === 'diag,program,words,placement,quests,report', tileIds)
  await shot(te, 'card-app-390')
  for (const id of ['diag', 'program', 'words', 'placement', 'quests', 'report']) {
    await tap(te, `[data-tile="${id}"]`)
    const opened = await waitSel(te, `[data-studio-section="${id}"]`)
    const inUrl = (await te.evaluate(() => location.search)).includes(`sec=${id}`)
    if (id === 'report') {
      const sheet = await waitText(te, /Печать \/ Сохранить в PDF/)
      await click(te, 'Закрыть')
      check('плитка «Отчёт родителям» → лист отчёта, «Закрыть» — к карточке', opened && inUrl && sheet && (await waitSel(te, '[data-section-tiles]')))
      continue
    }
    if (id === 'program') check('…в «Программе» — и «План дня»', await waitText(te, /План дня/))
    await tap(te, '[data-section-back]')
    check(`плитка «${id}» → экран раздела, «‹ Тимур Ким» — к плиткам`, opened && inUrl && (await waitSel(te, '[data-section-tiles]')))
  }
  check('строка про тариф под «Убрать из тарифа»', /останется в списке, но AI — по бесплатным лимитам/.test(await text(te)))
  await click(te, 'Убрать из тарифа')
  check('«Убрать из тарифа» → тост «Вернуть»', await waitText(te, /Тимур Ким — вне тарифа/))
  await click(te, 'Вернуть')
  check('«Вернуть» — снова в тарифе', await waitText(te, /Убрать из тарифа/))
  await go(te, '/teacher')
  check('мест занято 2 из 5', await waitText(te, /В приложении 2 из 5 мест тарифа/))

  // ── 4а. возврат в приложение: список перечитывается сам ────────────────────────
  // Фон и полминуты — подменой: visibilityState и часы страницы (ждать 30 с ни к чему)
  must(await admin.from('student_cards').insert({ teacher_id: tId, name: 'Карточка из фона', status: 'trial' }), 'карточка из фона')
  await te.evaluate(async () => {
    const real = Date.now.bind(Date)
    const setVis = (v) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    setVis('hidden')
    Date.now = () => real() + 31_000
    setVis('visible')
    Date.now = real
  })
  check('вернулся в приложение — список перечитался сам', await waitText(te, /Карточка из фона/))

  // ── 4б. новый ученик по ссылке: вход → онбординг → код уже в поле ─────────────
  const code2 = Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 31)]).join('')
  const c2 = await admin.from('student_cards').insert({ teacher_id: tId, name: 'Новичок по ссылке', status: 'trial', invite_code: code2 }).select('id').single()
  if (c2.error) throw new Error(`карточка 2: ${c2.error.message}`)
  const ctx2 = await b.createBrowserContext()
  const nb = await ctx2.newPage()
  await nb.setViewport({ width: 390, height: 844 })
  await nb.goto(`${APP_URL}/login?join=${code2}`, { waitUntil: 'networkidle2' })
  check('вход по ссылке: «Вас пригласил преподаватель»', await waitText(nb, /Вас пригласил преподаватель/))
  await nb.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Войти')?.click())
  await sleep(400)
  await nb.type('#f-email', ONBOARD)
  await nb.type('#f-password', PASS)
  await nb.click('button[type="submit"]')
  const toOnboarding = await nb
    .waitForFunction(() => location.pathname === '/onboarding', { polling: 250, timeout: 30000 })
    .then(() => true, () => false)
  check('новичок попал в онбординг', toOnboarding)
  await click(nb, 'Английский')
  await click(nb, 'Не знаю свой уровень')
  const pre2 = await nb
    .waitForFunction((c) => [...document.querySelectorAll('input')].some((i) => i.value === c), { polling: 250, timeout: 15000 }, code2)
    .then(() => true, () => false)
  check('онбординг: на последнем шаге код из ссылки уже в поле', pre2)
  await shot(nb, 'onboarding-join-390')
  await click(nb, 'Привязаться и начать')
  await nb.waitForFunction(() => location.pathname !== '/onboarding', { polling: 250, timeout: 20000 }).catch(() => {})
  const { data: linked2 } = await admin.from('student_cards').select('user_id, status').eq('id', c2.data.id).single()
  check('новичок привязан к своей карточке, она осталась «пробный»', linked2?.user_id === onbId && linked2?.status === 'trial', JSON.stringify(linked2))

  // ── 5. компьютер ───────────────────────────────────────────────────────────────
  await te.setViewport({ width: 1280, height: 800 })
  await go(te, '/teacher')
  check('1280: ничего не выбрано — подсказка справа', await waitText(te, /Выбери ученика слева/))
  await shot(te, 'list-1280')
  await te.evaluate(() => [...document.querySelectorAll('[data-card-row]')].find((r) => r.textContent.includes('Тимур'))?.querySelector('button')?.click())
  await sleep(800)
  const both = await te.evaluate(() => ({
    rows: document.querySelectorAll('[data-card-row]').length,
    name: document.querySelector('[data-card-name]')?.textContent ?? '',
  }))
  check('1280: список и карточка рядом', both.rows >= 2 && both.name === 'Тимур Ким', JSON.stringify(both))
  await waitSel(te, '[data-section-tiles]')
  const scroll = await te.evaluate(async () => {
    const pane = document.querySelector('[data-pane="detail"]')
    const list = document.querySelector('[data-pane="list"]')
    if (!pane || !list) return null
    const page = document.documentElement.scrollHeight - innerHeight
    const longer = pane.scrollHeight - pane.clientHeight
    pane.scrollTop = 300
    await new Promise((r) => setTimeout(r, 150))
    return { page, longer, pane: pane.scrollTop, list: list.scrollTop, win: scrollY }
  })
  check('1280: страница стоит, карточка прокручивается сама (d3)', !!scroll && scroll.page <= 1 && scroll.longer > 0 && scroll.pane > 0 && scroll.list === 0 && scroll.win === 0, JSON.stringify(scroll))
  await tap(te, '[data-tile="placement"]')
  await waitSel(te, '[data-studio-section="placement"]')
  const top = await te.evaluate(() => document.querySelector('[data-pane="detail"]')?.scrollTop)
  check('1280: раздел открылся с начала панели', top === 0, String(top))
  await shot(te, 'section-1280')
  await tap(te, '[data-section-back]')
  await waitSel(te, '[data-section-tiles]')
  await shot(te, 'card-1280')
} catch (e) {
  check('смоук дошёл до конца', false, String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '))
} finally {
  await b?.close().catch(() => {})
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {})
  await admin.from('allowed_emails').delete().in('email', [TEACHER, LINKED, NEWBIE, ONBOARD])
  console.log('Тестовые аккаунты удалены.')
}

const ok = results.filter(Boolean).length
console.log(`\nИтог: ${ok}/${results.length}`)
process.exitCode = ok === results.length ? 0 : 1
