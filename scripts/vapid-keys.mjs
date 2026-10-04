/**
 * Ключи push (VAPID) и секрет доставки — сгенерировать и показать, куда класть
 * (PLAN.md Ф2.9, «Дела владельца»).
 *
 * Пара ключей подписывает каждое уведомление: публичный знает браузер (им он
 * подписывается), приватный — только сервер. Поменять пару — значит потерять
 * все подписки: телефоны подписаны на старый публичный ключ. Поэтому ключи
 * генерируются ОДИН раз на базу и дальше не трогаются.
 *
 *   node scripts/vapid-keys.mjs           → три строки для Vercel и секрет для Vault живой базы
 *   node scripts/vapid-keys.mjs --test    → строки TEST_… для .env.local (dev:test и туннель)
 *
 * Скрипт ничего никуда не пишет — только печатает.
 */
import { randomBytes } from 'node:crypto'
import webpush from 'web-push'

const test = process.argv.includes('--test')
const keys = webpush.generateVAPIDKeys()
const secret = randomBytes(24).toString('hex')

if (test) {
  console.log('# .env.local — тестовая база (npm run dev:test, node scripts/push-tunnel.mjs)')
  console.log(`TEST_VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log(`TEST_VAPID_PRIVATE_KEY=${keys.privateKey}`)
  console.log(`TEST_NOTIFY_SECRET=${secret}`)
} else {
  console.log('1) Vercel → Settings → Environment Variables (все окружения):')
  console.log(`   VITE_VAPID_PUBLIC_KEY = ${keys.publicKey}`)
  console.log(`   VAPID_PRIVATE_KEY     = ${keys.privateKey}`)
  console.log(`   NOTIFY_SECRET         = ${secret}`)
  console.log('\n2) .env.local — только публичный (npm run dev подписывается им):')
  console.log(`   VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`)
  console.log('\n3) Supabase живой базы → SQL Editor → New query:')
  console.log(`   select vault.create_secret('https://recall-pgkz.vercel.app/api/notify', 'notify_url');`)
  console.log(`   select vault.create_secret('${secret}', 'notify_secret');`)
  console.log('\n⚠️ Ключи — один раз: новая пара отвяжет все уже включённые телефоны.')
}
