/**
 * Правила «Моих уроков» и просьбы включить уведомления (PLAN.md Ф2.9; макеты
 * u1, u2, u3; журнал п.32, 33, 38, 42, 68):
 *
 *   • ближайший урок: отменённые и закончившиеся не в счёт, идущий — в счёт;
 *     за 10 минут — «Урок через 10 мин», во время — «Урок идёт» (u1-2);
 *   • «Сегодня / Завтра / чт, 15 окт» — по Алматы; с кем — группа или имя
 *     преподавателя; пометки «Отменён», «Перенесён с …»; «Войти в урок» — у
 *     ближайшего и только в его день;
 *   • тихая строка остатка (п.33): «Оплачено ещё 3 урока», ноль и минус —
 *     «Оплаченные уроки закончились», учёт не ведётся — строки нет;
 *   • кому учителю писать самому (п.68): без приложения и с выключенными
 *     уведомлениями — да, ученику с уведомлениями — нет;
 *   • когда просить включить: только с уроками; iPhone во вкладке —
 *     инструкция; «Не сейчас» — через 14 дней и не больше двух раз.
 * Чистый: без сети и базы.
 * Запуск: node scripts/test-my-lessons.mjs
 */
import {
  balanceLines,
  canJoin,
  cardPhase,
  cardTitle,
  dateTile,
  joinLessonId,
  lessonNote,
  nextLesson,
  splitMyLessons,
  whenLabel,
  whoLabel,
} from '../src/domains/schedule/student.ts'
import { APP_TELLS_STUDENTS, whoToTell } from '../src/domains/schedule/editor.ts'
import { ASK_AGAIN_DAYS, postpone, pushAsk } from '../src/domains/notifications/ask.ts'

let fail = 0
let total = 0
const check = (name, actual, expected) => {
  total++
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ждали ${JSON.stringify(expected)}, получили ${JSON.stringify(actual)}`}`)
}

// Алматы = UTC+5. «Сейчас» — чт, 15 окт 2026, 18:50 по Алматы (u1-2)
const NOW = new Date('2026-10-15T13:50:00Z')
const lesson = (id, startUtc, minutes = 60, extra = {}) => ({
  id, teacherId: 't', teacherName: 'Мадина Сейткали', kind: 'individual', status: 'planned',
  startsAt: startUtc, endsAt: new Date(Date.parse(startUtc) + minutes * 60_000).toISOString(),
  title: null, link: 'https://meet.google.com/kzr-mdsn-tqp', movedFrom: null, version: 1, ...extra,
})
const today = lesson('today', '2026-10-15T14:00:00Z') // 19:00 сегодня
const club = lesson('club', '2026-10-17T06:00:00Z', 60, { kind: 'group', title: 'Разговорный клуб' }) // сб 11:00
const cancelled = lesson('cancel', '2026-10-20T14:00:00Z', 60, { status: 'cancelled' }) // вт 19:00
const moved = lesson('moved', '2026-10-23T13:00:00Z', 60, { movedFrom: '2026-10-22T14:00:00Z' }) // пт 18:00, было чт 19:00
const past = lesson('past', '2026-10-13T14:00:00Z', 60, { status: 'done' })
const all = [moved, past, club, cancelled, today]

// ── ближайший и карточка Главной ──────────────────────────────────────────────────
check('ближайший — сегодняшний, прошедший и отменённый не в счёт', nextLesson(all, NOW)?.id, 'today')
check('отменённый ближайшим не бывает', nextLesson([cancelled, club], NOW)?.id, 'club')
check('идущий урок — ещё ближайший', nextLesson([today], new Date('2026-10-15T14:30:00Z'))?.id, 'today')
check('закончился — уже нет', nextLesson([today], new Date('2026-10-15T15:00:00Z')), null)
check('за 10 минут — «soon» и «Урок через 10 мин» (u1-2)', [cardPhase(today, NOW), cardTitle(today, NOW)], ['soon', 'Урок через 10 мин'])
check('за 11 минут — ещё обычная карточка', [cardPhase(today, new Date('2026-10-15T13:49:00Z')), cardTitle(today, new Date('2026-10-15T13:49:00Z'))], ['later', 'Ближайший урок'])
check('во время урока — «Урок идёт»', cardTitle(today, new Date('2026-10-15T14:20:00Z')), 'Урок идёт')
check('«Сегодня, 19:00–20:00» по Алматы', whenLabel(today, NOW), 'Сегодня, 19:00–20:00')
check('ночь: 23:30 по Алматы — это ещё «сегодня», а 00:30 — «завтра»', [
  whenLabel(lesson('a', '2026-10-15T18:30:00Z'), NOW), whenLabel(lesson('b', '2026-10-15T19:30:00Z'), NOW),
], ['Сегодня, 23:30–00:30', 'Завтра, 00:30–01:30'])
check('дальше — день недели и дата', whenLabel(club, NOW), 'сб, 17 окт, 11:00–12:00')
check('с кем: группа — название, индивидуальный — имя преподавателя', [whoLabel(club), whoLabel(today)], ['Разговорный клуб', 'Мадина Сейткали'])

// ── список ───────────────────────────────────────────────────────────────────────
const split = splitMyLessons(all, NOW)
check('ближайшие — по времени, с отменённым; прошедшие — свежие сверху', [split.upcoming.map((l) => l.id), split.past.map((l) => l.id)], [['today', 'club', 'cancel', 'moved'], ['past']])
check('плитка даты — «чт» и «15»', dateTile(today), { weekday: 'чт', day: 15 })
check('пометки: «Отменён», «Перенесён с чт, 22 окт, 19:00», у обычного — ничего', [lessonNote(cancelled), lessonNote(moved), lessonNote(today)], [
  { kind: 'cancelled', text: 'Отменён' }, { kind: 'moved', text: 'Перенесён с чт, 22 окт, 19:00' }, null,
])
check('«Войти в урок» — у ближайшего в его день', joinLessonId(all, NOW), 'today')
check('ближайший завтра — в списке ссылки ещё нет', joinLessonId([club], NOW), null)
check('без ссылки — нет', joinLessonId([{ ...today, link: null }], NOW), null)
check('ссылку отменённого и закончившегося не даём', [canJoin(cancelled, NOW), canJoin(past, NOW)], [false, false])

// ── тихая строка остатка (п.33) ──────────────────────────────────────────────────────
const bal = (teacherName, tracked, lessonsLeft) => ({ teacherId: teacherName, teacherName, tracked, lessonsLeft })
check('«Оплачено ещё 3 урока»', balanceLines([bal('Мадина', true, 3)]), ['Оплачено ещё 3 урока'])
check('ноль — «закончились», без чисел', balanceLines([bal('Мадина', true, 0)]), ['Оплаченные уроки закончились'])
check('учёт не ведётся — строки нет', balanceLines([bal('Мадина', false, 0)]), [])
check('один урок — «1 урок»', balanceLines([bal('Мадина', true, 1)]), ['Оплачено ещё 1 урок'])
check('два преподавателя с учётом — с именами', balanceLines([bal('Мадина', true, 2), bal('Арман', true, 0), bal('Без учёта', false, 0)]), [
  'Мадина: оплачено ещё 2 урока', 'Арман: оплаченные уроки закончились',
])
check('нигде нет минуса', balanceLines([bal('М', true, -3)]).some((l) => /−|-\d/.test(l)), false)

// ── кому писать самому (п.68) ─────────────────────────────────────────────────────────
const people = [{ cardId: 'push' }, { cardId: 'nopush' }, { cardId: 'noapp' }]
const reached = (id) => id === 'push'
check('Recall сам пишет ученикам в приложении (Ф2.9)', APP_TELLS_STUDENTS, true)
check('писать самому — без приложения и с выключенными уведомлениями', whoToTell(people, reached).map((p) => p.cardId), ['nopush', 'noapp'])

// ── когда просить включить уведомления ─────────────────────────────────────────────────
const T = Date.parse('2026-10-15T12:00:00Z')
const ask = (over) => pushAsk({ support: 'default', subscribed: false, hasLessons: true, asked: null, now: T, ...over })
check('есть уроки, ещё не спрашивали — просьба', ask({}), 'prompt')
check('уроков нет — не просим', ask({ hasLessons: false }), null)
check('iPhone во вкладке — инструкция «На экран Домой»', ask({ support: 'install' }), 'install')
check('уже включено — не просим', ask({ support: 'granted', subscribed: true }), null)
check('разрешено, но выключили в Настройках — спрашиваем, а не подписываем молча', ask({ support: 'granted', subscribed: false }), 'prompt')
check('запретили или не умеет — не просим', [ask({ support: 'denied' }), ask({ support: 'unsupported' })], [null, null])
const once = postpone(null, T)
check(`«Не сейчас» — молчим ${ASK_AGAIN_DAYS} дней`, [ask({ asked: once, now: T + 13 * 86_400_000 }), ask({ asked: once, now: T + 15 * 86_400_000 })], [null, 'prompt'])
check('после второго «Не сейчас» — больше сами не спрашиваем', ask({ asked: postpone(once, T), now: T + 400 * 86_400_000 }), null)

console.log(`\nИтог: ${total - fail}/${total}`)
process.exitCode = fail ? 1 : 0
