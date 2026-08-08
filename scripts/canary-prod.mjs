/**
 * Сторож прода: ходит по живому приложению как обычный пользователь и падает,
 * если что-то сломалось. Гоняется по расписанию (.github/workflows/canary.yml).
 *
 * Зачем. Мы деплоим часто, а узнаём о поломке только если человек напишет —
 * обычно он не пишет, а уходит. Сбор ошибок тут не помогает: он ждёт первого
 * пострадавшего. Сторож находит поломку сам, даже когда в приложении никого нет.
 *
 * ⚠️ БЕЗ service_role. Ключ от всей базы в настройках репозитория — плохой
 * размен: доступ к репозиторию превратился бы в доступ ко всем данным
 * учеников. Сторож работает под ОБЫЧНЫМ аккаунтом-канарейкой с публичным
 * anon-ключом (он и так лежит в бандле фронтенда), то есть видит ровно то же,
 * что настоящий пользователь.
 *
 * Переменные окружения:
 *   RECALL_URL       — адрес прода (по умолчанию боевой)
 *   SUPABASE_URL     — публичный, не секрет
 *   SUPABASE_ANON_KEY— публичный, лежит в бандле
 *   CANARY_EMAIL / CANARY_PASSWORD — постоянный тестовый аккаунт (единственный
 *                      настоящий секрет). Заводится один раз руками.
 *
 * Локально: node scripts/canary-prod.mjs (возьмёт значения из .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'

const localEnv = (() => {
  const p = new URL('../.env.local', import.meta.url)
  if (!existsSync(p)) return {}
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  )
})()
const cfg = { ...localEnv, ...process.env }

const SITE = cfg.RECALL_URL || 'https://recall-pgkz.vercel.app'
const SUPA_URL = cfg.SUPABASE_URL || cfg.VITE_SUPABASE_URL
const SUPA_ANON = cfg.SUPABASE_ANON_KEY || cfg.VITE_SUPABASE_ANON_KEY
const EMAIL = cfg.CANARY_EMAIL
const PASSWORD = cfg.CANARY_PASSWORD

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

async function main() {
  if (!SUPA_URL || !SUPA_ANON) throw new Error('нет SUPABASE_URL / SUPABASE_ANON_KEY')
  if (!EMAIL || !PASSWORD) throw new Error('нет CANARY_EMAIL / CANARY_PASSWORD')

  // --- 1. Сайт отдаётся и внутри действительно приложение --------------------
  const page = await fetch(SITE, { redirect: 'follow' })
  const html = await page.text()
  check('страница открывается', page.ok, `HTTP ${page.status}`)
  // Пустая страница с кодом 200 — самая коварная поломка: мониторинг «по коду
  // ответа» её не видит, а человек видит белый экран.
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
  check('в HTML есть собранный скрипт', Boolean(asset), asset ?? 'не найден')
  if (asset) {
    const js = await fetch(SITE + asset)
    // Длину меряем по ТЕЛУ: Vercel отдаёт скрипт сжатым и заголовка
    // content-length может не быть — проверка по нему падала на исправном проде.
    const jsText = js.ok ? await js.text() : ''
    check(
      'скрипт приложения отдаётся',
      js.ok && jsText.length > 1000,
      js.ok ? `${Math.round(jsText.length / 1024)} КБ` : `HTTP ${js.status}`,
    )
  }

  // --- 2. Вход работает ------------------------------------------------------
  const sb = createClient(SUPA_URL, SUPA_ANON, { auth: { persistSession: false } })
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  check('вход по паролю работает', !authErr && Boolean(auth?.session), authErr?.message ?? '')
  if (!auth?.session) {
    // дальше идти бессмысленно: без сессии всё остальное упадёт по другой причине
    return
  }
  const token = auth.session.access_token

  // --- 3. База отвечает на то, что нужно каждому экрану ---------------------
  const { error: planErr } = await sb.rpc('get_my_plan')
  check('тариф и энергия читаются (get_my_plan)', !planErr, planErr?.message ?? '')

  const { error: deckErr } = await sb.from('decks').select('id').limit(1)
  check('колоды читаются', !deckErr, deckErr?.message ?? '')

  // --- 4. AI отвечает end-to-end --------------------------------------------
  // Один лёгкий запрос в сутки: карман light — сотни в день, влияние нулевое,
  // зато проверяется вся цепочка «клиент → наш сервер → модель».
  const ai = await fetch(`${SITE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      task: 'word',
      messages: [{ role: 'user', content: 'Translate to Russian, one word: book' }],
    }),
  })
  const aiBody = await ai.json().catch(() => ({}))
  check('AI отвечает', ai.ok && typeof aiBody.text === 'string' && aiBody.text.length > 0,
    ai.ok ? '' : `HTTP ${ai.status}: ${aiBody.error ?? ''}`)

  // --- 5. Права на месте -----------------------------------------------------
  // Канарейка — обычный ученик, значит генерация материалов ей запрещена.
  // Если это вдруг начнёт проходить, дыра в правах важнее любой другой поломки.
  const gate = await fetch(`${SITE}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ task: 'material', messages: [{ role: 'user', content: 'x' }] }),
  })
  check('ученику закрыта генерация материалов', gate.status === 403, `HTTP ${gate.status}`)

  await sb.auth.signOut()
}

try {
  await main()
} catch (e) {
  check('прогон завершился', false, e.message)
}

const ok = results.filter((r) => r.ok).length
console.log(`\nИтог: ${ok}/${results.length}`)
if (ok !== results.length) {
  console.log('\nУпало:')
  for (const r of results.filter((x) => !x.ok)) console.log('  • ' + r.name)
}
process.exitCode = ok === results.length ? 0 : 1
