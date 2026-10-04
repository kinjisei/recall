/**
 * Dev-сервер на ТЕСТОВОЙ базе — для смоуков (PLAN.md Ф1.2). `npm run dev:test`
 *
 * Порт 5174 и строго он: смоуки на тестовой ходят сюда (APP_URL в _env.mjs), а
 * обычный `npm run dev` на 5173 смотрит в ЖИВУЮ базу. Разные порты — чтобы
 * смоук не попал в прод-сервер и не завёл аккаунт на живой базе через
 * интерфейс. strictPort: занятый порт — ошибка, а не тихий переезд на соседний.
 *
 * Адрес базы и публичный ключ подменяются только этому процессу: Vite не
 * перезаписывает переменные, которые уже есть в окружении, поэтому
 * .env.local не трогается. Ключи ИИ (GEMINI_API_KEY…) — те же, из .env.local.
 *
 * ⚠️ Vite запускается В ЭТОМ ЖЕ процессе (API createServer), а не дочерним:
 * на Windows остановка обёртки оставляла дочерний Vite сиротой на порту, и
 * следующий запуск упирался в занятый 5174.
 */
import { createServer } from 'vite'
import { ROOT, scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Для живой базы — обычный `npm run dev` (порт 5173).')
  process.exit(1)
}
const env = scriptEnv()
process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY
// push (Ф2.9): у тестовой базы свои ключи и секрет доставки — подписка,
// сделанная здесь, не смешивается с живой (node scripts/vapid-keys.mjs --test)
for (const [to, from] of [
  ['VITE_VAPID_PUBLIC_KEY', 'TEST_VAPID_PUBLIC_KEY'],
  ['VAPID_PRIVATE_KEY', 'TEST_VAPID_PRIVATE_KEY'],
  ['NOTIFY_SECRET', 'TEST_NOTIFY_SECRET'],
]) {
  if (env[from]) process.env[to] = env[from]
  else delete process.env[to]
}

const server = await createServer({
  root: new URL('.', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  // туннель к телефону (scripts/push-tunnel.mjs) приходит с чужим именем хоста
  server: { port: 5174, strictPort: true, allowedHosts: ['.trycloudflare.com'] },
})
await server.listen()
server.printUrls()
