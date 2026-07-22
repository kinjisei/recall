// ============================================================================
// Нижняя навигация «Nocturne»: плавающая glass-капсула с четырьмя постоянными
// вкладками. Активная — мягкая акцентная подсветка и залитая (fill) иконка.
//
// Четыре вкладки вместо пяти (2026-07-21): новичок терялся между «Слова»,
// «Учёба» и «Речь». Теперь смысловое деление: Учёба — изучаю новое (тексты,
// уроки грамматики, тест уровня), Практика — тренируюсь (повторение колоды,
// все мини-игры, речь), Диалог — общаюсь с AI.
// ============================================================================
import { Link, useLocation } from 'react-router-dom'
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
  { to: '/', label: 'Главная', Icon: IconHome, IconFill: IconHomeFill, end: true, also: ['/progress', '/settings', '/teacher'] },
  {
    to: '/study',
    label: 'Учёба',
    Icon: IconStudy,
    IconFill: IconStudyFill,
    end: false,
    also: ['/grammar', '/placement', '/assignments', '/reader'],
  },
  {
    to: '/practice',
    label: 'Практика',
    Icon: IconPractice,
    IconFill: IconPracticeFill,
    end: false,
    also: ['/flashcards', '/pronunciation'],
  },
  { to: '/conversation', label: 'Диалог', Icon: IconDialog, IconFill: IconDialogFill, end: false },
]

export function BottomNav() {
  const { pathname } = useLocation()
  // при открытой клавиатуре навигацию прячем: на телефонах фиксированная
  // капсула иначе «всплывает» над клавиатурой и мешает набору
  const kb = useKeyboardInset()
  if (kb > 0) return null

  return (
    <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto max-w-screen-sm rounded-3xl border border-white/10 bg-[rgba(22,24,38,.78)] backdrop-blur-xl mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-1.5 py-1.5">
        {tabs.map(({ to, label, Icon, IconFill, end, also }) => {
          // активна и на своих внутренних экранах (грамматика → «Учёба»)
          const active =
            (end ? pathname === to : pathname.startsWith(to)) ||
            (also ?? []).some((p) => pathname.startsWith(p))
          const TabIcon = active ? IconFill : Icon
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 text-[11px] font-medium transition-[background-color,color] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] ${
                active
                  ? 'bg-[rgba(145,132,217,.16)] text-[var(--night-accent-100)]'
                  : 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
              }`}
            >
              <TabIcon size={22} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
