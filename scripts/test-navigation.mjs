/**
 * Меню по роли (src/app/navigation.ts): набор вкладок и какая из них активна.
 *
 * Зачем. Конфиг один на нижнюю панель (телефон) и боковую (компьютер), и меню
 * по роли в нём пока ВЫКЛЮЧЕНО — включает PLAN.md Ф2.10. Тест держит три вещи:
 *   1. выключатель действительно выключен: учитель видит то же меню, что и
 *      ученик, — ровно нынешние четыре вкладки;
 *   2. подсветка не потерялась при переезде из BottomNav: каждый внутренний
 *      экран подсвечивает свою вкладку (без `also` грамматика гасила бы всю
 *      навигацию);
 *   3. включённый выключатель (параметр, константу не трогаем) даёт учителю
 *      его меню из архитектуры §16, а ученику — прежнее;
 *   4. плашка «Тариф закончился» (PLAN.md Ф2.4) — на стартовом экране и у
 *      репетитора в студии; с меню учителя — над расписанием, а не в
 *      «Моей учёбе».
 *
 * ⚠️ Ожидания — литералами, а не из того же конфига: сверка конфига с самим
 * собой зелёная при любой поломке.
 *
 * Запуск: node scripts/test-navigation.mjs
 */
import {
  ROLE_NAV_ENABLED,
  STUDENT_TABS,
  TEACHER_TABS,
  activeTabIndex,
  showsAccessBanner,
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

// ── 1. выключатель выключен: у всех нынешнее меню ────────────────────────
check('меню по роли выключено до Ф2.10', ROLE_NAV_ENABLED === false)
const STUDENT = 'Главная · Учёба · Практика · Диалог'
check('ученик видит четыре вкладки', labels(tabsFor('student')) === STUDENT, labels(tabsFor('student')))
check('учитель видит то же меню, что ученик', labels(tabsFor('teacher')) === STUDENT, labels(tabsFor('teacher')))
check('без роли (профиль не загрузился) — то же меню', labels(tabsFor(null)) === STUDENT)
check(
  'адреса вкладок прежние',
  STUDENT_TABS.map((t) => t.to).join(' ') === '/ /study /practice /conversation',
  STUDENT_TABS.map((t) => t.to).join(' '),
)

// ── 2. подсветка: адрес → индекс вкладки ─────────────────────────────────
const expected = {
  '/': 0,
  '/progress': 0,
  '/settings': 0,
  '/teacher': 0,
  '/admin': 0,
  '/study': 1,
  '/grammar': 1,
  '/placement': 1,
  '/assignments': 1,
  '/program': 1,
  '/quests': 1,
  '/writing': 1,
  '/self-material': 1,
  '/practice': 2,
  '/pronunciation': 2,
  '/conversation': 3,
  // экраны вне вкладок: подложку не показываем, а не вешаем на первую
  '/login': -1,
  '/onboarding': -1,
}
for (const [path, index] of Object.entries(expected)) {
  const got = activeTabIndex(tabsFor('student'), path)
  check(`${path} подсвечивает ${index < 0 ? 'ничего' : labels([STUDENT_TABS[index]])}`, got === index, `индекс ${got}`)
}

// ── 3. включённый выключатель: меню учителя из §16 ────────────────────────
check(
  'учителю — Расписание · Ученики · Задания · Моя учёба',
  labels(tabsFor('teacher', true)) === 'Расписание · Ученики · Задания · Моя учёба',
  labels(tabsFor('teacher', true)),
)
check('ученику при включённом — прежнее меню', labels(tabsFor('student', true)) === STUDENT)
check('неизвестная роль — меню ученика', labels(tabsFor('admin', true)) === STUDENT)
const teacherActive = (path) => labels([TEACHER_TABS[activeTabIndex(TEACHER_TABS, path)] ?? { label: '—' }])
check('учитель: студия — вкладка «Ученики»', teacherActive('/teacher') === 'Ученики', teacherActive('/teacher'))
for (const path of ['/', '/study', '/grammar', '/practice', '/pronunciation', '/conversation', '/settings']) {
  check(`учитель: ${path} — «Моя учёба» (экраны ученика те же)`, teacherActive(path) === 'Моя учёба', teacherActive(path))
}

// ── плашка «Тариф закончился» (Ф2.4) ─────────────────────────────────────────
const banner = (path, role, enabled) => showsAccessBanner(path, role, enabled)
check('сейчас: репетитору — на Главной', banner('/', 'teacher', false))
check('сейчас: репетитору — в студии', banner('/teacher', 'teacher', false))
check('сейчас: самоучке — на Главной', banner('/', 'learner', false))
check('ученику в «Преподавателе» (приглашение) — нет', !banner('/teacher', 'learner', false))
for (const path of ['/study', '/practice', '/conversation', '/settings', '/pay', '/progress']) {
  check(`на ${path} — нет`, !banner(path, 'teacher', false))
}
check('роль ещё не пришла — нет', !banner('/', null, false))
check('с меню учителя (Ф2.10): над расписанием', banner('/schedule', 'teacher', true))
check('с меню учителя: в студии — да', banner('/teacher', 'teacher', true))
check('с меню учителя: «Моя учёба» — без плашки', !banner('/', 'teacher', true))
check('с меню учителя ученику — по-прежнему Главная', banner('/', 'learner', true))

console.log(`\nИтог: ${pass}/${pass + fail}`)
process.exitCode = fail === 0 ? 0 : 1
