/**
 * Какой путь списания энергии живой (PLAN.md Ф1.6): перед удалением
 * consume_ai_quota доказать, что её не зовут.
 *
 * Как отличить. spend_energy ставит строке ai_calls номер списания
 * (refund_token): сервер генерирует его на каждый вызов. consume_ai_quota
 * номера не ставит никогда. ai_calls хранит 40 дней, значит «ни одной строки
 * без номера» = за всё хранимое время ни одного списания мимо spend_energy.
 * Второй свидетель — счётчик вызовов функций (pg_stat_user_functions), если
 * база его ведёт (track_functions).
 *
 * Только чтение: живая база — через токен Management API, который только
 * читает. Запуск: node scripts/check-ai-quota-path.mjs [--prod]
 */
import { dbTarget, runSql } from './_env.mjs'

const target = dbTarget()
console.log(`▸ база: ${target.label}`)

const [calls] = await runSql(
  target,
  `select count(*)::int as total,
          (count(*) filter (where refund_token is null))::int as without_token,
          min(called_at) as first_at,
          max(called_at) as last_at,
          max(called_at) filter (where refund_token is null) as last_without_token
     from public.ai_calls`,
)
const [track] = await runSql(target, `select current_setting('track_functions') as mode`)
const stats = await runSql(
  target,
  `select funcname, calls::int from pg_stat_user_functions
    where schemaname = 'public' and funcname in ('spend_energy', 'consume_ai_quota')`,
)

const day = (v) => (v ? String(v).slice(0, 10) : '—')
console.log(
  `ai_calls: ${calls.total} строк с ${day(calls.first_at)} по ${day(calls.last_at)}, ` +
    `без номера списания — ${calls.without_token}` +
    (calls.without_token ? ` (последняя ${day(calls.last_without_token)})` : ''),
)
console.log(
  `счётчик вызовов функций (track_functions = ${track.mode}): ` +
    (stats.length ? stats.map((s) => `${s.funcname} ${s.calls}`).join(', ') : 'не ведётся'),
)

let failed = 0
const check = (name, ok) => {
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}`)
}
check('в ai_calls есть что сверять', calls.total > 0)
check('все списания — через spend_energy (у каждой строки есть номер)', calls.without_token === 0)
const consume = stats.find((s) => s.funcname === 'consume_ai_quota')
if (consume) check('consume_ai_quota не звали ни разу', consume.calls === 0)

process.exit(failed ? 1 : 0)
