/**
 * Проверка настроек восстановления пароля в панели Supabase — БЕЗ отправки писем.
 *
 * Зачем. Половина этой фичи живёт не в коде, а в настройках проекта: белый
 * список адресов возврата, Site URL, шаблон письма. Настройки правит человек
 * руками, у них нет ни истории, ни ревью — и "починили одно, отвалилось другое"
 * здесь обычное дело. Код при этом остаётся зелёным: он про них ничего не знает.
 *
 * Что видно из ссылки admin.generateLink(): Supabase подставляет в неё адрес
 * возврата, а если тот не в белом списке — молча заменяет на Site URL. Значит
 * одним вызовом проверяются оба параметра сразу, и почта не тратится.
 *
 * Чего проверить НЕЛЬЗЯ: сам текст письма. Шаблон отдаёт только Management API
 * с личным токеном; смотреть письмо придётся глазами.
 *
 * Запуск: node scripts/check-auth-setup.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EMAIL = 'setup-check@recall.test'
const PROD = 'https://recall-pgkz.vercel.app/reset-password'

for (const u of (await admin.auth.admin.listUsers({ perPage: 200 })).data.users) {
  if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id)
}
const made = await admin.auth.admin.createUser({
  email: EMAIL,
  password: 'Setup!Check2026',
  email_confirm: true,
})

const linkFor = async (redirectTo) => {
  const r = await admin.auth.admin.generateLink({ type: 'recovery', email: EMAIL, options: { redirectTo } })
  const action = r.data?.properties?.action_link ?? ''
  const back = new URL(action).searchParams.get('redirect_to') ?? ''
  return { action, back, otp: r.data?.properties?.email_otp, err: r.error?.message }
}

// 1. Прод-адрес: если он в белом списке, Supabase его сохранит
const ok = await linkFor(PROD)
console.log('[прод-адрес возврата]')
console.log('  просили:', PROD)
console.log('  вернулось:', ok.back || '(пусто)')
console.log('  в белом списке:', ok.back === PROD ? 'ДА' : 'НЕТ — Supabase подменил')

// 2. Заведомо чужой адрес: подмена покажет нам Site URL
const evil = await linkFor('https://example.org/steal')
console.log('\n[чужой адрес возврата]')
console.log('  вернулось:', evil.back || '(пусто)')
console.log('  → Site URL проекта:', evil.back || '(не определить)')
console.log('  чужой адрес отклонён:', evil.back !== 'https://example.org/steal' ? 'ДА' : 'НЕТ — ОПАСНО')

// 3. Локальный адрес — нужен только для разработки
const local = await linkFor('http://localhost:5173/reset-password')
console.log('\n[локальный адрес]')
console.log('  вернулось:', local.back || '(пусто)')
console.log('  в белом списке:', local.back === 'http://localhost:5173/reset-password' ? 'ДА' : 'НЕТ (это нормально)')

console.log('\n[код из письма]')
console.log('  длина:', String(ok.otp ?? '').length, 'цифр — экран принимает 6–10')

if (made.data?.user?.id) await admin.auth.admin.deleteUser(made.data.user.id)
console.log('\nПробный аккаунт удалён. Писем не отправлено.')
