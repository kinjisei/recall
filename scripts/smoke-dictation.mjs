/**
 * Смоук «Диктанта»: оба источника слов дают играбельный раунд.
 *
 * Проверяем регрессию, найденную 24.07: «Новые слова» брались из паков, а паки
 * подмешивались в пул, ТОЛЬКО если в колоде меньше need слов (для диктанта
 * need = 32). У кого колода больше — режим «Новые слова» показывал «Нет слов
 * для диктанта». Поэтому у тестового аккаунта колода заведомо больше 32 слов.
 *
 * Запуск: node scripts/smoke-dictation.mjs (dev-сервер на 5173)
 */
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import puppeteer from 'puppeteer-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:5173'
const EMAIL = 'dictation-smoke@recall.test'
const PASSWORD = 'Dictation!2026'

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
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// 40 слов — заведомо больше порога need=32, при котором ломался режим «Новые»
const WORDS = Array.from({ length: 40 }, (_, i) => [`word${i}`, `слово${i}`])

async function createUser() {
  await admin.from('allowed_emails').upsert({ email: EMAIL, note: 'dictation-smoke (временный)' })
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  })
  let id = data?.user?.id
  if (error && /already/i.test(error.message)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    id = list.users.find((u) => u.email === EMAIL)?.id
  } else if (error) throw new Error(error.message)
  const { data: decks } = await admin.from('decks').select('id').eq('owner_id', id).eq('lang', 'en')
  if (decks?.[0]) {
    await admin.from('cards').insert(
      WORDS.map(([front, back]) => ({ deck_id: decks[0].id, front, back })),
    )
  }
  return id
}

/** Состояние экрана диктанта: идёт раунд или заглушка «нет слов». */
function state() {
  const text = document.querySelector('main')?.innerText ?? ''
  return {
    hasInput: !!document.querySelector('input[placeholder="Слово…"]'),
    empty: /Нет слов для диктанта|Пока нет своих слов/.test(text),
    loading: /Готовлю раунд/.test(text),
  }
}

/**
 * Ждём, пока экран ПЕРЕСТАНЕТ грузиться: словарь приезжает ленивым чанком, и
 * на холодном dev-сервере это дольше пары секунд. Фиксированная пауза делала
 * смоук мигающим — первый прогон падал, второй проходил.
 */
async function settled(page, ms = 20000) {
  // даём React перерисоваться после клика: иначе на экране ещё прошлый раунд,
  // и ожидание завершится мгновенно, ничего не проверив
  await new Promise((r) => setTimeout(r, 500))
  const until = Date.now() + ms
  let s = await page.evaluate(state)
  while (Date.now() < until && !s.hasInput && !s.empty) {
    await new Promise((r) => setTimeout(r, 400))
    s = await page.evaluate(state)
  }
  return s
}

const main = async () => {
  let userId = null
  const PORT = 9500 + (Date.now() % 400)
  spawn(EDGE, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${tmpdir()}\\recall-dictation-${Date.now()}`, '--no-first-run', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref()

  let browser = null
  for (let i = 0; i < 30 && !browser; i++) {
    await new Promise((r) => setTimeout(r, 500))
    browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }).catch(() => null)
  }
  if (!browser) throw new Error('Edge не поднялся')

  try {
    userId = await createUser()
    const page = await browser.newPage()
    await page.setViewport({ width: 390, height: 700, isMobile: true, hasTouch: true })
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('recall.onboarded', '1')
        localStorage.setItem('recall.deck_tutorial_seen', '1')
      } catch {}
    })

    await page.goto(BASE + '/login', { waitUntil: 'networkidle2' })
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => /Войти/.test(x.textContent || '') && !/Создать/.test(x.textContent || ''),
      )
      b?.click()
    })
    await page.waitForSelector('input[type="email"]', { timeout: 15000 })
    await page.type('input[type="email"]', EMAIL)
    await page.type('input[type="password"]', PASSWORD)
    await page.evaluate(() => document.querySelector('form')?.requestSubmit())
    await new Promise((r) => setTimeout(r, 3000))

    await page.goto(BASE + '/practice?m=dictation', { waitUntil: 'networkidle2' })

    // по умолчанию открыт режим «Новые слова»
    let s = await settled(page)
    check('«Новые слова»: раунд собрался', s.hasInput && !s.empty, s.empty ? 'заглушка «нет слов»' : '')

    // переключаемся на «Мои слова»
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Мои слова')
      b?.click()
    })
    s = await settled(page)
    check('«Мои слова»: раунд собрался', s.hasInput && !s.empty, s.empty ? 'заглушка «нет слов»' : '')

    // обратно на «Новые слова» — переключение туда-обратно не ломает раунд
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Новые слова')
      b?.click()
    })
    s = await settled(page)
    check('переключение туда-обратно работает', s.hasInput && !s.empty)

    // экран не должен ездить (режим раунда прячет шапку и навигацию)
    const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    check('диктант не ездит по вертикали', overflow <= 0, `лишнего ${overflow}px`)
  } catch (e) {
    check(`смоук упал: ${e.message}`, false)
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    await admin.from('allowed_emails').delete().eq('email', EMAIL)
    await browser.close().catch(() => {})
  }

  const failed = results.filter((r) => !r).length
  console.log(`\n${results.length - failed}/${results.length} проверок прошло`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
