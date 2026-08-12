/**
 * Смоук восстановления и смены пароля.
 *
 * Зачем. Это единственный путь обратно в аккаунт для человека, который уже не
 * может войти. Сломается — он не напишет в поддержку, он просто уйдёт, и мы
 * даже не узнаем. При этом путь целиком лежит на внешней системе (Supabase
 * Auth), и «у меня всё собралось» тут не значит ничего.
 *
 * ⚠️ НИ ОДНОГО ПИСЬМА не отправляется:
 *   • запрос письма с экрана перехватываем в браузере и отвечаем сами —
 *     проверяем, что уходит верный адрес и верный redirect;
 *   • настоящую ссылку и код берём через admin.generateLink() — Supabase
 *     выдаёт их, не посылая почту.
 * Иначе каждый прогон жёг бы квоту Brevo и слал письма на несуществующий домен,
 * портя репутацию отправителя.
 *
 * Запуск: dev-сервер на 5173, затем `node scripts/smoke-password-reset.mjs`.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { profileDir } from './_profile.mjs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
// По умолчанию локальный сервер. Прод проверяется тем же прогоном:
//   AUDIT_BASE_URL=https://recall-pgkz.vercel.app node scripts/smoke-password-reset.mjs
// База у прода и у dev одна и та же, так что временный аккаунт и ссылки
// восстановления работают одинаково — писем по-прежнему не отправляется.
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'pwreset-smoke@recall.test'
const PASS_OLD = 'Old!Password2026'
const PASS_LINK = 'Link!Password2026'
const PASS_CODE = 'Code!Password2026'
const PASS_SETTINGS = 'Settings!Password2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const anon = () => createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })

const results = []
const check = (n, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const seen = (page, t) => page.evaluate((x) => (document.body.innerText || '').includes(x), t)
/**
 * Дождаться текста и вернуть да/нет вместо исключения: иначе провал печатается
 * как «Waiting failed: 10000ms exceeded», и по такому сообщению непонятно, что
 * именно сломалось. Проверка обязана называть себя.
 */
const waitText = (page, text, ms = 15000) =>
  page
    .waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms, polling: 250 }, text)
    .then(() => true)
    .catch(() => false)
/**
 * Нажатие с ожиданием ГОТОВНОСТИ кнопки.
 *
 * ⚠️ Клик по disabled-кнопке браузер молча проглатывает. Кнопки форм тут
 * заблокированы, пока состояние React не догнало введённый текст, и простой
 * click раз в несколько прогонов уходил в пустоту: экран не менялся, проверка
 * ждала результат и падала «пароль не сменился» на исправном коде.
 */
const tap = async (page, text, ms = 6000) => {
  const found = await page
    .waitForFunction(
      (t) =>
        [...document.querySelectorAll('button, a, [role=button]')].some(
          (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
        ),
      { timeout: ms, polling: 250 },
      text,
    )
    .then(() => true)
    .catch(() => false)
  if (!found) return false
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role=button]')].find(
      (e) => (e.textContent || '').trim().includes(t) && !e.disabled,
    )
    el?.click()
  }, text)
  await sleep(700)
  return true
}
/**
 * Заполнение поля без клавиатуры и кликов.
 *
 * ⚠️ Два способа уже подвели. `page.click(sel, {clickCount:3})` по управляемому
 * React полю не ставил выделение — новый текст вклеивался в середину старого,
 * адрес получался невалидным, форма молча не отправлялась, и проверка падала с
 * видом «фича сломана». Клавиатурный ввод (Ctrl+A и печать) роняет вкладку на
 * длинных прогонах: «Protocol error: Target closed».
 *
 * React слушает событие input и читает значение через нативный сеттер — им и
 * пользуемся. Результат сразу перечитываем: молчаливое незаполнение поля
 * страшнее падения.
 */
const typeInto = async (page, selector, value) => {
  await page.waitForSelector(selector, { timeout: 10000, polling: 250 })
  await page.$eval(
    selector,
    (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
    value,
  )
  const got = await page.$eval(selector, (el) => el.value)
  if (got !== value) throw new Error(`в ${selector} оказалось «${got}» вместо «${value}»`)
}

/** Можно ли войти этим паролем. Отдельный клиент — чтобы не путать сессии. */
async function canSignIn(password) {
  const { data, error } = await anon().auth.signInWithPassword({ email: EMAIL, password })
  return { ok: !error && !!data?.session, session: data?.session ?? null, error: error?.message }
}

/** Жив ли refresh-токен: именно он переживает смену пароля, если её не оборвать. */
async function refreshWorks(refreshToken) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  return res.ok
}

let userId = null
let browser = null

try {
  // ---- аккаунт для проверки ------------------------------------------------
  for (const u of (await admin.auth.admin.listUsers({ perPage: 200 })).data.users) {
    if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)
  }
  const made = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASS_OLD,
    email_confirm: true,
  })
  userId = made.data?.user?.id
  check('тестовый аккаунт создан', !!userId, made.error?.message ?? '')

  // ---- 1. адрес, которого нет: сервер не выдаёт разницы ---------------------
  // Письма при этом не уходит вообще — адресата не существует.
  const ghost = await anon().auth.resetPasswordForEmail('no-such-person-zzz@recall.test', {
    redirectTo: `${BASE}/reset-password`,
  })
  check('сброс на несуществующий адрес не выдаёт ошибку', !ghost.error, ghost.error?.message ?? '')

  // ---- браузер -------------------------------------------------------------
  const port = 9600 + Math.floor(Math.random() * 300)
  spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      '--no-first-run',
      '--disable-gpu',
      `--user-data-dir=${profileDir('pwreset')}`,
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  ).unref()
  for (let i = 0; i < 40 && !browser; i++) {
    try {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` })
    } catch {
      await sleep(500)
    }
  }
  const jsErrors = []

  // ---- 2 и 3 живут на ОТДЕЛЬНОЙ вкладке -----------------------------------
  // ⚠️ Перехват запросов включается на страницу целиком, и выключить его
  // бесследно нельзя: между снятием обработчика и выключением перехвата любой
  // запрос остаётся висеть навсегда, а вкладка после этого перестаёт отвечать
  // на клики — проверка «зависает» уже на следующем шаге и выглядит как
  // сломанная фича. Поэтому вкладку с перехватом просто закрываем.
  const tab = await browser.newPage()
  await tab.setViewport({ width: 420, height: 900 })
  tab.on('pageerror', (e) => jsErrors.push(e.message))

  await tab.goto(`${BASE}/login`, { waitUntil: 'networkidle2', timeout: 30000 })
  await tap(tab, 'Войти') // переключиться со вкладки регистрации на вход
  const hasForgot = await tap(tab, 'Забыли пароль?')
  await tab.waitForFunction(() => location.pathname === '/forgot', { timeout: 10000, polling: 250 }).catch(() => {})
  check('со входа есть «Забыли пароль?» и она ведёт на /forgot', hasForgot && tab.url().includes('/forgot'), tab.url())

  // ---- 3. запрос письма: перехватываем, письма не шлём ---------------------
  let recoverBody = null
  let recoverUrl = ''
  // ⚠️ Подменять надо И preflight: запрос к Supabase идёт с заголовком apikey,
  // поэтому браузер сперва шлёт OPTIONS. Ответ без заголовков CORS он молча
  // отбросит — и настоящий POST просто не уйдёт, а на экране будет «нет связи».
  const CORS = {
    'Access-Control-Allow-Origin': BASE,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  const onRequest = (req) => {
    if (!req.url().includes('/auth/v1/recover')) return req.continue().catch(() => {})
    if (req.method() === 'OPTIONS') {
      return req.respond({ status: 204, headers: CORS }).catch(() => {})
    }
    recoverUrl = req.url()
    try {
      recoverBody = JSON.parse(req.postData() || '{}')
    } catch {
      recoverBody = { parseError: req.postData() ?? null }
    }
    return req
      .respond({ status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: '{}' })
      .catch(() => {})
  }
  await tab.setRequestInterception(true)
  tab.on('request', onRequest)

  await typeInto(tab, '#f-email', EMAIL)
  await tap(tab, 'Прислать письмо')
  await tab
    .waitForFunction(() => document.body.innerText.includes('Если такой адрес у нас есть'), {
      timeout: 10000,
      polling: 250,
    })
    .catch(() => {})
  check('запрос ушёл с верным адресом', recoverBody?.email === EMAIL, JSON.stringify(recoverBody))
  // redirect_to Supabase кладёт в АДРЕС запроса, а не в тело.
  check(
    'в запросе верный адрес возврата',
    decodeURIComponent(recoverUrl).includes(`${BASE}/reset-password`),
    recoverUrl,
  )
  const neutral = await tab.evaluate(() => document.body.innerText.trim())
  check(
    'ответ экрана нейтральный — существование аккаунта не раскрыто',
    neutral.includes('Если такой адрес у нас есть'),
  )

  // Тот же экран для адреса, которого нет: текст обязан совпасть слово в слово,
  // иначе разница сама по себе и есть ответ «такой аккаунт существует».
  await tap(tab, 'Ошибся в адресе')
  await tab.waitForSelector('#f-email', { timeout: 10000, polling: 250 })
  await typeInto(tab, '#f-email', 'no-such-person-zzz@recall.test')
  const typed = await tab.$eval('#f-email', (el) => el.value)
  const clicked = await tap(tab, 'Прислать письмо')
  const alert = await tab.evaluate(() => document.querySelector('[role=alert]')?.textContent ?? '')
  if (typed !== 'no-such-person-zzz@recall.test' || !clicked || alert) {
    console.log(`   диагностика: в поле «${typed}», кнопка нажата: ${clicked}, ошибка на экране: «${alert}»`)
  }
  await tab
    .waitForFunction(() => document.body.innerText.includes('Если такой адрес у нас есть'), {
      timeout: 10000,
      polling: 250,
    })
    .catch(() => {})
  const ghostText = await tab.evaluate(() => document.body.innerText.trim())
  check(
    'запрос по несуществующему адресу тоже ушёл',
    recoverBody?.email === 'no-such-person-zzz@recall.test',
    JSON.stringify(recoverBody?.email),
  )
  check(
    'для несуществующего адреса ответ слово в слово тот же',
    ghostText.replace(/no-such-person-zzz@recall\.test/g, 'X') ===
      neutral.replace(new RegExp(EMAIL.replace(/[.@]/g, '\\$&'), 'g'), 'X'),
    ghostText.slice(0, 160).replace(/\n/g, ' | '),
  )

  await tab.close()

  // Дальше — чистая вкладка без перехвата.
  const page = await browser.newPage()
  await page.setViewport({ width: 420, height: 900 })
  page.on('pageerror', (e) => jsErrors.push(e.message))

  // ---- 4. вторая сессия: она должна умереть после сброса -------------------
  const other = await canSignIn(PASS_OLD)
  check('до сброса старый пароль работает', other.ok, other.error ?? '')
  const otherRefresh = other.session?.refresh_token
  check('чужая сессия жива до сброса', await refreshWorks(otherRefresh))

  // ---- 4б. открытие ссылки не должно тратить токен -------------------------
  // Ссылку открывают ЗА человека: антивирусы, превью в мессенджерах,
  // предзагрузка почтового клиента. Если экран проверяет токен при загрузке,
  // такой «посетитель» сжигает его, и человек по своей же ссылке видит
  // «недействительна». Берём отдельную ссылку, открываем страницу и убеждаемся,
  // что токен ПОСЛЕ этого всё ещё живой.
  const linkPrefetch = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
  const hashPrefetch = linkPrefetch.data?.properties?.hashed_token
  await page.goto(`${BASE}/reset-password?token_hash=${hashPrefetch}&type=recovery`, {
    waitUntil: 'networkidle2',
    timeout: 30000, polling: 250,
  })
  await sleep(1500)
  const stillAlive = await anon().auth.verifyOtp({ type: 'recovery', token_hash: hashPrefetch })
  check(
    'открытие ссылки НЕ тратит токен (его сжигают почтовые сканеры)',
    !stillAlive.error,
    stillAlive.error?.message ?? '',
  )

  // ---- 5. путь по ССЫЛКЕ ---------------------------------------------------
  const link = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
  const tokenHash = link.data?.properties?.hashed_token
  check('ссылка восстановления получена без отправки письма', !!tokenHash, link.error?.message ?? '')

  await page.goto(`${BASE}/reset-password?token_hash=${tokenHash}&type=recovery`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  })
  await sleep(900)
  check('по ссылке не спрашивают адрес и код', !(await seen(page, 'Код из письма')))
  check(
    'токен вычищен из адресной строки',
    !page.url().includes('token_hash'),
    page.url(),
  )

  // ⚠️ Перезагрузка страницы не должна ломать восстановление. Токен убран из
  // адреса — и если он живёт только в памяти вкладки, то после F5 (своего или
  // от обновления PWA) исчезает совсем: человек с рабочей ссылкой упирается в
  // форму «введите код», которого он не знает, потому что письмо не читал.
  await page.reload({ waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(900)
  check('после перезагрузки страницы ссылка всё ещё действует', !(await seen(page, 'Код из письма')))

  await typeInto(page, '#f-new-password', PASS_LINK)
  await tap(page, 'Сохранить пароль и войти')
  check('пароль по ссылке сменён', await waitText(page, 'Пароль изменён'))

  const withNew = await canSignIn(PASS_LINK)
  check('новый пароль работает', withNew.ok, withNew.error ?? '')
  const withOld = await canSignIn(PASS_OLD)
  check('старый пароль больше не работает', !withOld.ok, withOld.error ?? 'ВОШЁЛ')
  // ⚠️ Эта проверка сторожит ПОВЕДЕНИЕ SUPABASE, а не нашу строчку: чужие
  // сессии он обрывает и сам (мутация «убрать наш signOut» оставляет её
  // зелёной). Держим обе — свою строку как явное намерение, проверку как
  // сторожа контракта, на котором держится смысл сброса.
  check('чужая сессия оборвана', !(await refreshWorks(otherRefresh)))

  // А вот это — уже НАШЕ решение: scope 'others', а не 'global'. Человек,
  // сменивший пароль, остаётся в приложении на своём устройстве и не вводит
  // тот же пароль второй раз подряд.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(1200)
  check(
    'после сброса человек остаётся в аккаунте на этом устройстве',
    !page.url().includes('/login'),
    page.url(),
  )

  // ---- 6. ссылка одноразовая ----------------------------------------------
  const reuse = await anon().auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  check('та же ссылка второй раз не срабатывает', !!reuse.error, reuse.error?.message ?? 'СРАБОТАЛА')

  // ---- 6б. протухшая ссылка не запирает экран ------------------------------
  // Ссылка гаснет легко: полчаса на размышления или повторный запрос письма.
  // Экран обязан после отказа вернуть поля кода — иначе человек с новым письмом
  // в руках не может ничего ввести и остаётся в тупике.
  const linkStale = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
  const staleHash = linkStale.data?.properties?.hashed_token
  await page.goto(`${BASE}/reset-password?token_hash=${staleHash}&type=recovery`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  })
  await sleep(700)
  // гасим эту ссылку, запросив следующую — как сделал бы нетерпеливый человек
  await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
  await typeInto(page, '#f-new-password', 'Stale!Password2026')
  await tap(page, 'Сохранить пароль и войти')
  check(
    'протухшая ссылка объясняет себя',
    await waitText(page, 'недействительны', 10000),
  )
  check('после отказа экран возвращает поля кода', await seen(page, 'Код из письма'))

  // ---- 7. путь по КОДУ (человек за другим компьютером) ---------------------
  const link2 = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL })
  const code = link2.data?.properties?.email_otp
  check('код из письма получен', !!code && /^\d{6,10}$/.test(code), String(code))

  await page.goto(`${BASE}/reset-password`, { waitUntil: 'networkidle2', timeout: 30000 })
  await sleep(700)
  check('без ссылки экран просит адрес и код', await seen(page, 'Код из письма'))
  // ⚠️ Пароля на этом шаге быть НЕ должно: пока код не принят, менять нечего.
  check('до проверки кода поля пароля нет', (await page.$('#f-new-password')) === null)

  // ---- 7б. неверный код до пароля не пускает -------------------------------
  await typeInto(page, '#f-email', EMAIL)
  await typeInto(page, '#f-code', '00000000')
  await tap(page, 'Проверить код')
  check('неверный код отклонён на экране', await waitText(page, 'Код не подошёл', 10000))
  check('после неверного кода пароль всё ещё скрыт', (await page.$('#f-new-password')) === null)

  // ---- 7в. верный код открывает смену пароля -------------------------------
  await typeInto(page, '#f-code', code)
  await tap(page, 'Проверить код')
  check('верный код принят — открылась смена пароля', await waitText(page, 'Код принят', 10000))
  await typeInto(page, '#f-new-password', PASS_CODE)
  await tap(page, 'Сохранить пароль и войти')
  check('пароль по коду сменён', await waitText(page, 'Пароль изменён'))
  const afterCode = await canSignIn(PASS_CODE)
  check('пароль из кода работает', afterCode.ok, afterCode.error ?? '')

  // ---- 8. чужой код не подходит и на стороне сервера -----------------------
  const wrong = await anon().auth.verifyOtp({ type: 'recovery', email: EMAIL, token: '00000000' })
  check('выдуманный код отклонён сервером', !!wrong.error, wrong.error?.message ?? 'ПРОШЁЛ')

  // ---- 9. смена пароля в Настройках ---------------------------------------
  // Заново входить не нужно и НЕЛЬЗЯ: после сброса вкладка уже в аккаунте, и
  // /login сразу перебрасывает на главную (проверка ждала бы поле входа вечно).
  // Что новый пароль пускает внутрь, проверено выше через API.
  const other2 = await canSignIn(PASS_CODE) // посторонняя сессия — её тоже обязаны оборвать
  const other2Refresh = other2.session?.refresh_token

  // Свежий аккаунт не прошёл онбординг, и /settings уводит на него.
  await page.evaluate(() => localStorage.setItem('recall.onboarded', '1'))
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle2', timeout: 30000 })
  // Ждём САМ блок по якорю, а не его текст: innerText отдаёт только отрисованное,
  // и на длинной странице проверка «есть слово Безопасность» краснела через раз
  // — на работающем коде.
  const settingsShown = await page
    .waitForSelector('#security', { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  check('в Настройках есть блок «Безопасность»', settingsShown)
  if (!settingsShown) {
    console.log('   диагностика: адрес', page.url())
    console.log('   разделы:', await page.$$eval('h2', (els) => els.map((e) => e.textContent)))
  }
  await tap(page, 'Сменить пароль')
  await typeInto(page, '#pw-current', 'совершенно-не-тот-пароль')
  await typeInto(page, '#pw-next', PASS_SETTINGS)
  await tap(page, 'Сохранить пароль')
  check('без текущего пароля сменить нельзя', await waitText(page, 'Текущий пароль неверный', 10000))

  await typeInto(page, '#pw-current', PASS_CODE)
  await typeInto(page, '#pw-next', PASS_SETTINGS)
  await tap(page, 'Сохранить пароль')
  check('пароль из Настроек сменён', await waitText(page, 'Пароль изменён'))
  const afterSettings = await canSignIn(PASS_SETTINGS)
  check('пароль из Настроек работает', afterSettings.ok, afterSettings.error ?? '')
  check('чужая сессия оборвана и здесь', !(await refreshWorks(other2Refresh)))

  check('JS-ошибок за прогон нет', jsErrors.length === 0, jsErrors[0] ?? '')
} catch (e) {
  console.error('СБОЙ:', e.message)
  results.push(false)
} finally {
  if (browser) await browser.close().catch(() => {})
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
  console.log('Тестовый аккаунт удалён.')
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
  setTimeout(() => process.exit(process.exitCode ?? 0), 400)
}
