import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('d:/projects/recall-app/.env.local', 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})
const E = 'dialog-check@recall.test'
const P = 'Dialog!2026'

await admin.from('allowed_emails').upsert({ email: E, note: 'dialog-check (временный)' })
const { data: cu } = await admin.auth.admin.createUser({ email: E, password: P, email_confirm: true })
let id = cu?.user?.id
if (!id) {
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 })
  id = l.users.find((u) => u.email === E)?.id
}
const c = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})
const { data: s } = await c.auth.signInWithPassword({ email: E, password: P })

const system = [
  'Ты — дружелюбный собеседник и терпеливый преподаватель английского в приложении Recall.',
  'Ученик — русскоговорящий, уровень B1.',
  'Структура ответа: 1) разбор ошибок последнего сообщения в формате',
  '[fix] фрагмент → исправление — объяснение по-русски; если ошибок нет — [ok] Без ошибок!',
  '2) продолжение разговора: 2-4 предложения на английском уровня B1, в конце вопрос.',
  'Только простой текст, без markdown, без эмодзи.',
  'Служебные строки начинаются с [fix], [ok], [topic].',
].join('\n')

const r = await fetch('https://recall-pgkz.vercel.app/api/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session.access_token}` },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }], system, task: 'dialog' }),
})
const j = await r.json()
const t = j.text ?? ''

console.log('=== ОТВЕТ AI ===')
console.log(t || j.error)
console.log('\n=== ПРОВЕРКИ ===')
const leaks = ['СИСТЕМНАЯ ИНСТРУКЦИЯ', 'КОНЕЦ ИНСТРУКЦИИ', 'Структура ответа', 'Plain text?', 'Draft:', 'Reply Structure']
const found = leaks.filter((x) => t.includes(x))
console.log(found.length === 0 ? '✓ инструкция не просочилась' : '✗ просочилось: ' + found.join(', '))
const svc = (t.match(/\[ok\]/g) || []).length + (t.match(/\[fix\]/g) || []).length
console.log(svc <= 1 ? '✓ ответ не продублирован' : `✗ служебных строк ${svc} — дубль`)

await admin.auth.admin.deleteUser(id)
await admin.from('allowed_emails').delete().eq('email', E)
