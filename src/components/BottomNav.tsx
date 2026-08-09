// ============================================================================
// Нижняя навигация «Nocturne»: плавающая glass-капсула с четырьмя постоянными
// вкладками. Активная — мягкая акцентная подсветка и залитая (fill) иконка.
//
// Четыре вкладки вместо пяти (2026-07-21): новичок терялся между «Слова»,
// «Учёба» и «Речь». Теперь смысловое деление: Учёба — изучаю новое (тексты,
// уроки грамматики, тест уровня), Практика — тренируюсь (повторение колоды,
// все мини-игры, речь), Диалог — общаюсь с AI.
// ============================================================================
import { useLocation } from 'react-router-dom'
import { AppLink } from './AppLink'
import { useKeyboardInset } from '../lib/useKeyboardInset'
import {
  IconHome,
  IconHomeFill,
  IconStudy,
  IconStudyFill,
  IconPractice,
  IconPracticeFill,
  IconDialog,
  IconDialogFill,
  type IconProps,
} from './icons'

type IconCmp = (p: IconProps) => React.JSX.Element

interface Tab {
  to: string
  label: string
  Icon: IconCmp
  /** Залитый вариант для активной вкладки. */
  IconFill: IconCmp
  end: boolean
  /** Внутренние экраны вкладки: на них она тоже должна подсвечиваться. */
  also?: string[]
}

// Без `also` заход в грамматику или задания гасил всю навигацию — пользователь
// оказывался «нигде»: ни одна вкладка не была активной.
const tabs: Tab[] = [
  { to: '/', label: 'Главная', Icon: IconHome, IconFill: IconHomeFill, end: true, also: ['/progress', '/settings', '/teacher', '/admin'] },
  {
    to: '/study',
    label: 'Учёба',
    Icon: IconStudy,
    IconFill: IconStudyFill,
    end: false,
    also: ['/grammar', '/placement', '/assignments', '/program', '/quests'],
  },
  {
    to: '/practice',
    label: 'Практика',
    Icon: IconPractice,
    IconFill: IconPracticeFill,
    end: false,
    also: ['/pronunciation'],
  },
  { to: '/conversation', label: 'Диалог', Icon: IconDialog, IconFill: IconDialogFill, end: false },
]

/** Активна и на своих внутренних экранах: грамматика подсвечивает «Учёбу». */
function isActive(tab: Tab, pathname: string): boolean {
  if (tab.end ? pathname === tab.to : pathname.startsWith(tab.to)) return true
  return (tab.also ?? []).some((p) => pathname.startsWith(p))
}

export function BottomNav() {
  const { pathname } = useLocation()
  // при открытой клавиатуре навигацию прячем: на телефонах фиксированная
  // капсула иначе «всплывает» над клавиатурой и мешает набору
  const kb = useKeyboardInset()
  if (kb > 0) return null

  // Индекс активной вкладки — позиция подложки. −1 (ни одна не подходит)
  // возможен на экранах вне вкладок; тогда подложку просто не показываем,
  // а не оставляем её висеть на первой.
  const activeIndex = tabs.findIndex((t) => isActive(t, pathname))

  return (
    // vt-nav — навигация выпадает из перехода между экранами и остаётся на
    // месте, пока экран под ней меняется (см. index.css)
    <nav className="vt-nav fixed inset-x-4 bottom-4 z-30 mx-auto max-w-screen-sm rounded-3xl border border-white/10 bg-[rgba(22,24,38,.78)] backdrop-blur-xl mb-[env(safe-area-inset-bottom)]">
      <div className="relative flex items-stretch justify-around px-1.5 py-1.5">
        {/* Скользящая подложка активной вкладки. Раньше подсветка была фоном
            самой ссылки и просто перепрыгивала — глаз терял, откуда и куда он
            перешёл. Отдельный элемент едет на transform, то есть без пересчёта
            раскладки. Вкладки одинаковой ширины (flex-1), поэтому позиция —
            это просто «сдвинуть на свою ширину столько раз, каков индекс». */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-2xl bg-[rgba(145,132,217,.16)] transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
          style={{
            width: `calc((100% - 0.75rem) / ${tabs.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {tabs.map(({ to, label, Icon, IconFill }, i) => {
          const active = i === activeIndex
          const TabIcon = active ? IconFill : Icon
          return (
            <AppLink
              key={to}
              to={to}
              // экран едет в ту сторону, в какую человек двигается по вкладкам:
              // вправо по ряду — контент приезжает справа, и наоборот
              direction={activeIndex >= 0 && i < activeIndex ? 'out' : 'in'}
              onClick={() => {
                // повторный тап по активной вкладке, когда мы уже на её роуте
                // (напр. /study с внутренним экраном «Мои слова»): ссылка ведёт
                // «в никуда», поэтому шлём событие — экран сам сбросится к хабу.
                if (pathname === to) {
                  window.dispatchEvent(new CustomEvent('recall:reset-tab', { detail: to }))
                }
              }}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition-colors duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                active
                  ? 'text-[var(--night-accent-100)]'
                  : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
              }`}
            >
              <TabIcon
                size={22}
                className={`transition-transform duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                  active ? '-translate-y-0.5' : ''
                }`}
              />
              <span>{label}</span>
            </AppLink>
          )
        })}
      </div>
    </nav>
  )
}
