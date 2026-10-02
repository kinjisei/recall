/**
 * Ключи Supabase на проде (PLAN.md Ф1.9) — ТОЛЬКО чтение.
 *
 *   1. Бандл живого сайта: внутри новый ключ sb_publishable_, его принимает
 *      живой проект; старого JWT и секретного ключа нет.
 *   2. Старые ключи anon/service_role выключены в обоих проектах (Management
 *      API, без раскрытия ключей).
 *   3. С --since=ГГГГ-ММ-ДДTЧЧ:ММ (выкатка нового бандла, UTC; можно и только
 *      дату): сколько учеников
 *      заходили за 60 дней до выкатки и ни разу — после. У них в телефоне
 *      может жить старая сборка, и после выключения старых ключей при первом
 *      запуске их выкинет из аккаунта (проверено на тестовой базе: истёкший
 *      токен не обновится — supabase-js сотрёт вход). Только числа, без
 *      имён и почт.
 *
 * Зелёная — когда переход закончен: бандл новый, старые ключи выключены.
 * Запуск: node scripts/check-keys.mjs --prod [--since=2026-10-02T13:21]
 */
import { PROD_SITE, dbTarget, runSql } from './_env.mjs'

if (!process.argv.includes('--prod')) {
  console.error('Проверка про живой проект (только чтение) — запускай с --prod.')
  process.exit(1)
}
const prod = dbTarget(['--prod'])
const test = dbTarget([])
let failed = 0
const check = (name, pass, extra = '') => {
  console.log(`${pass ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
  if (!pass) failed++
}

// --- 1. бандл живого сайта ---------------------------------------------------------
const html = await (await fetch(PROD_SITE)).text()
const scripts = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
const bundle = (await Promise.all(scripts.map((s) => fetch(PROD_SITE + s).then((r) => r.text())))).join('\n')
const pubs = [...new Set(bundle.match(/sb_publishable_[\w-]+/g) ?? [])]
check('в бандле ровно один ключ sb_publishable_', pubs.length === 1, `${scripts.length} файлов, ключей: ${pubs.length}`)
if (pubs.length === 1) {
  const st = (await fetch(`${prod.url}/auth/v1/settings`, { headers: { apikey: pubs[0] } })).status
  check('живой проект принимает ключ из бандла', st === 200, `HTTP ${st}`)
}
check('старого JWT-ключа в бандле нет', !/eyJhbGciOi/.test(bundle))
check('секретного ключа в бандле нет', !/sb_secret_\w/.test(bundle))

// --- 2. старые ключи в панели --------------------------------------------------------
for (const t of [test, prod]) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${t.ref}/api-keys/legacy`, {
    headers: { Authorization: `Bearer ${t.accessToken}` },
  })
  const on = r.ok ? (await r.json()).enabled : undefined
  check(`${t.label}: старые ключи выключены`, on === false, r.ok ? (on ? 'ещё включены' : '') : `HTTP ${r.status}`)
}

// --- 3. кто может быть на старой сборке ------------------------------------------------
const since = process.argv.find((a) => a.startsWith('--since='))?.slice(8)
if (since) {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(since)) throw new Error('--since=ГГГГ-ММ-ДД[TЧЧ:ММ], UTC')
  const at = `timestamptz '${since.replace('T', ' ')}+00'`
  const [row] = await runSql(
    prod,
    `with seen as (
       select user_id, max(created_at) as last_at from events
        where name = 'page_view' and user_id is not null
          and created_at > ${at} - interval '60 days'
        group by user_id)
     select count(*) filter (where last_at >= ${at}) as updated,
            count(*) filter (where last_at < ${at}) as stale,
            count(*) filter (where last_at < ${at} and last_at >= ${at} - interval '7 days') as stale_7d
       from seen`,
  )
  console.log(
    `\nЗа 60 дней до ${since} заходили ${Number(row.updated) + Number(row.stale)} учеников:` +
      `\n  открыли приложение после выкатки (новая сборка) — ${row.updated}` +
      `\n  НЕ открывали после выкатки — ${row.stale} (из них были активны за последнюю неделю до неё — ${row.stale_7d})` +
      `\n  → при выключении старых ключей эти ${row.stale} при первом запуске заново введут пароль.`,
  )
} else {
  console.log('\n(счёт учеников на старой сборке — с --since=ВЫКАТКА, UTC)')
}

console.log(failed ? `\n✗ ${failed} — переход не закончен` : '\n✓ прод на новых ключах, старые выключены')
process.exit(failed ? 1 : 0)
