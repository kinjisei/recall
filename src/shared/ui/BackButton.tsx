// ============================================================================
// Единая кнопка «Назад» (по макету «Nocturne»): компактный квадрат с тонкой
// рамкой и стрелкой-кареткой, стоит СЛЕВА от заголовка в одной строке.
// Заменяет разнобой из «← Назад» / «← Главная» / ghost-кнопок, из-за которого
// заголовки съезжали, а сама кнопка терялась.
//
// ОДНА на всё приложение (архитектура §3; PLAN.md Ф1.4). Раньше их было пять:
// эта, отдельная SmartBack для страниц вне каркаса, круглая без рамки в
// Настройках/Прогрессе/«Материале под себя» и текстовая «← На главную» в
// тесте уровня. Режима два:
//   onClick  — экран сам знает, куда назад (внутренний подэкран, адрес ?x=);
//   fallback — «туда, откуда пришёл»: история SPA, а при прямом заходе или
//              перезагрузке — на fallback. Для страниц, куда попадают с
//              разных мест (тарифы, оферта, Настройки, Прогресс).
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconChevronLeft } from './icons'
import { takeMorphName } from '../lib/morph'
import { useShellUp } from '../lib/shellUp'

/**
 * Возврат «откуда пришёл», а при прямом заходе/перезагрузке (idx === 0) — на
 * fallback. Голый navigate(-1) на таких страницах выкидывал из приложения, а
 * жёсткая ссылка устраивала кольца (настройки → тарифы → «назад» → настройки…).
 */
export function useSmartBack(fallback: string) {
  const navigate = useNavigate()
  return () => {
    // react-router кладёт idx в history.state: >0 — есть куда вернуться внутри SPA
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback)
  }
}

type BackTarget =
  /** Куда назад, решает экран. */
  | { onClick: () => void; fallback?: never }
  /** Назад по истории, при прямом заходе — сюда. */
  | { fallback: string; onClick?: never }

export function BackButton({ label = 'Назад', ...target }: BackTarget & { label?: string }) {
  const smart = useSmartBack(target.fallback ?? '/')
  return (
    <button
      type="button"
      onClick={target.onClick ?? smart}
      aria-label={label}
      className="flex h-11 w-11 flex-none items-center justify-center rounded-tile border border-tint/[0.12] text-fg-secondary transition-colors hover:border-tint/[0.25] hover:text-fg active:scale-95"
    >
      <IconBack size={18} />
    </button>
  )
}

/** Строка «назад + заголовок» — самый частый случай использования. */
export function BackHeader({
  onBack,
  title,
  label,
  trailing,
  /**
   * Принять превращение из нажатой плитки (см. shared/lib/morph.ts): заголовок и
   * плитка становятся одним элементом, и переход показывает, как одно выросло
   * из другого. Ставится только там, откуда РЕАЛЬНО пришли по плитке.
   */
  morph = false,
}: {
  onBack: () => void
  title: string
  label?: string
  trailing?: React.ReactNode
  morph?: boolean
}) {
  // takeMorphName забирает имя один раз — при первом рендере экрана
  const [morphName] = useState(() => (morph ? takeMorphName() : null))
  return (
    <div
      className="flex items-center gap-3"
      style={morphName ? { viewTransitionName: morphName } : undefined}
    >
      <BackButton onClick={onBack} label={label} />
      <h1 className="min-w-0 flex-1 truncate text-xl font-medium tracking-tight">{title}</h1>
      {trailing}
    </div>
  )
}

/**
 * «Назад» ссылкой — «‹ Задания», «‹ Материалы» (макеты d7–d9, раздел карточки
 * ученика d10-2): шеврон и куда, цветом ссылки. Тот же «назад», что
 * `BackButton`, только видом: в строке с длинным заголовком квадрат не
 * говорит, куда ведёт. `children` — своя подпись (аватар с именем),
 * `label` — тогда для читалки.
 */
export function BackLink({
  label,
  children,
  data,
  ...target
}: BackTarget & {
  label: string
  children?: React.ReactNode
  /** Признак для смоуков (`data-section-back`). */
  data?: Record<`data-${string}`, string>
}) {
  const smart = useSmartBack(target.fallback ?? '/')
  // своя подпись (аватар с именем) сжимается вместе со строкой; слово — нет
  const fit = children ? 'gap-2 pl-1 pr-2' : 'flex-none gap-0.5 pl-0.5 pr-2.5'
  return (
    <button
      type="button"
      onClick={target.onClick ?? smart}
      aria-label={children ? label : undefined}
      {...data}
      className={`-ml-1 flex min-h-11 min-w-0 items-center rounded-control-sm text-body font-medium text-accent-strong active:bg-ghost-press ${fit}`}
    >
      <IconChevronLeft size={20} aria-hidden className="flex-none" />
      {children ?? <span className="truncate">{label}</span>}
    </button>
  )
}

/**
 * Шапка внутреннего экрана (макеты d7–d9 `.d7top`, `.t8`): «‹ Задания»,
 * заголовок, справа — своё (листалка «Работа 2 из 2 ‹ ›», главная кнопка).
 * Раздел без подписи — заголовок 24 («‹ Задания  Материалы», d8-1), экран
 * чего-то одного с подписью — 20 («Әсел Жұмабаева · «My morning»» и «задание
 * по материалу · вчера», d7-2). Уже 672 правое уходит под заголовок.
 */
export function ScreenTop({
  back,
  title,
  subtitle,
  trailing,
}: {
  back: { label: string; onClick: () => void }
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="@container flex flex-col gap-2">
      <div className="flex min-h-11 items-center gap-3">
        <BackLink onClick={back.onClick} label={back.label} />
        <header className="flex min-w-0 flex-1 flex-col leading-tight">
          {/* узко — в две строки, а не «Айгерим Нурланова · IE…» */}
          <h1 className={`${subtitle ? 'text-xl' : 'text-2xl tracking-tight'} font-semibold text-balance text-fg @2xl:truncate`}>{title}</h1>
          {subtitle && <span className="truncate text-note text-fg-muted">{subtitle}</span>}
        </header>
        {trailing && <div className="hidden flex-none @2xl:block">{trailing}</div>}
      </div>
      {trailing && <div className="flex justify-end @2xl:hidden">{trailing}</div>}
    </div>
  )
}

/**
 * Заголовок хаба ученика — «Учёба», «Практика», «Диалог» (PLAN.md Ф2.18).
 * Ученику это вкладка меню, и «назад» нет — разметка до символа прежняя.
 * Учителю — экран внутри «Моей учёбы»: каркас говорит куда (shared/lib/
 * shellUp), и слева встаёт «назад». Переходом, а не шагом по истории: из
 * «Речи» и «Письма» в хаб тоже ведёт переход, и шаг назад вернул бы туда.
 */
export function TabHeading({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  const { tab } = useShellUp()
  const navigate = useNavigate()
  const h1 = <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
  const heading = subtitle ? (
    <header className="min-w-0">
      {h1}
      {subtitle}
    </header>
  ) : (
    h1
  )
  if (!tab) return heading
  return (
    <div className="flex items-center gap-3">
      <BackButton onClick={() => navigate(tab.to)} label={tab.label} />
      {heading}
    </div>
  )
}
