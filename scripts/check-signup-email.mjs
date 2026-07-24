/**
 * Живая проверка отправки письма подтверждения (после настройки SMTP).
 * Регистрирует аккаунт как обычный пользователь (anon-ключ, не service_role) —
 * значит, срабатывает весь настоящий путь: триггер, Confirm email, отправка
 * письма через SMTP. Аккаунт сразу удаляется.
 *
 * Запуск: node scripts/check-signup-email.mjs [email]
 * По умолчанию шлёт на k.yerbolat.2004+test@gmail.com — письмо придёт владельцу.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const TO = process.argv[2] || 'k.yerbolat.2004+test@gmail.com'
const PASS = 'MailCheck!2026'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// пока регистрация закрыта белым списком — впускаем этот адрес
await admin.from('allowed_emails').upsert({ email: TO, note: 'проверка почты (временный)' })

console.log(`Регистрирую ${TO}…`)
const { data, error } = await anon.auth.signUp({ email: TO, password: PASS })

if (error) {
  console.log(`✗ Регистрация не прошла: ${error.message}`)
  if (/sending|smtp|mail/i.test(error.message)) {
    console.log('  Это ошибка ОТПРАВКИ письма — проверь SMTP в Supabase → Authentication → Emails.')
  }
} else if (data.session) {
  console.log('✗ Вернулась готовая сессия — значит, подтверждение почты выключено.')
} else {
  console.log('✓ Аккаунт создан без сессии — Supabase принял письмо к отправке.')
  console.log(`  Проверь ящик ${TO} (и папку «Спам»). Письмо от Recall.`)
  console.log('  Если письма нет в течение пары минут — SMTP принял, но доставки нет.')
}

// уборка: аккаунт и запись в белом списке
const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
const u = list.users.find((x) => x.email === TO)
if (u) {
  await admin.auth.admin.deleteUser(u.id)
  console.log('  (тестовый аккаунт удалён)')
}
await admin.from('allowed_emails').delete().eq('email', TO)
