/**
 * Модель нагрузки на AI (scripts/_capacity-model.mjs, PLAN.md Ф2.12) — чистый
 * тест: модель в паре с кодом сервера и выводы docs/capacity-2026-11.md.
 *
 * Что доказывает:
 *   • у каждой задачи сервера (AI_TASKS) есть допущение по каждой роли и
 *     токены — новая задача без них не пройдёт (прогноз молча её не считал бы);
 *   • маршруты повторяют api/gemini.ts: у потокового Диалога нет Groq, у
 *     перевода слова Groq первый, у замены — своя ступень без Groq;
 *   • арифметика: обслужено + отказано = спрос, ни одна модель не берёт
 *     больше суточного лимита, ноль людей — ноль запросов;
 *   • выводы отчёта всё ещё верны на нынешнем коде: на бесплатном Gemini
 *     Диалог ломается раньше 20 пользователей, на платном до 400 ломается
 *     только речь, первая модель платного режима с 01.12.2026 переадресована
 *     в лёгкую. Поменялся код и вывод — тест краснеет: правь отчёт.
 * Без сети, базы и ключей. Запуск: node scripts/test-capacity.mjs
 */
import './_api-loader.mjs'
import { readFileSync } from 'node:fs'
import {
  GOOGLE_ROUTES, PER_ACTIVE, TOKENS, almatyClock, breakUsers, buildCapacity, dailyDemand, failShare,
  simulateDay, usersFor,
} from './_capacity-model.mjs'
import { setup } from './capacity-forecast.mjs'

let failed = 0
let total = 0
const check = (name, ok, extra = '') => {
  total++
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' — ' + extra : ''}`)
}

const free = await setup('free')
const paid = await setup('paid')
const tasks = Object.keys(free.code.tasks)

console.log('\n— допущения в паре с задачами сервера')
for (const role of Object.keys(PER_ACTIVE)) {
  const have = Object.keys(PER_ACTIVE[role])
  const missing = tasks.filter((t) => !have.includes(t))
  const extra = have.filter((t) => !tasks.includes(t) && t !== 'speech')
  check(`роль ${role}: строка на каждую задачу, лишних нет`, !missing.length && !extra.length, `нет: ${missing.join(', ')}; лишние: ${extra.join(', ')}`)
}
const noTokens = [...tasks, 'speech'].filter((t) => !TOKENS[t])
check('у каждой задачи и речи — токены', !noTokens.length, noTokens.join(', '))

console.log('\n— маршруты = api/gemini.ts')
const { routes } = free
const { groq, stt } = free.code
check('Диалог — только Gemini standard, без Groq', routes.dialog.every((m) => m.startsWith('gemini')), routes.dialog.join(' → '))
check('перевод слова — Groq fast первым', routes.word[0] === groq.fast)
check('обычные задачи — Groq last последним', ['quest', 'writing', 'review', 'material'].every((t) => routes[t].at(-1) === groq.last))
check('замена — своя ступень, без Groq', [...routes['exercise_swap:light'], ...routes['exercise_swap:strong']].every((m) => m.startsWith('gemini')))
check('речь — только Whisper', routes.speech.length === 1 && routes.speech[0] === stt)
// поток Диалога в обработчике: от ветки stream до ветки замены — ни одного groqChat
const src = readFileSync(new URL('../api/gemini.ts', import.meta.url), 'utf8')
const from = src.indexOf("stream === true && task === 'dialog'")
const to = src.indexOf('if (swapReq) {', from)
check('в api/gemini.ts у потока Диалога нет Groq (иначе поправь buildRoutes и отчёт)', from > 0 && to > from && !src.slice(from, to).includes('groqChat('))

console.log('\n— арифметика')
const demand200 = dailyDemand(usersFor(200), routes)
const day = simulateDay({ demand: demand200, ...free })
const leaks = Object.entries(day.perKey).filter(([, r]) => Math.abs(r.served + r.failed - r.demand) > 1e-6 * Math.max(1, r.demand))
check('обслужено + отказано = спрос по каждой задаче', !leaks.length, leaks.map(([k]) => k).join(', '))
const over = Object.entries(day.perModel).filter(([m, r]) => r.requests > free.capacity[m].rpd + 1e-6 || r.units > free.capacity[m].tpd + 1e-6)
check('ни одна модель не берёт больше суточного лимита', !over.length, over.map(([m]) => m).join(', '))
const zero = simulateDay({ demand: dailyDemand(usersFor(0), routes), ...free })
check('ноль пользователей — ноль запросов', Object.values(zero.perModel).every((r) => r.requests === 0))
const d400 = simulateDay({ demand: dailyDemand(usersFor(400), routes), ...free })
check('больше людей — отказов не меньше', failShare(d400.perKey, 'dialog') >= failShare(day.perKey, 'dialog'))
check('сутки Google начинаются в 13:00 по Алматы (зима)', almatyClock(0) === '13:00' && almatyClock(11 * 60) === '00:00')
check('у Pro бесплатно ноль', buildCapacity({ limits: free.code.limits })['gemini-3.1-pro-preview']?.rpd === 0)

console.log('\n— выводы docs/capacity-2026-11.md на нынешнем коде')
const dialogFree = breakUsers('dialog', free)
check('бесплатно: Диалог ломается раньше 20 пользователей', dialogFree !== null && dialogFree < 20, String(dialogFree))
check('бесплатно при 200: Диалог без ответа больше чем у половины', failShare(day.perKey, 'dialog') > 0.5)
const writingFree = breakUsers('writing', free)
check('бесплатно: письмо (через Groq) держится дольше Диалога, но ломается до 200', writingFree > dialogFree && writingFree < 200, String(writingFree))
const cache = new Map()
const paidBreaks = tasks.map((t) => [t, breakUsers(t, { ...paid, max: 400, cache })]).filter(([, n]) => n !== null)
check('платно: до 400 пользователей не ломается ни одна задача AI', !paidBreaks.length, paidBreaks.map(([t, n]) => `${t} ${n}`).join(', '))
const speech = breakUsers('speech', paid)
check('речь (Whisper 2000 в сутки) ломается между 500 и 1000', speech > 500 && speech < 1000, String(speech))
const firstPaid = paid.routes.dialog[0]
check(`платный режим: первая модель Диалога (${firstPaid}) с 01.12.2026 переадресуется в лёгкую`, GOOGLE_ROUTES.dec1[firstPaid]?.includes('lite'))

console.log(`\nИтог: ${total - failed}/${total}`)
process.exitCode = failed ? 1 : 0
