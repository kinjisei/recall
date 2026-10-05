/**
 * Расписание на экране — правила без базы (PLAN.md Ф2.7; src/domains/schedule:
 * calendar.ts, editor.ts, status.ts; src/shared/lib/days.ts):
 *
 *   • время по Алматы, а не по поясу компьютера: момент ↔ день и «19:00»,
 *     урок за полночь, границы дня;
 *   • подписи из макетов: «чт, 15 октября», «12–18 октября», «1,5 ч»,
 *     «через 50 мин», «Каждый вт и чт», «Каждую сб»;
 *   • сетка месяца (календарь в шторке) и раскладка дня: пересекающиеся
 *     уроки встают рядом;
 *   • вопрос после пробного: кому задаём, кому нет;
 *   • шторка «Новый урок»: почему нельзя создать, сводка «… · 20 уроков»
 *     (пример макета t3-1), пересечение, ссылка — копия lesson_link_clean;
 *   • перенос «этот и все следующие»: новые дни серии и сколько отдельно
 *     перенесённых уроков перестроится (журнал п.65, 3);
 *   • «Останется / Станет N уроков», тексты ученику (макет t5-4);
 *   • метка урока: автосписание, поздняя отмена, пробный, перенесён.
 * Чистый: без сети и базы. Запуск: node scripts/test-schedule-screen.mjs
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { monthGrid, weekStart } from '../src/shared/lib/days.ts'
import {
  almatyInstant,
  almatyMinutes,
  almatyTime,
  dayBounds,
  dayLong,
  dayShort,
  dayTitle,
  durationLabel,
  hourWindow,
  lessonDay,
  placeLessons,
  relativeLabel,
  repeatLabel,
  trialQuestions,
  weekTitle,
} from '../src/domains/schedule/calendar.ts'
import {
  balanceAfter,
  cancelledMessage,
  cleanLink,
  defaultSlot,
  draftProblem,
  draftSummary,
  endTime,
  leavingLessons,
  movedMessage,
  movedWeekdays,
  newDraft,
  overlaps,
  rebuildCount,
  reminderMessage,
  seriesCancelledMessage,
  toLessonInput,
  toSeriesInput,
} from '../src/domains/schedule/editor.ts'
import { lessonBadge, lessonSubtitle, nextLessonId } from '../src/domains/schedule/status.ts'

let ok = 0
let failed = 0
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` — получили ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`}`)
  pass ? ok++ : failed++
}

// ── время по Алматы ─────────────────────────────────────────────────────────────────
// Пояс компьютера проверки — любой: правила обязаны давать Алматы (UTC+5).
check('чт 15 окт 19:00 по Алматы = 14:00 UTC', almatyInstant('2026-10-15', '19:00').toISOString(), '2026-10-15T14:00:00.000Z')
check('момент → минуты и «ЧЧ:ММ»', [almatyMinutes('2026-10-15T14:00:00Z'), almatyTime('2026-10-15T14:00:00Z')], [1140, '19:00'])
check('19:30 UTC — уже 00:30 следующего дня', [almatyTime('2026-10-15T19:30:00Z'), lessonDay({ startsAt: '2026-10-15T19:30:00Z' })], ['00:30', '2026-10-16'])
const b = dayBounds('2026-10-15')
check('границы дня — полночи по Алматы', [b.from.toISOString(), b.to.toISOString()], ['2026-10-14T19:00:00.000Z', '2026-10-15T19:00:00.000Z'])

// Пояс компьютера проверки может совпасть с Алматы (у владельца — UTC+5), а TZ
// на Windows не меняет пояс node: ошибку «взяли местное время» значения выше
// здесь не поймают. Поэтому сторож по тексту: в правилах расписания нет ни
// одного метода местного времени — только Intl с поясом Алматы.
const LOCAL_TIME = /\.(getHours|getMinutes|getDate|getDay|getMonth|getFullYear|setHours|setDate|getTimezoneOffset|toLocale\w*)\(/
const scheduleFiles = [
  ...['calendar.ts', 'editor.ts', 'status.ts', 'model.ts', 'ledger.ts', 'student.ts'].map((f) => join(import.meta.dirname, '../src/domains/schedule', f)),
  // тексты уведомлений об уроках (Ф2.9) — тоже по Алматы
  join(import.meta.dirname, '../src/domains/notifications/lessonText.ts'),
]
check('в правилах расписания нет местного времени', scheduleFiles.filter((f) => LOCAL_TIME.test(readFileSync(f, 'utf8'))), [])
check('сторож местного времени краснеет', LOCAL_TIME.test('const h = new Date(x).getHours()'), true)

// ── подписи ──────────────────────────────────────────────────────────────────────────
check('день', [dayLong('2026-10-15'), dayShort('2026-10-15')], ['чт, 15 октября', 'чт, 15 окт'])
check('шторка урока: сегодня, завтра, вчера, дальше', [
  dayTitle('2026-10-15', '2026-10-15'),
  dayTitle('2026-10-16', '2026-10-15'),
  dayTitle('2026-10-14', '2026-10-15'),
  dayTitle('2026-10-22', '2026-10-15'),
], ['Сегодня, чт 15 октября', 'Завтра, пт 16 октября', 'Вчера, ср 14 октября', 'чт, 22 октября'])
check('неделя в месяце и на стыке месяцев', [weekTitle('2026-10-12'), weekTitle('2026-09-28')], ['12–18 октября', '28 сентября – 4 октября'])
check('понедельник недели', [weekStart('2026-10-15'), weekStart('2026-10-12'), weekStart('2026-10-18')], ['2026-10-12', '2026-10-12', '2026-10-12'])
check('длительность', [60, 90, 120, 45, 75, 150].map(durationLabel), ['1 ч', '1,5 ч', '2 ч', '45 мин', '1 ч 15 мин', '2,5 ч'])
const ielts = { startsAt: '2026-10-15T12:00:00Z', endsAt: '2026-10-15T13:30:00Z' } // 17:00–18:30
check('когда урок', [
  relativeLabel(ielts, new Date('2026-10-15T11:10:00Z')),
  relativeLabel(ielts, new Date('2026-10-15T08:00:00Z')),
  relativeLabel(ielts, new Date('2026-10-14T12:00:00Z')),
  relativeLabel(ielts, new Date('2026-10-08T12:00:00Z')),
  relativeLabel(ielts, new Date('2026-10-15T12:30:00Z')),
  relativeLabel(ielts, new Date('2026-10-15T14:00:00Z')),
], ['через 50 мин', 'через 4 ч', 'завтра', 'через 7 дней', 'идёт', 'прошёл'])
check('повтор: род дня недели и шаг', [
  repeatLabel([4, 2], 1),
  repeatLabel([6], 1),
  repeatLabel([7], 1),
  repeatLabel([1, 3, 5], 1),
  repeatLabel([2, 4], 2),
], ['Каждый вт и чт', 'Каждую сб', 'Каждое вс', 'Каждый пн, ср и пт', 'Раз в 2 недели: вт и чт'])

// ── календарь месяца ─────────────────────────────────────────────────────────────────
const oct = monthGrid('2026-10-19')
check('октябрь 2026: 1-е — четверг, 5 недель', [oct.length, oct[0].slice(0, 4)], [5, [null, null, null, '2026-10-01']])
check('октябрь 2026: 31-е — суббота, в конце пустая клетка', oct[4], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null])

// ── раскладка дня ────────────────────────────────────────────────────────────────────
const at = (hhmm, min) => {
  const s = almatyInstant('2026-10-15', hhmm)
  return { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + min * 60_000).toISOString() }
}
const placed = placeLessons([at('17:00', 90), at('17:30', 60), at('19:00', 60)], '2026-10-15')
check('пересекающиеся — рядом, отдельный — во всю ширину', placed.map((p) => [p.top, p.height, p.lane, p.lanes]), [
  [1020, 90, 0, 2],
  [1050, 60, 1, 2],
  [1140, 60, 0, 1],
])
check('часы сетки: обычно 8–22, ранний урок расширяет', [hourWindow([]), hourWindow(placeLessons([at('06:30', 60)], '2026-10-15'))], [
  { from: 8, to: 22 },
  { from: 6, to: 22 },
])

// ── вопрос после пробного ────────────────────────────────────────────────────────────
const P = (cardId, extra = {}) => ({ cardId, name: cardId, cardStatus: 'trial', trial: true, attended: null, charge: null, chargeAuto: false, ...extra })
const L = (id, hhmm, participants, extra = {}) => ({
  id, seriesId: null, seriesDate: null, kind: 'trial', status: 'planned', ...at(hhmm, 60),
  title: null, link: null, movedFrom: null, version: 1, settled: false, participants, ...extra,
})
const afternoon = new Date('2026-10-15T11:00:00Z') // 16:00
const asked = trialQuestions([
  L('nursultan', '14:30', [P('n')]),
  L('cancelled', '10:00', [P('c')], { status: 'cancelled' }),
  L('absent', '11:00', [P('a', { attended: false })]),
  L('stays', '12:00', [P('s', { cardStatus: 'active' })]),
  L('future', '18:00', [P('f')]),
  L('older', '09:00', [P('n')]),
], afternoon)
check('спрашиваем только про прошедший пробный «пробного» ученика, по одному', asked.map((q) => q.lesson.id), ['nursultan'])

// ── шторка «Новый урок» ──────────────────────────────────────────────────────────────
check('время нового урока', [
  defaultSlot('2026-10-15', '2026-10-15', 16 * 60 + 10),
  defaultSlot('2026-10-15', '2026-10-15', 21 * 60 + 30),
  defaultSlot('2026-10-19', '2026-10-15', 16 * 60 + 10),
], [{ day: '2026-10-15', time: '17:00' }, { day: '2026-10-16', time: '18:00' }, { day: '2026-10-19', time: '18:00' }])
check('конец урока за полночь', endTime('23:30', 60), '00:30')
const d0 = newDraft('2026-10-19', '18:00')
const today = '2026-10-15'
check('почему нельзя создать', [
  draftProblem(d0, today),
  draftProblem({ ...d0, kind: 'group', cardIds: ['a'] }, today),
  draftProblem({ ...d0, kind: 'group', title: 'IELTS вечер' }, today),
  draftProblem({ ...d0, cardIds: ['a'], minutes: 10 }, today),
  draftProblem({ ...d0, cardIds: ['a'], repeat: true, weekdays: [] }, today),
  draftProblem({ ...d0, cardIds: ['a'], repeat: true, endsOn: '2026-10-01' }, today),
  draftProblem({ ...d0, cardIds: ['a'], day: '2026-08-01' }, today),
  draftProblem({ ...d0, cardIds: ['a'], link: 'не ссылка' }, today),
  draftProblem({ ...d0, cardIds: ['a'], link: 'meet.google.com/kzr-mdsn-tqp' }, today),
  draftProblem({ ...d0, cardIds: ['a'], repeat: true, weekdays: [1, 3] }, today),
], [
  'Выбери ученика', 'Назови группу', 'Добавь учеников в группу', 'Длительность — от 15 минут до 8 часов',
  'Выбери дни недели', 'Окончание раньше первого урока', 'Записать можно урок не старше 60 дней',
  'Ссылка — адрес вида meet.google.com/…', null, null,
])
check('ссылка — как в базе', [
  cleanLink('meet.google.com/kzr-mdsn-tqp'),
  cleanLink(' https://zoom.us/j/123 '),
  cleanLink(''),
  cleanLink('привет'),
  cleanLink('javascript:alert(1)'),
], ['https://meet.google.com/kzr-mdsn-tqp', 'https://zoom.us/j/123', null, false, false])

// cleanLink — копия lesson_link_clean: те же два регэкспа и тот же предел
const sql = readFileSync(join(import.meta.dirname, '../supabase/migrations/0009_schedule.sql'), 'utf8')
const linkFn = sql.match(/function public\.lesson_link_clean[\s\S]*?end \$fn\$/)?.[0] ?? ''
check('cleanLink = lesson_link_clean (регэкспы и 500 знаков)', [
  linkFn.includes(String.raw`'^[a-z0-9-]+(\.[a-z0-9-]+)+(/|$)'`),
  linkFn.includes(String.raw`'^https?://[^\s<>"]+$'`),
  linkFn.includes('char_length(v) > 500'),
], [true, true, true])

check('разовый урок → вход create_lesson', toLessonInput({ ...d0, day: '2026-10-15', time: '17:30', cardIds: ['a'], link: '' }), {
  kind: 'individual', startsAt: '2026-10-15T12:30:00.000Z', minutes: 60, cardIds: ['a'],
})
check('группа → серия: дни по порядку, название', toSeriesInput({ ...d0, kind: 'group', title: ' Грамматика B1 ', cardIds: ['a', 'b'], repeat: true, weekdays: [6, 2] }), {
  kind: 'group', weekdays: [2, 6], time: '18:00', minutes: 60, everyWeeks: 1, endsOn: null, cardIds: ['a', 'b'],
  title: 'Грамматика B1', startsOn: '2026-10-19',
})
check('сводка: серия с окончанием (макет t3-1)', draftSummary({ ...d0, cardIds: ['n'], repeat: true, weekdays: [1, 3], endsOn: '2026-12-23' }),
  'Каждый пн и ср, 18:00–19:00 · с 19 окт до 23 дек · 20 уроков')
check('сводка: группа без окончания (макет t3-2)', draftSummary({ ...newDraft('2026-10-17', '13:00'), kind: 'group', minutes: 90, cardIds: ['a', 'b', 'c'], repeat: true, weekdays: [6] }),
  'Каждую сб, 13:00–14:30 · с 17 окт, без даты окончания · 3 ученика')
check('сводка: разовый и пробный (t3-4, t3-3)', [
  draftSummary({ ...newDraft('2026-10-15', '17:30'), cardIds: ['a'] }),
  draftSummary({ ...newDraft('2026-10-16', '15:00'), kind: 'trial', cardIds: ['a'] }),
], ['чт, 15 окт, 17:30–18:30 · 1 урок', 'пт, 16 окт, 15:00–16:00 · пробный, не списывается'])

const ieltsLesson = L('ielts', '17:00', [], { kind: 'group', title: 'IELTS вечер', endsAt: almatyInstant('2026-10-15', '18:30').toISOString() })
const draft1730 = { ...newDraft('2026-10-15', '17:30'), cardIds: ['a'] }
check('пересечение (макет t3-4) и его границы', [
  overlaps(draft1730, [ieltsLesson]).map((l) => l.id),
  overlaps(draft1730, [{ ...ieltsLesson, status: 'cancelled' }]).length,
  overlaps(draft1730, [ieltsLesson], 'ielts').length,
  overlaps({ ...draft1730, time: '18:30' }, [ieltsLesson]).length,
], [['ielts'], 0, 0, 0])

// ── «этот и все следующие» ───────────────────────────────────────────────────────────
const thu = { seriesDate: '2026-10-22', startsAt: almatyInstant('2026-10-22', '19:00').toISOString() }
check('перенос чт → пт в серии «вт и чт» даёт «вт и пт»', movedWeekdays({ weekdays: [2, 4] }, thu, '2026-10-23'), [2, 5])
const S = (id, day, extra = {}) => ({
  ...L(id, '19:00', [P('x', { trial: false, cardStatus: 'active' })], { kind: 'individual', seriesId: 's1', seriesDate: day }),
  startsAt: almatyInstant(day, '19:00').toISOString(),
  endsAt: almatyInstant(day, '20:00').toISOString(),
  ...extra,
})
const moved = { movedFrom: '2026-10-01T14:00:00Z' }
const seriesLessons = [
  S('this', '2026-10-22'),
  S('moved-ahead', '2026-10-27', moved),
  S('moved-cancelled', '2026-10-29', { ...moved, status: 'cancelled' }),
  S('moved-charged', '2026-11-03', { ...moved, participants: [P('x', { trial: false, charge: 'late_cancel' })] }),
  S('moved-before', '2026-10-20', moved),
  S('other-series', '2026-11-05', { ...moved, seriesId: 's2' }),
  S('plain', '2026-11-10'),
]
check('перестроится 1 отдельно перенесённый урок', rebuildCount(seriesLessons, seriesLessons[0], new Date('2026-10-15T11:00:00Z')), 1)

// ── пауза и архив (журнал п.65, 1) ───────────────────────────────────────────────────
const nowLeave = new Date('2026-10-15T11:00:00Z')
const leave = [
  S('series-ahead', '2026-10-20'),
  { ...S('one-off', '2026-10-21'), seriesId: null, seriesDate: null },
  S('cancelled', '2026-10-22', { status: 'cancelled' }),
  S('past', '2026-10-13'),
  S('late-marked', '2026-10-27', { participants: [P('x', { trial: false, charge: 'late_cancel' })] }),
  S('someone-else', '2026-10-29', { participants: [P('y', { trial: false })] }),
]
check('уйдут будущие уроки ученика: 2, из них разовый — 1', leavingLessons(leave, 'x', nowLeave), { total: 2, oneOff: 1 })

// ── остаток и тексты ученику ─────────────────────────────────────────────────────────
check('Останется / Станет', [
  balanceAfter(3, false, false),
  balanceAfter(3, false, true),
  balanceAfter(1, true, true),
  balanceAfter(1, true, false),
  balanceAfter(0, false, true),
], ['Останется 3 урока', 'Станет 2 урока', 'Останется 1 урок', 'Станет 2 урока', 'Станет −1 урок'])
check('перенос (макет t5-4)', movedMessage('Тимур', almatyInstant('2026-10-20', '10:00').toISOString(), almatyInstant('2026-10-21', '10:00').toISOString()),
  'Тимур, урок перенесён: вт, 20 окт, 10:00 → ср, 21 окт, 10:00')
check('напоминание со ссылкой (макет t5-4)', reminderMessage('Тимур', { ...at('10:00', 60), startsAt: almatyInstant('2026-10-21', '10:00').toISOString(), endsAt: almatyInstant('2026-10-21', '11:00').toISOString(), link: 'https://meet.google.com/kzr-mdsn-tqp' }),
  'Тимур, напоминаю: урок в ср, 21 окт, 10:00–11:00.\nСсылка: https://meet.google.com/kzr-mdsn-tqp')
check('отмена: «во вт», серия — днями', [
  cancelledMessage('Дана', { startsAt: almatyInstant('2026-10-20', '12:00').toISOString() }),
  seriesCancelledMessage('Айгерим', [4, 2], '2026-10-22'),
], ['Дана, урок во вт, 20 окт, 12:00 отменён.', 'Айгерим, уроки по вт и чт отменены с 22 окт.'])

// ── метка урока ──────────────────────────────────────────────────────────────────────
const evening = new Date('2026-10-15T13:10:00Z') // 18:10
const ind = (extra, p = {}) => L('i', '10:00', [P('t', { trial: false, cardStatus: 'active', ...p })], { kind: 'individual', ...extra })
check('метки (макет t2-3)', [
  lessonBadge(ind({ status: 'done' }, { attended: true, charge: 'charged', chargeAuto: true }), evening)?.text,
  lessonBadge(ind({ status: 'done' }, { attended: true, charge: 'charged' }), evening)?.text,
  lessonBadge(ind({ status: 'cancelled' }, { attended: false, charge: 'late_cancel' }), evening)?.text,
  lessonBadge(ind({ status: 'cancelled' }, { attended: false, charge: 'not_charged' }), evening)?.text,
  lessonBadge(ind({}), evening)?.text,
  lessonBadge(L('n', '14:30', [P('n', { attended: true, charge: 'not_charged' })], { status: 'done' }), evening)?.text,
  lessonBadge(L('t', '20:00', [P('t')]), evening)?.text,
  lessonBadge(ind({ startsAt: almatyInstant('2026-10-16', '15:00').toISOString(), endsAt: almatyInstant('2026-10-16', '16:00').toISOString(), movedFrom: '2026-10-12T13:00:00Z' }), evening)?.text,
  lessonBadge(ind({ startsAt: almatyInstant('2026-10-16', '15:00').toISOString(), endsAt: almatyInstant('2026-10-16', '16:00').toISOString() }), evening),
], ['Автосписание', 'Списан', 'Поздняя отмена', 'Отменён', 'Не отмечен', 'Пробный', 'Пробный', 'Перенесён', null])
const group = { ...ieltsLesson, kind: 'group', participants: [P('a'), P('b'), P('c')], startsAt: almatyInstant('2026-10-15', '17:00').toISOString(), endsAt: almatyInstant('2026-10-15', '18:30').toISOString() }
check('строка под именем', [
  lessonSubtitle(group, afternoon, () => true),
  lessonSubtitle(ind({ startsAt: almatyInstant('2026-10-16', '10:00').toISOString(), endsAt: almatyInstant('2026-10-16', '11:00').toISOString() }), afternoon, () => false),
  lessonSubtitle(ind({ startsAt: almatyInstant('2026-10-16', '10:00').toISOString(), endsAt: almatyInstant('2026-10-16', '11:00').toISOString(), movedFrom: almatyInstant('2026-10-12', '18:00').toISOString() }), afternoon, () => true),
], ['1,5 ч · группа · 3 ученика', '1 ч · без приложения', 'Перенесён с пн, 18:00'])
check('«через 50 мин» — у ближайшего урока', nextLessonId([ind({}), group, { ...group, id: 'later', startsAt: almatyInstant('2026-10-15', '19:00').toISOString() }], afternoon), 'ielts')

console.log(`\nИтог: ${ok}/${ok + failed}`)
process.exitCode = failed ? 1 : 0
