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
import { IconBack } from './icons'
import { takeMorphName } from '../lib/morph'

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
      className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-tint/[0.12] text-fg-secondary transition-colors hover:border-tint/[0.25] hover:text-fg active:scale-95"
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
