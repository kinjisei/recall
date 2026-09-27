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
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { scriptEnv } from './_env.mjs'

if (process.argv.includes('--prod')) {
  console.error('Для живой базы — обычный `npm run dev` (порт 5173).')
  process.exit(1)
}
const env = scriptEnv()
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const child = spawn(process.execPath, [vite, '--port', '5174', '--strictPort'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
  },
})
child.on('exit', (code) => process.exit(code ?? 0))
