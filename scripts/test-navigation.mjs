/**
 * Меню по роли (src/app/navigation.ts): набор вкладок, какая из них активна,
 * стартовый экран и где плашка «Тариф закончился».
 *
 * Зачем. Конфиг один на нижнюю панель (телефон) и боковую (компьютер). С
 * PLAN.md Ф2.10 у учителя своё меню (журнал п.34–35, макет t1). Тест держит:
 *   1. ученик видит прежние четыре вкладки, учитель — Расписание · Ученики ·
 *      Задания · Моя учёба; пока роль неизвестна — вкладок нет (а не чужое
 *      меню), роль не пришла из-за сбоя — меню ученика;
 *   2. старт: учитель — расписание, ученик — Главная;
 *   3. подсветка: каждый внутренний экран подсвечивает свою вкладку (без
 *      `also` грамматика гасила бы всю навигацию); у учителя экраны ученика
 *      — «Моя учёба»; лендинг /teachers не подсвечивает «Ученики» /teacher;
 *   4. счётчик «ждут проверки» — только на «Заданиях»;
 *   5. плашка «Тариф закончился» (Ф2.4) — на стартовом экране роли и во всей
 *      студии, но не в «Моей учёбе».
 *
 * ⚠️ Ожидания — литералами, а не из того же конфига: сверка конфига с самим
 * собой зелёная при любой поломке.
 *
 * Запуск: node scripts/test-navigation.mjs
 */
import {
  STUDENT_TABS,
  TEACHER_TABS,
  activeTabIndex,
  showsAccessBanner,
  startPath,
  tabsFor,
} from '../src/app/navigation.ts'

let pass = 0
let fail = 0
const check = (name, ok, extra = '') => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const labels = (tabs) => tabs.map((t) => t.label).join(' · ')
const paths = (tabs) => tabs.map((t) => t.to).join(' ')

// ── 1. наборы вкладок ───────────────────────────────────────────────────────
const STUDENT = 'Главная · Учёба · Практика · Диалог'
const TEACHER = 'Расписание · Ученики · Задания · Моя учёба'
check('ученик видит четыре прежние вкладки', labels(tabsFor('learner')) === STUDENT, labels(tabsFor('learner')))
check('адреса вкладок ученика прежние', paths(STUDENT_TABS) === '/ /study /practice /conversation', paths(STUDENT_TABS))
check('учитель — Расписание · Ученики · Задания · Моя учёба', labels(tabsFor('teacher')) === TEACHER, labels(tabsFor('teacher')))
check('адреса вкладок учителя', paths(TEACHER_TABS) === '/schedule /teacher /tasks /learn', paths(TEACHER_TABS))
check('роль неизвестна (первый вход на устройстве) — вкладок нет, а не чужое меню', tabsFor(undefined).length === 0)
check('роли нет или база не ответила — меню ученика', labels(tabsFor(null)) === STUDENT)
check('другая роль (admin) — меню ученика', labels(tabsFor('admin')) === STUDENT)

// ── 2. стартовый экран ──────────────────────────────────────────────────────
check('старт учителя — расписание', startPath('teacher') === '/schedule', startPath('teacher'))
check('старт ученика — Главная', startPath('learner') === '/', startPath('learner'))
check('старт без роли — Главная', startPath(null) === '/', startPath(null))

// ── 3. подсветка: адрес → вкладка ───────────────────────────────────────────
const active = (role, path) => labels([tabsFor(role)[activeTabIndex(tabsFor(role), path)] ?? { label: '—' }])
const studentExpected = {
  '/': 'Главная',
  '/progress': 'Главная',
  '/settings': 'Главная',
  '/lessons': 'Главная',
  '/admin': 'Главная',
  // экраны студии у ученика — приглашение «Ведёшь учеников?»
  '/teacher': 'Главная',
  '/schedule': 'Главная',
  '/tasks': 'Главная',
  '/invite': 'Главная',
  '/study': 'Учёба',
  '/grammar': 'Учёба',
  '/placement': 'Учёба',
  '/assignments': 'Учёба',
  '/program': 'Учёба',
  '/quests': 'Учёба',
  '/writing': 'Учёба',
  '/self-material': 'Учёба',
  '/practice': 'Практика',
  '/pronunciation': 'Практика',
  '/conversation': 'Диалог',
  // вне вкладок: подложку не показываем, а не вешаем на первую
  '/login': '—',
  '/onboarding': '—',
  '/pay': '—',
  // лендинг /teachers — не студия /teacher (startsWith подсвечивал бы Главную)
  '/teachers': '—',
}
for (const [path, label] of Object.entries(studentExpected)) {
  const got = active('learner', path)
  check(`ученик: ${path} — ${label === '—' ? 'ничего' : label}`, got === label, got)
}
const teacherExpected = {
  '/schedule': 'Расписание',
  '/teacher': 'Ученики',
  '/tasks': 'Задания',
  '/learn': 'Моя учёба',
  // экраны ученика — внутри «Моей учёбы», их никто не дублирует
  '/study': 'Моя учёба',
  '/grammar': 'Моя учёба',
  '/placement': 'Моя учёба',
  '/assignments': 'Моя учёба',
  '/program': 'Моя учёба',
  '/quests': 'Моя учёба',
  '/writing': 'Моя учёба',
  '/self-material': 'Моя учёба',
  '/practice': 'Моя учёба',
  '/pronunciation': 'Моя учёба',
  '/conversation': 'Моя учёба',
  '/progress': 'Моя учёба',
  '/settings': 'Моя учёба',
  '/lessons': 'Моя учёба',
  // не учёба и не вкладка
  '/admin': '—',
  '/invite': '—',
  '/pay': '—',
  '/teachers': '—',
}
for (const [path, label] of Object.entries(teacherExpected)) {
  const got = active('teacher', path)
  check(`учитель: ${path} — ${label === '—' ? 'ничего' : label}`, got === label, got)
}

// ── 4. счётчик «ждут проверки» ──────────────────────────────────────────────
const badged = TEACHER_TABS.filter((t) => t.badge).map((t) => `${t.label}:${t.badge}`).join(' ')
check('счётчик «ждут проверки» — только на «Заданиях»', badged === 'Задания:reviews', badged)
check('у ученика счётчиков на вкладках нет', STUDENT_TABS.every((t) => !t.badge))

// ── 5. плашка «Тариф закончился» (Ф2.4) ─────────────────────────────────────
const banner = (path, role) => showsAccessBanner(path, role)
check('самоучке — на Главной', banner('/', 'learner'))
check('учителю — над расписанием (старт, макет t9-3)', banner('/schedule', 'teacher'))
check('учителю — в «Учениках»', banner('/teacher', 'teacher'))
check('учителю — в «Заданиях»', banner('/tasks', 'teacher'))
check('учителю в «Моей учёбе» — нет', !banner('/learn', 'teacher'))
for (const path of ['/study', '/practice', '/conversation', '/settings', '/pay', '/progress']) {
  check(`учителю на ${path} — нет`, !banner(path, 'teacher'))
}
check('ученику на экранах студии (приглашение) — нет', !banner('/schedule', 'learner') && !banner('/teacher', 'learner'))
check('роль ещё не пришла — нет', !banner('/', null) && !banner('/schedule', undefined))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
