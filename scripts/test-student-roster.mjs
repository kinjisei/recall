/**
 * Список «Учеников» по урокам (PLAN.md Ф2.17-4б-1; макеты d3-1, d3-5, t6-1):
 *   • ближайший урок карточки: запланированный, не закончился, самый ранний;
 *     отменённый, прошедший и чужой — не в счёт; идущий — ещё ближайший;
 *   • вторая строка: «сегодня 17:00 · IELTS вечер», «завтра», день недели в
 *     пределах недели, дальше дата; день — по Алматы, а не по поясу машины;
 *     уроков нет — «уроков нет»;
 *   • группы студии: только групповые серии, которые ещё идут, по
 *     ближайшему уроку; «сегодня 17:00 · 3 ученика»; адрес урока в расписании;
 *   • порядок строк: закреплённые (пробный «остаётся?») всегда сверху,
 *     «пустые» (нет урока, нет учёта) — в конце в обе стороны, равные — по
 *     имени, обратный порядок переворачивает только ключ.
 * Чистый: без сети и базы. Запуск: node scripts/test-student-roster.mjs
 */
import { groupLessonPath, groupLine, lastLessonOf, lessonLine, nextLessonOf, studioGroups, whenShort } from '../src/domains/schedule/roster.ts'
import { sortRoster } from '../src/domains/students/model.ts'

let fail = 0
let total = 0
const check = (name, actual, expected) => {
  total++
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` — ждали ${JSON.stringify(expected)}, получили ${JSON.stringify(actual)}`}`)
}

// Алматы = UTC+5. «Сейчас» — чт, 15 окт 2026, 16:10 по Алматы (t6-1)
const NOW = new Date('2026-10-15T11:10:00Z')
const lesson = (id, startUtc, cards, extra = {}) => ({
  id, seriesId: null, seriesDate: null, kind: 'individual', status: 'planned',
  startsAt: startUtc, endsAt: new Date(Date.parse(startUtc) + 60 * 60_000).toISOString(),
  title: null, link: null, movedFrom: null, version: 1, settled: false,
  participants: cards.map((cardId) => ({ cardId })), ...extra,
})
const ielts = lesson('ielts', '2026-10-15T12:00:00Z', ['asel', 'meir', 'kamila'], { kind: 'group', title: 'IELTS вечер', seriesId: 's-ielts' }) // сегодня 17:00
const aigerim = lesson('aig', '2026-10-15T14:00:00Z', ['aigerim']) // сегодня 19:00
const aigerimLater = lesson('aig2', '2026-10-17T14:00:00Z', ['aigerim'])
const alina = lesson('alina', '2026-10-19T11:00:00Z', ['alina']) // пн 16:00
const timur = lesson('timur', '2026-10-20T05:00:00Z', ['timur']) // вт 10:00
const far = lesson('far', '2026-10-23T11:00:00Z', ['far']) // пт 23 окт — через 8 дней
const cancelled = lesson('canc', '2026-10-15T13:00:00Z', ['aigerim'], { status: 'cancelled' })
const past = lesson('past', '2026-10-14T14:00:00Z', ['aigerim'], { status: 'done' })
const club = lesson('club', '2026-10-17T06:00:00Z', ['a', 'b', 'c', 'd'], { kind: 'group', title: 'Разговорный клуб', seriesId: 's-club' }) // сб 11:00
const all = [aigerimLater, ielts, past, cancelled, aigerim, alina, timur, far, club]

// ── ближайший урок ──────────────────────────────────────────────────────────────
check('ближайший — сегодняшний 19:00: прошедший и отменённый не в счёт', nextLessonOf(all, 'aigerim', NOW)?.id, 'aig')
check('урок группы — ближайший и для её участника', nextLessonOf(all, 'meir', NOW)?.id, 'ielts')
check('идущий урок — ещё ближайший', nextLessonOf([aigerim], 'aigerim', new Date('2026-10-15T14:30:00Z'))?.id, 'aig')
check('закончился — уже нет', nextLessonOf([aigerim], 'aigerim', new Date('2026-10-15T15:00:00Z')), null)
check('чужой урок — не мой', nextLessonOf(all, 'nobody', NOW), null)

// ── последнее занятие (d10-2) ──────────────────────────────────────────────────
const older = lesson('older', '2026-10-13T14:00:00Z', ['aigerim'], { status: 'done' })
const missed = lesson('missed', '2026-10-15T09:00:00Z', [], { status: 'done', participants: [{ cardId: 'aigerim', attended: false }] })
check('последнее — вчерашнее: сегодняшнее ещё впереди, отменённое и раннее не в счёт', lastLessonOf([...all, older], 'aigerim', NOW)?.id, 'past')
check('«не был» — не занятие', lastLessonOf([past, missed], 'aigerim', NOW)?.id, 'past')
check('закончившийся сегодня — уже последнее', lastLessonOf(all, 'aigerim', new Date('2026-10-15T15:00:00Z'))?.id, 'aig')
check('прошедших нет — null', lastLessonOf(all, 'alina', NOW), null)

// ── вторая строка ───────────────────────────────────────────────────────────────
check('сегодня — «сегодня 17:00 · IELTS вечер» у группы, «сегодня 19:00» у индивидуального', [lessonLine(ielts, NOW), lessonLine(aigerim, NOW)], ['сегодня 17:00 · IELTS вечер', 'сегодня 19:00'])
check('в пределах недели — день недели (t6-1: «пн 16:00», «вт 10:00»)', [whenShort(alina, NOW), whenShort(timur, NOW)], ['пн 16:00', 'вт 10:00'])
check('завтра — «завтра»', whenShort(lesson('t', '2026-10-16T04:30:00Z', []), NOW), 'завтра 09:30')
check('через неделю и дальше — дата', whenShort(far, NOW), '23 окт 16:00')
check('день — по Алматы: 00:30 по Алматы — уже «завтра», хотя по UTC ещё сегодня', whenShort(lesson('n', '2026-10-15T19:30:00Z', []), NOW), 'завтра 00:30')
check('уроков нет — так и пишем', lessonLine(null, NOW), 'уроков нет')

// ── группы ──────────────────────────────────────────────────────────────────────
const series = [
  { id: 's-club', kind: 'group', title: 'Разговорный клуб', cardIds: ['a', 'b', 'c', 'd'], endsOn: null },
  { id: 's-ielts', kind: 'group', title: 'IELTS вечер', cardIds: ['asel', 'meir', 'kamila'], endsOn: '2026-12-31' },
  { id: 's-ind', kind: 'individual', title: null, cardIds: ['aigerim'], endsOn: null },
  { id: 's-old', kind: 'group', title: 'Летний клуб', cardIds: ['x'], endsOn: '2026-08-31' },
]
const groups = studioGroups(series, all, NOW)
check('группы — только групповые и только идущие, по ближайшему уроку', groups.map((g) => g.title), ['IELTS вечер', 'Разговорный клуб'])
check('строка группы — «сегодня 17:00 · 3 ученика», «сб 11:00 · 4 ученика»', groups.map((g) => groupLine(g, NOW)), ['сегодня 17:00 · 3 ученика', 'сб 11:00 · 4 ученика'])
check('нажал группу — её урок в расписании', groupLessonPath(groups[0]), '/schedule?view=day&day=2026-10-15&lesson=ielts')

// ── порядок строк ───────────────────────────────────────────────────────────────
const rows = [
  { name: 'Тимур Ким', next: 3, left: 1 },
  { name: 'Нұрсұлтан Ахметов', next: null, left: null, trial: true },
  { name: 'Данияр Беков', next: null, left: null },
  { name: 'Айгерим Нурланова', next: 2, left: 3 },
  { name: 'Әсел Жұмабаева', next: 1, left: 6 },
  { name: 'Алина Ли', next: 4, left: -2 },
  { name: 'Камила Оспан', next: 1, left: 8 },
]
const order = (by, desc) =>
  sortRoster(rows, { key: (r) => r[by], desc, pinned: (r) => !!r.trial, name: (r) => r.name }).map((r) => r.name.split(' ')[0])
check('«Ближайший урок» ↑ (d3-1): пробный сверху, равные по имени, без уроков — в конце', order('next', false), ['Нұрсұлтан', 'Әсел', 'Камила', 'Айгерим', 'Тимур', 'Алина', 'Данияр'])
check('«Осталось уроков» ↑ (t6-1): минус первым — кому пора платить', order('left', false), ['Нұрсұлтан', 'Алина', 'Тимур', 'Айгерим', 'Әсел', 'Камила', 'Данияр'])
check('обратный порядок переворачивает ключ, но не закреплённых и не «пустых»', order('left', true), ['Нұрсұлтан', 'Камила', 'Әсел', 'Айгерим', 'Тимур', 'Алина', 'Данияр'])
check('исходный массив не меняется', rows.map((r) => r.name.split(' ')[0]), ['Тимур', 'Нұрсұлтан', 'Данияр', 'Айгерим', 'Әсел', 'Алина', 'Камила'])

console.log(`\n${total - fail}/${total} проверок прошло`)
process.exit(fail ? 1 : 0)
