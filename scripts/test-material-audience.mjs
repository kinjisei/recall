/**
 * «Для кого» в заявке на материал (src/features/teacher/materials/audience.ts,
 * PLAN.md Ф2.11б-3, журнал п.71 (10)): несколько учеников или группа из
 * расписания — и это же назначение.
 *
 * Держит:
 *   1. уровень — самого слабого из выбранных; неизвестный уровень не тянет вниз;
 *   2. уровень ученика в языке материала: английский — профиль, испанский —
 *      последний пройденный тест на испанском (не английском и не старый);
 *   3. строка-предупреждение: разные уровни, уровень формы выше чьего-то,
 *      неизвестный уровень; один ученик своего уровня — молчит;
 *   4. группы из расписания: только групповые серии, ученики в приложении,
 *      без архива, два дня одного состава — одна группа, кто вне приложения;
 *   5. нажатия: ученик и группа отмечаются и снимаются; черновик до
 *      Ф2.11б-3 (один studentId) читается как выбор одного.
 *
 * ⚠️ Ожидания — литералами, а не из тех же функций.
 *
 * Запуск: node scripts/test-material-audience.mjs
 */
import {
  levelIn,
  levelNote,
  namesLine,
  pickedIds,
  scheduleGroups,
  toggleGroup,
  toggleOne,
  weakest,
} from '../src/features/teacher/materials/audience.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// 1. самый слабый
check('B2 и B1 → B1', weakest(['B2', 'B1']) === 'B1', weakest(['B2', 'B1']))
check('A2, C1, B1 → A2', weakest(['A2', 'C1', 'B1']) === 'A2')
check('неизвестный не тянет вниз: null и B2 → B2', weakest([null, 'B2']) === 'B2')
check('никого не знаем → null', weakest([null, null]) === null)
check('пусто → null', weakest([]) === null)

// 2. уровень в языке материала
const tests = [
  { student_id: 's1', lang: 'es', result_level: 'A2', completed_at: '2026-09-01T10:00:00Z' },
  { student_id: 's1', lang: 'es', result_level: 'B1', completed_at: '2026-10-01T10:00:00Z' },
  { student_id: 's1', lang: 'en', result_level: 'C1', completed_at: '2026-10-05T10:00:00Z' },
  { student_id: 's2', lang: 'en', result_level: 'B2', completed_at: '2026-10-05T10:00:00Z' },
]
check('английский — из профиля', levelIn('en', 'B2', tests, 's1') === 'B2')
check('испанский — последний тест на испанском', levelIn('es', 'B2', tests, 's1') === 'B1', levelIn('es', 'B2', tests, 's1'))
check('испанский без испанского теста — неизвестен (профиль — английский)', levelIn('es', 'B2', tests, 's2') === null)

// 3. предупреждение
const tim = { name: 'Тимур', level: 'A2' }
const anya = { name: 'Аня', level: 'B1' }
check(
  'разные уровни, текст под слабого',
  levelNote([tim, anya], 'A2') === 'Уровни разные: Тимур A2 · Аня B1. Текст — под самого слабого (A2).',
  levelNote([tim, anya], 'A2'),
)
check(
  'учитель поднял уровень — кому будет трудно',
  levelNote([tim, anya], 'B1') === 'Уровни разные: Тимур A2 · Аня B1. Текст B1 будет трудным для: Тимур.',
  levelNote([tim, anya], 'B1'),
)
check('один ученик своего уровня — молчит', levelNote([tim], 'A2') === '')
check('один ученик, уровень выше его', levelNote([tim], 'B2') === 'Текст B2 будет трудным для: Тимур.')
check(
  'неизвестный уровень — где узнать',
  levelNote([tim, { name: 'Бека', level: null }], 'A2') === 'Уровень не знаем: Бека — тест уровня в карточке ученика.',
  levelNote([tim, { name: 'Бека', level: null }], 'A2'),
)
check('никого не выбрали — молчит', levelNote([], 'A2') === '')

// 4. группы из расписания
const cards = [
  { id: 'c1', userId: 'u1', name: 'Тимур Ким', status: 'active' },
  { id: 'c2', userId: 'u2', name: 'Аня Ли', status: 'trial' },
  { id: 'c3', userId: null, name: 'Бека Нур', status: 'active' },
  { id: 'c4', userId: 'u4', name: 'Дана Ос', status: 'archived' },
]
const series = [
  { id: 's-tue', kind: 'group', title: 'IELTS вечер', cardIds: ['c1', 'c2', 'c3', 'c4'] },
  { id: 's-thu', kind: 'group', title: 'IELTS вечер', cardIds: ['c2', 'c1'] },
  { id: 's-ind', kind: 'individual', title: null, cardIds: ['c1'] },
  { id: 's-nobody', kind: 'group', title: null, cardIds: ['c3'] },
  { id: 's-plain', kind: 'group', title: '  ', cardIds: ['c2', 'c3'] },
]
const groups = scheduleGroups(series, cards, ['u1', 'u2', 'u4'])
check('только групповые с кем-то в приложении; два дня одного состава — одна', eq(groups.map((g) => g.id), ['s-tue', 's-plain']), groups.map((g) => g.id).join(','))
check('ученики группы — в приложении, архив не берём', eq(groups[0]?.ids, ['u1', 'u2']), JSON.stringify(groups[0]?.ids))
check('кто вне приложения — по имени', eq(groups[0]?.outside, ['Бека']), JSON.stringify(groups[0]?.outside))
check('название группы — из расписания', groups[0]?.label === 'Группа «IELTS вечер»', groups[0]?.label)
check('без названия — по именам', groups[1]?.label === 'Группа: Аня, Бека', groups[1]?.label)

// 5. нажатия и черновик
check('ученик отмечается', eq(toggleOne(['u1'], 'u2'), ['u1', 'u2']))
check('…и снимается', eq(toggleOne(['u1', 'u2'], 'u1'), ['u2']))
check('группа отмечает недостающих', eq(toggleGroup(['u2'], ['u1', 'u2']), ['u2', 'u1']))
check('вся группа отмечена — снимается', eq(toggleGroup(['u1', 'u2', 'u9'], ['u1', 'u2']), ['u9']))
check('черновик до Ф2.11б-3: один studentId', eq(pickedIds({ studentId: 'u1' }), ['u1']))
check('черновик до Ф2.11б-3: studentId null — никто', eq(pickedIds({ studentId: null }), []))
check('новый черновик — список', eq(pickedIds({ studentIds: ['u1', 'u2'], studentId: 'u9' }), ['u1', 'u2']))
check('имена: больше трёх — «и ещё»', namesLine(['А', 'Б', 'В', 'Г', 'Д']) === 'А, Б, В и ещё 2', namesLine(['А', 'Б', 'В', 'Г', 'Д']))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail ? 1 : 0
