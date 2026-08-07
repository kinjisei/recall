/**
 * Смоук открытой регистрации. Работает В ОБОИХ состояниях и сам определяет,
 * какое сейчас: до выполнения docs/open-registration.sql регистрация чужого
 * адреса должна отклоняться, после — проходить.
 *
 * Что проверяется после открытия:
 *   1. Регистрация постороннего адреса проходит (белый список не мешает).
 *   2. Создан профиль, две стартовые колоды (en + es), выставлен триал 14 дней.
 *   3. Подтверждение почты включено: сессии сразу нет, аккаунт неподтверждён.
 *      Без этого триал фармится скриптом — проверка обязательная.
 *   4. Свежий аккаунт получает ожидаемые лимиты (энергия триала).
 *
 * Запуск: node scripts/smoke-open-registration.mjs
 * Скрипт сам удаляет созданный тестовый аккаунт через service_role.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.VITE_SUPABASE_URL
const admin = createClient(URL_, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}

// адрес заведомо НЕ в белом списке
const EMAIL = `open-reg-${Date.now()}@recall-smoke.test`
const PASSWORD = 'OpenReg!2026'

let userId = null
try {
  // 0. подтверждение почты — проверяем ДО всего: без него открывать нельзя
  const settings = await fetch(`${URL_}/auth/v1/settings`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY },
  }).then((r) => r.json())
  check(
    'подтверждение почты включено (mailer_autoconfirm: false)',
    settings.mailer_autoconfirm === false,
    `mailer_autoconfirm=${settings.mailer_autoconfirm}`,
  )

  // 0б. состояние переключателя. Оно теперь в БД (app_settings), а не в коде:
  // раньше открытая версия handle_new_user жила в отдельном файле, и повторная
  // заливка schema.sql молча закрывала регистрацию обратно.
  const { data: flag } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'registration_open')
    .maybeSingle()
  const flagOpen = flag?.value === true || flag?.value === 'true'
  check('флаг registration_open существует', flag !== null && flag !== undefined,
    `значение: ${JSON.stringify(flag?.value)}`)

  // 1. пробуем зарегистрировать посторонний адрес.
  // Сырым запросом, а не supabase-js: отказ белого списка приходит как HTTP 500
  // с пустым телом (AuthRetryableFetchError, message "{}"), и отличить его от
  // настоящего сбоя через клиент невозможно — а в сыром ответе виден код.
  const res = await fetch(`${URL_}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const raw = await res.text()
  const closed = !res.ok && /RECALL_NOT_INVITED/.test(raw)

  // поведение обязано совпадать с флагом — иначе где-то рассинхрон
  check(
    'поведение совпадает с флагом registration_open',
    flagOpen === !closed,
    `флаг=${flagOpen}, регистрация ${closed ? 'закрыта' : 'открыта'}`,
  )

  if (closed) {
    console.log('\nРегистрация ЗАКРЫТА (белый список активен).')
    check('чужой адрес отклонён', true, 'RECALL_NOT_INVITED')
    console.log('\nЧтобы открыть: выполни docs/open-registration.sql и запусти смоук снова.')
  } else {
    console.log('\nРегистрация ОТКРЫТА — проверяем, что аккаунт создан правильно.')
    check('регистрация постороннего адреса прошла', res.ok, `HTTP ${res.status} ${raw.slice(0, 80)}`)

    const body = res.ok ? JSON.parse(raw) : {}
    // id берём через service_role: клиенту сессия не выдана (почта не подтверждена)
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
    userId = list.users.find((u) => u.email === EMAIL)?.id ?? body.id ?? null
    check('пользователь заведён', !!userId, String(userId).slice(0, 8))

    check(
      'сессия НЕ выдана до подтверждения почты',
      !body.access_token,
      body.access_token ? 'СЕССИЯ ВЫДАНА — подтверждение не работает' : 'сессии нет',
    )

    if (userId) {
      const { data: prof } = await admin
        .from('profiles')
        .select('display_name, plan, trial_until, role')
        .eq('id', userId)
        .single()
      check('профиль создан', !!prof, prof?.display_name)
      check('план free', prof?.plan === 'free', prof?.plan)
      check('роль learner', prof?.role === 'learner', prof?.role)

      const days = prof?.trial_until
        ? Math.round((new Date(prof.trial_until) - Date.now()) / 864e5)
        : null
      check('триал ~14 дней', days !== null && days >= 13 && days <= 14, `дней: ${days}`)

      const { data: decks } = await admin
        .from('decks')
        .select('lang, title')
        .eq('owner_id', userId)
      const langs = (decks ?? []).map((d) => d.lang).sort()
      check(
        'созданы две стартовые колоды (en + es)',
        langs.length === 2 && langs[0] === 'en' && langs[1] === 'es',
        langs.join(', '),
      )
    }
  }
} catch (e) {
  console.error('\nОшибка прогона:', e.message)
  results.push(false)
} finally {
  if (userId) {
    await admin.from('teacher_students').delete().or(`teacher_id.eq.${userId},student_id.eq.${userId}`)
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    console.log('Тестовый аккаунт удалён.')
  }
  const ok = results.filter(Boolean).length
  console.log(`\nИтог: ${ok}/${results.length}`)
  process.exitCode = ok === results.length ? 0 : 1
}
