/**
 * Замер лишней прокрутки на экранах мини-игр (390×844, как iPhone 12).
 * Жалоба владельца: «в играх экран ездит и мешает». Скрипт меряет, НА СКОЛЬКО
 * страница выше экрана — и заодно показывает, из чего складывается высота.
 *
 * Запуск: node scripts/measure-scroll.mjs   (dev-сервер на 5173)
 * Тестовый аккаунт со словами создаётся через service_role и удаляется в конце.
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'scroll-audit@recall.test'
const PASSWORD = 'Scroll!2026-temp'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const WORDS = [
  ['apple', 'яблоко'], ['bridge', 'мост'], ['cloud', 'облако'], ['dream', 'мечта'],
  ['forest', 'лес'], ['garden', 'сад'], ['honey', 'мёд'], ['island', 'остров'],
  ['jacket', 'куртка'], ['kettle', 'чайник'], ['ladder', 'лестница'], ['mirror', 'зеркало'],
  ['needle', 'игла'], ['ocean', 'океан'], ['pocket', 'карман'], ['river', 'река'],
  ['shadow', 'тень'], ['tower', 'башня'], ['valley', 'долина'], ['window', 'окно'],
]

async function createTestUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'scroll-audit (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  if (error && !/already/i.test(error.message)) throw new Error('createUser: ' + error.message)
  let id = data?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === EMAIL)?.id
  }
  // словам нужна колода — она создаётся триггером; берём английскую
  const { data: decks } = await admin.from('decks').select('id').eq('owner_id', id).eq('lang', 'en')
  const deckId = decks?.[0]?.id
  if (deckId) {
    await admin.from('cards').insert(
      WORDS.map(([front, back]) => ({ deck_id: deckId, front, back, example: `This is a ${front}.` })),
    )
  }
  return id
}

const SCREENS = [
  { name: 'Практика (хаб)', path: '/practice' },
  { name: 'Значения (пары)', path: '/practice?m=match' },
  { name: 'Пропуск', path: '/practice?m=gap' },
  { name: 'Перевод', path: '/practice?m=translate' },
  { name: 'Аудирование', path: '/practice?m=listening' },
  { name: 'Спринт', path: '/practice?m=sprint' },
  { name: 'Диктант', path: '/practice?m=dictation' },
  { name: 'Собери фразу', path: '/practice?m=sentence' },
  { name: 'Выбери форму', path: '/practice?m=gr-mcq' },
  { name: 'Впиши слово', path: '/practice?m=gr-fill' },
  { name: 'Собери предложение', path: '/practice?m=gr-order' },
  { name: 'Повторение (колода)', path: '/practice?m=review' },
]

/** В странице: из чего складывается высота и сколько лишнего. */
function measure() {
  const de = document.documentElement
  const main = document.querySelector('main')
  const header = document.querySelector('header')
  const nav = document.querySelector('nav')
  const cs = main ? getComputedStyle(main) : null
  return {
    viewport: window.innerHeight,
    scrollHeight: de.scrollHeight,
    overflow: de.scrollHeight - window.innerHeight,
    headerH: header ? Math.round(header.getBoundingClientRect().height) : 0,
    mainContentH: main ? Math.round(main.firstElementChild?.getBoundingClientRect().height ?? 0) : 0,
    mainPadTop: cs ? cs.paddingTop : '',
    mainPadBottom: cs ? cs.paddingBottom : '',
    navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
  }
}

const main = async () => {
  let userId = null
  // порт свой на каждый запуск: иначе новый Edge не займёт занятый порт, а
  // puppeteer.connect молча прицепится к БРАУЗЕРУ ПРОШЛОГО ПРОГОНА — он уже
  // залогинен, и скрипт меряет чужую сессию (полчаса на этом потеряно)
  const PORT = 9400 + (Date.now() % 500)
  spawn(EDGE, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}\\recall-scroll-${Date.now()}`, '--no-first-run', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref()

  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    userId = await createTestUser()
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
      } catch {}
    })

    // вход
    await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find((x) => /Войти/.test(x.textContent || ''))
      if (b && !/Создать/.test(b.textContent || '')) b.click()
    })
    await new Promise((r) => setTimeout(r, 400))
    await page.waitForSelector('input[type="email"]', { timeout: 15000 }).catch(async () => {
      const info = await page.evaluate(() => ({
        url: location.href,
        inputs: [...document.querySelectorAll('input')].map((i) => i.type),
        text: document.body.innerText.slice(0, 200),
      }))
      throw new Error('поля входа не найдены: ' + JSON.stringify(info))
    })
    const emailInput = await page.$('input[type="email"]')
    const pwInput = await page.$('input[type="password"]')
    if (!emailInput || !pwInput) throw new Error('поля входа не найдены')
    await emailInput.type(EMAIL)
    await pwInput.type(PASSWORD)
    await page.evaluate(() => document.querySelector('form')?.requestSubmit())
    await new Promise((r) => setTimeout(r, 3000))

    // Высоты: 844 — iPhone 12 без адресной строки (PWA), 700 — он же в браузере,
    // 640 — компактный Android. Владелец жалуется на «ездит» — значит, смотрим
    // не только идеальный случай.
    for (const vh of [844, 700, 640]) {
      await page.setViewport({ width: 390, height: vh, isMobile: true, hasTouch: true })
      console.log(`\n=== Экран 390×${vh} ===`)
      await measureAll(page, vh)
    }
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    // именно close, а не disconnect: disconnect оставляет Edge висеть, и
    // следующий прогон подключается к нему вместо своего
    await browser.close().catch(() => {})
  }
}

async function measureAll(page, vh) {
  {
    for (const s of SCREENS) {
      await page.goto(BASE + s.path, { waitUntil: 'networkidle2', timeout: 30000 })
      await new Promise((r) => setTimeout(r, 1800))
      const before = await page.evaluate(measure)

      // играем несколько ходов: высота меняется, когда появляется разбор ответа
      let worst = before
      for (let step = 0; step < 4; step++) {
        const clicked = await page.evaluate(() => {
          // кликаем первый вариант ответа / кнопку продолжения внутри контента
          const btns = [...document.querySelectorAll('main button')].filter((b) => {
            const r = b.getBoundingClientRect()
            return r.width > 60 && r.height > 30 && !/Назад|Выйти/.test(b.textContent || '')
          })
          if (!btns.length) return false
          btns[0].click()
          return true
        })
        if (!clicked) break
        await new Promise((r) => setTimeout(r, 700))
        const m = await page.evaluate(measure)
        if (m.overflow > worst.overflow) worst = m
      }

      const v0 = before.overflow > 0 ? `+${before.overflow}` : '0'
      const v1 = worst.overflow > 0 ? `+${worst.overflow}` : '0'
      const verdict = worst.overflow > 0 ? `ЕЗДИТ ${v1}px` : 'не ездит'
      console.log(
        `${s.name.padEnd(22)} ${String(verdict).padEnd(16)} ` +
          `(в начале ${v0}, в игре ${v1}) [контент ${before.mainContentH}→${worst.mainContentH}]`,
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
