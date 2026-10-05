/**
 * Живой телефон на ТЕСТОВОЙ базе — push по-настоящему (PLAN.md Ф2.9; журнал п.68).
 *
 * Телефон не достучится до localhost, а push работает только по https и только
 * с service worker'ом, которого у dev-сервера нет. Поэтому скрипт:
 *   1. собирает приложение на тестовой базе с тестовыми ключами push
 *      (TEST_VAPID_* в .env.local — node scripts/vapid-keys.mjs --test);
 *   2. поднимает его (vite preview, :4174) — /api/notify отвечает тот же
 *      обработчик, что на проде (vite.config.ts, vercelRoute);
 *   3. открывает туннель cloudflared → https://….trycloudflare.com;
 *   4. пишет в Vault тестовой базы адрес доставки (туннель/api/notify) и секрет
 *      TEST_NOTIFY_SECRET — будильник базы будит наш сервер, тот шлёт push;
 *   5. пока работает — гоняет будильник уведомлений раз в 30 с, а не раз в 5
 *      минут: проверять «урок через час» и перенос, не ожидая.
 * Ctrl+C — секреты доставки возвращаются как были, туннель и сервер гаснут.
 * Закрыл окно, не нажав Ctrl+C, — в Vault остался адрес мёртвого туннеля
 * (доставка тестовой базы будет падать и повторяться): `--off` его убирает.
 *
 * Запуск: node scripts/push-tunnel.mjs     (только тестовая база)
 *         node scripts/push-tunnel.mjs --off   (убрать адрес доставки и выйти)
 * cloudflared: D:\tools\cloudflared\cloudflared.exe или в PATH (CLOUDFLARED=путь).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, preview } from 'vite'
import { dbTarget, ROOT, runSql, scriptEnv } from './_env.mjs'
import { deliverySecrets } from './_vault.mjs'

if (process.argv.includes('--prod')) {
  console.error('Туннель — только к тестовой базе: живая доставка идёт через прод.')
  process.exit(1)
}

const env = scriptEnv()
const sql = (q) => runSql(dbTarget([]), q)
if (process.argv.includes('--off')) {
  await (await deliverySecrets(sql)).clear()
  console.log('Адрес и секрет доставки тестовой базы убраны — доставка спит, лента работает.')
  process.exit(0)
}
const missing = ['TEST_VAPID_PUBLIC_KEY', 'TEST_VAPID_PRIVATE_KEY', 'TEST_NOTIFY_SECRET'].filter((k) => !env[k])
if (missing.length) {
  console.error(`В .env.local нет ${missing.join(', ')} — node scripts/vapid-keys.mjs --test и вставь строки.`)
  process.exit(1)
}
const CLOUDFLARED = [process.env.CLOUDFLARED, 'D:/tools/cloudflared/cloudflared.exe'].find((p) => p && existsSync(p)) ?? 'cloudflared'
const PORT = 4174
const root = new URL('.', ROOT).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(tmpdir(), 'recall-push-tunnel')

// и сборка, и сервер видят тестовую базу и тестовые ключи (Vite не
// перезаписывает переменные, уже заданные в окружении)
Object.assign(process.env, {
  VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_VAPID_PUBLIC_KEY: env.TEST_VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: env.TEST_VAPID_PRIVATE_KEY,
  NOTIFY_SECRET: env.TEST_NOTIFY_SECRET,
})

console.log('1/4 сборка на тестовой базе…')
await build({ root, logLevel: 'error', build: { outDir: OUT, emptyOutDir: true } })
console.log(`2/4 приложение на http://localhost:${PORT}`)
const server = await preview({ root, logLevel: 'error', build: { outDir: OUT }, preview: { port: PORT, strictPort: true, allowedHosts: ['.trycloudflare.com'] } })

console.log('3/4 туннель…')
const tunnel = spawn(CLOUDFLARED, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] })
const url = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('cloudflared не дал адрес за 60 с')), 60_000)
  const scan = (buf) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf))
    if (m) {
      clearTimeout(timer)
      resolve(m[0])
    }
  }
  tunnel.stdout.on('data', scan)
  tunnel.stderr.on('data', scan)
  tunnel.on('error', (e) => reject(new Error(`cloudflared не запустился (${CLOUDFLARED}): ${e.message}`)))
})

const vault = await deliverySecrets(sql)
await vault.set(`${url}/api/notify`, env.TEST_NOTIFY_SECRET)
console.log('4/4 доставка тестовой базы → туннель')

// seed-учителю (scripts/seed-test.mjs) — тариф на 30 дней и ссылка на урок:
// без тарифа «урок через час» молчит намеренно (журнал п.68)
const [teacher] = await sql(`select id from auth.users where email = 'teacher@recall.test'`)
if (teacher) {
  await sql(`update public.profiles set plan = 'teacher_mini', plan_expires_at = greatest(coalesce(plan_expires_at, now()), now() + interval '30 days') where id = '${teacher.id}';
             insert into public.schedule_settings (teacher_id, default_link) values ('${teacher.id}', 'https://meet.google.com/abc-defg-hij')
             on conflict (teacher_id) do nothing`)
}

let ticking = false
const timer = setInterval(async () => {
  if (ticking) return
  ticking = true
  try {
    const [{ r }] = await sql('select public.run_notification_rules() as r')
    const sent = r?._sent ?? 0
    if (sent) console.log(`  ${new Date().toLocaleTimeString('ru-RU')} — отдано на доставку: ${sent}`)
  } catch (e) {
    console.log(`  будильник: ${e.message}`)
  } finally {
    ticking = false
  }
}, 30_000)

console.log(`
Открой на телефоне:  ${url}
(Android — Chrome; iPhone — Safari → «Поделиться» → «На экран Домой», потом открыть со значка)
Учитель (на компьютере, http://localhost:${PORT}): teacher@recall.test
Ученик  (на телефоне):                          student1@recall.test
Пароль у обоих — TEST_SEED_PASSWORD в .env.local${teacher ? '' : '\n⚠ seed-аккаунтов нет — сначала node scripts/seed-test.mjs'}
Будильник уведомлений — раз в 30 с, пока этот скрипт работает. Остановить — Ctrl+C.
`)

let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  clearInterval(timer)
  console.log('\nостанавливаю: секреты доставки — как были, туннель и сервер — гасим…')
  await vault.restore().catch((e) => console.log(`  ⚠ секреты: ${e.message}`))
  tunnel.kill()
  await new Promise((r) => server.httpServer.close(() => r()))
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
tunnel.on('exit', (code) => {
  if (!stopping) {
    console.log(`cloudflared завершился (код ${code})`)
    void stop()
  }
})
