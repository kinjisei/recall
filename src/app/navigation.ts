// ============================================================================
// Меню по роли — один конфиг на обе панели навигации (архитектура §16, журнал
// п.34–35, макет t1; включено в PLAN.md Ф2.10).
//
// Нижняя панель (телефон) и боковая (компьютер) рисуют ОДИН набор вкладок
// отсюда: иначе после первой же правки они разойдутся. Здесь только данные и
// правила — без иконок и разметки (иконки по имени подставляет
// shell/navIcons), поэтому правила проверяет чистый тест
// (scripts/test-navigation.mjs).
//
// Ученик — Главная · Учёба · Практика · Диалог. Учитель — Расписание ·
// Ученики · Задания · Моя учёба: расписание первое, что он видит; «Моя
// учёба» — вход в те же экраны ученика (учитель, который сам учит язык), их
// никто не дублирует.
// ============================================================================

/** Имя иконки вкладки; компоненты — в shell/navIcons. */
export type NavIconName = 'home' | 'study' | 'practice' | 'dialog' | 'schedule' | 'students' | 'tasks'

/** Счётчик на вкладке; число даёт каркас (reviews — работы, ждущие проверки). */
export type NavBadge = 'reviews'

export interface NavTab {
  to: string
  label: string
  icon: NavIconName
  /** Активна только на своём адресе целиком (Главная), а не на вложенных. */
  end: boolean
  /** Внутренние экраны вкладки: на них она тоже подсвечивается. */
  also?: string[]
  badge?: NavBadge
}

/** Экраны студии репетитора: расписание, ученики, задания (Ф2.7, Ф2.10). */
const STUDIO_PATHS = ['/schedule', '/teacher', '/tasks']

// Четыре вкладки ученика (2026-07-21): новичок терялся между «Слова»,
// «Учёба» и «Речь». Смысловое деление: Учёба — изучаю новое (тексты, уроки
// грамматики, тест уровня), Практика — тренируюсь (повторение колоды, все
// мини-игры, речь), Диалог — общаюсь с AI.
//
// Без `also` заход в грамматику или задания гасил всю навигацию — человек
// оказывался «нигде»: ни одна вкладка не была активной. Экраны студии у
// ученика — приглашение «Ведёшь учеников?», они живут под Главной.
export const STUDENT_TABS: NavTab[] = [
  {
    to: '/',
    label: 'Главная',
    icon: 'home',
    end: true,
    also: ['/progress', '/settings', '/lessons', '/admin', '/invite', ...STUDIO_PATHS],
  },
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

// Все экраны ученика, кроме Главной и студии: у учителя их подсвечивает «Моя
// учёба». Админка и «Пригласи коллегу» — не учёба: там ни одна вкладка не горит.
const LEARNER_PATHS = STUDENT_TABS.flatMap((t) => [t.to, ...(t.also ?? [])]).filter(
  (p) => p !== '/' && p !== '/admin' && p !== '/invite' && !STUDIO_PATHS.includes(p),
)

export const TEACHER_TABS: NavTab[] = [
  { to: '/schedule', label: 'Расписание', icon: 'schedule', end: false },
  { to: '/teacher', label: 'Ученики', icon: 'students', end: false },
  { to: '/tasks', label: 'Задания', icon: 'tasks', end: false, badge: 'reviews' },
  { to: '/learn', label: 'Моя учёба', icon: 'study', end: false, also: LEARNER_PATHS },
]

/**
 * Вкладки для роли. undefined — роль ещё не знаем (первый запуск на
 * устройстве, запрос идёт): вкладок нет, а не чужое меню — иначе учитель
 * видел бы вкладки ученика, которые через миг сменятся. null — роли нет или
 * база не ответила: меню ученика, как всегда.
 */
export function tabsFor(role: string | null | undefined): NavTab[] {
  if (role === undefined) return []
  return role === 'teacher' ? TEACHER_TABS : STUDENT_TABS
}

/** Стартовый экран роли — её первая вкладка: учитель — расписание, ученик — Главная. */
export function startPath(role: string | null): string {
  return tabsFor(role)[0]?.to ?? '/'
}

/**
 * Адрес относится к разделу: тот же или вложенный — по границе сегмента.
 * Простое startsWith подсвечивало «Ученики» на лендинге /teachers.
 */
function under(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path.endsWith('/') ? path : path + '/')
}

/** Активна и на своих внутренних экранах: грамматика подсвечивает «Учёбу». */
export function isTabActive(tab: NavTab, pathname: string): boolean {
  if (tab.end ? pathname === tab.to : under(pathname, tab.to)) return true
  return (tab.also ?? []).some((p) => under(pathname, p))
}

/**
 * Индекс активной вкладки — позиция подложки. −1 (ни одна не подходит)
 * возможен на экранах вне вкладок; тогда подложку не показываем, а не
 * оставляем висеть на первой.
 */
export function activeTabIndex(tabs: NavTab[], pathname: string): number {
  return tabs.findIndex((t) => isTabActive(t, pathname))
}

/**
 * Где каркас показывает плашку «Тариф закончился — продлить» (PLAN.md Ф2.4,
 * решение владельца 03.10.2026): на стартовом экране роли и у репетитора во
 * всей студии — расписание (макет t9-3: под плашкой — «только для
 * просмотра»), ученики, задания. «Моя учёба» — без плашки. Есть ли что
 * сказать, решает сама плашка (features/billing).
 */
export function showsAccessBanner(pathname: string, role: string | null | undefined): boolean {
  if (!role) return false
  return pathname === startPath(role) || (role === 'teacher' && STUDIO_PATHS.includes(pathname))
}
