// ============================================================================
// Меню по роли — один конфиг на обе панели навигации (архитектура §16).
//
// Нижняя панель (телефон) и боковая (компьютер) рисуют ОДИН набор вкладок
// отсюда: иначе после первой же правки они разойдутся. Здесь только данные и
// правила — без иконок и разметки (иконки по имени подставляет
// shell/navIcons), поэтому правила проверяет чистый тест
// (scripts/test-navigation.mjs).
//
// ⚠️ Меню по роли ВЫКЛЮЧЕНО (ROLE_NAV_ENABLED = false): все, и учитель тоже,
// видят нынешнее меню ученика. Включается в PLAN.md Ф2.10 — вместе с экранами
// «Расписание» и «Задания», которых пока нет.
// ============================================================================

/** Имя иконки вкладки; компоненты — в shell/navIcons. */
export type NavIconName = 'home' | 'study' | 'practice' | 'dialog' | 'schedule' | 'students' | 'tasks'

export interface NavTab {
  to: string
  label: string
  icon: NavIconName
  /** Активна только на своём адресе целиком (Главная), а не на вложенных. */
  end: boolean
  /** Внутренние экраны вкладки: на них она тоже подсвечивается. */
  also?: string[]
}

/** Выключатель меню по роли. Включает PLAN.md Ф2.10. */
export const ROLE_NAV_ENABLED = false

// Четыре вкладки ученика (2026-07-21): новичок терялся между «Слова»,
// «Учёба» и «Речь». Смысловое деление: Учёба — изучаю новое (тексты, уроки
// грамматики, тест уровня), Практика — тренируюсь (повторение колоды, все
// мини-игры, речь), Диалог — общаюсь с AI.
//
// Без `also` заход в грамматику или задания гасил всю навигацию — человек
// оказывался «нигде»: ни одна вкладка не была активной.
export const STUDENT_TABS: NavTab[] = [
  { to: '/', label: 'Главная', icon: 'home', end: true, also: ['/progress', '/settings', '/teacher', '/schedule', '/admin'] },
  {
    to: '/study',
    label: 'Учёба',
    icon: 'study',
    end: false,
    also: ['/grammar', '/placement', '/assignments', '/program', '/quests', '/writing', '/self-material'],
  },
  { to: '/practice', label: 'Практика', icon: 'practice', end: false, also: ['/pronunciation'] },
  { to: '/conversation', label: 'Диалог', icon: 'dialog', end: false },
]

// Все адреса меню ученика, кроме Главной и студии (студия у учителя — своя
// вкладка «Ученики»): их подсвечивает «Моя учёба».
const STUDENT_PATHS = STUDENT_TABS.flatMap((t) => [t.to, ...(t.also ?? [])]).filter(
  (p) => p !== '/' && p !== '/teacher',
)

// Меню учителя (журнал п.34–35): Расписание · Ученики · Задания · Моя учёба.
// ЧЕРНОВИК до Ф2.10: экрана расписания ещё нет (Ф2.7), «Задания» пока ведут
// во вкладку материалов студии, иконки — из нынешнего набора. «Моя учёба» —
// вход в те же экраны ученика, их никто не дублирует.
export const TEACHER_TABS: NavTab[] = [
  { to: '/schedule', label: 'Расписание', icon: 'schedule', end: false },
  { to: '/teacher', label: 'Ученики', icon: 'students', end: true },
  { to: '/teacher?tab=materials', label: 'Задания', icon: 'tasks', end: false },
  { to: '/', label: 'Моя учёба', icon: 'study', end: true, also: STUDENT_PATHS },
]

/**
 * Вкладки для роли. `enabled` — выключатель (параметр, чтобы тест проверял
 * оба положения, не трогая константу).
 */
export function tabsFor(role: string | null | undefined, enabled: boolean = ROLE_NAV_ENABLED): NavTab[] {
  if (!enabled) return STUDENT_TABS
  return role === 'teacher' ? TEACHER_TABS : STUDENT_TABS
}

/** Активна и на своих внутренних экранах: грамматика подсвечивает «Учёбу». */
export function isTabActive(tab: NavTab, pathname: string): boolean {
  const path = tab.to.replace(/\?.*$/, '') // «Задания» учителя — адрес с ?tab=
  if (tab.end ? pathname === path : pathname.startsWith(path)) return true
  return (tab.also ?? []).some((p) => pathname.startsWith(p))
}

/**
 * Индекс активной вкладки — позиция подложки. −1 (ни одна не подходит)
 * возможен на экранах вне вкладок; тогда подложку не показываем, а не
 * оставляем висеть на первой.
 */
export function activeTabIndex(tabs: NavTab[], pathname: string): number {
  return tabs.findIndex((t) => isTabActive(t, pathname))
}

/** Экраны студии репетитора: студия и расписание (Ф2.7). */
const STUDIO_PATHS = ['/teacher', '/schedule']

/**
 * Где каркас показывает плашку «Тариф закончился — продлить» (PLAN.md Ф2.4,
 * решение владельца 03.10.2026): на стартовом экране — первой вкладке меню —
 * и у репетитора ещё в студии и над расписанием (макет t9-3: под плашкой —
 * «только для просмотра»). С меню учителя (Ф2.10) старт — расписание, а «Моя
 * учёба» остаётся без плашки. Есть ли что сказать, решает сама плашка
 * (features/billing).
 */
export function showsAccessBanner(
  pathname: string,
  role: string | null | undefined,
  enabled: boolean = ROLE_NAV_ENABLED,
): boolean {
  if (!role) return false
  return pathname === tabsFor(role, enabled)[0]?.to || (role === 'teacher' && STUDIO_PATHS.includes(pathname))
}
