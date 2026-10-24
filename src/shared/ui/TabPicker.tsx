// ============================================================================
// Единый сегмент-переключатель «выбери один из N» вместо копий по экранам.
// Активный вариант везде — акцент (`accent-soft` / `accent-soft-fg`); отличались только
// форма и hover. Два варианта формы:
//   tabs    — строка кнопок rounded-tag (грамматика, глаголы, читалки) — дефолт;
//   segment — капсула rounded-full с фоном-контейнером (Диалог: Чат/Письмо);
//             `square` — прямоугольником: дорожка 12, плашка 8 («День / Неделя»
//             расписания на компьютере, макет d1);
//             `stretch` — поровну на всю ширину, поля 8, а не 16: ячейки и так
//             делят ширину. Поровну, пока слова влезают; не влезает — вкладка
//             не уже своего слова (min-w-min), остальные делят остаток
//             («Индивидуальный» на 390 — ~131 / 110 / 110; решение владельца
//             20.10.2026: раньше слово вылезало за капсулу). `small` — длинные подписи 14 (`.seg2` макетов t5-2
//             и d2-2: «Только этот урок / Этот и все следующие» — при 15 на 390
//             вторая переносилась на две строки; на 320 перенос остаётся —
//             лучше двух строк, чем подписи за краем капсулы);
//   line    — вкладки с подчёркиванием 2 px цветом фокуса (разделы карточки
//             ученика, макет d10-2): строка не переносится, лишнее — прокруткой
//             вбок; `trailing` — справа в той же строке («Отчёт ↗»).
// (Выбор значения — уровень, скорость, размер текста в «Настройках» — это не
//  вкладки, а ChoiceGroup: radiogroup, rounded-tile, размер шрифта в самих
//  кнопках.)
// ============================================================================
import type React from 'react'

export interface TabOption<T extends string> {
  id: T
  label: string
  Icon?: (p: { size?: number; className?: string }) => React.JSX.Element
}

export function TabPicker<T extends string>({
  options,
  value,
  onChange,
  variant = 'tabs',
  ariaLabel,
  stretch = false,
  small = false,
  square = false,
  trailing,
  iconsWide = false,
  className = '',
}: {
  options: TabOption<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'tabs' | 'segment' | 'line'
  ariaLabel?: string
  /** Варианты делят ширину поровну: «День / Неделя», «Индивидуальный / Группа / Пробный». */
  stretch?: boolean
  /** Только segment: подписи 14 — длинные варианты («Этот и все следующие»). */
  small?: boolean
  /** Только segment: прямоугольник вместо капсулы (d1). */
  square?: boolean
  /** Только line: элемент справа в строке вкладок. */
  trailing?: React.ReactNode
  /**
   * Только line: значки вкладок — лишь когда контейнеру (`@container` выше)
   * хватает 672 px: раздел карточки ученика на 1440 со значками, на 1280 без
   * (d11-3 и d11-1).
   */
  iconsWide?: boolean
  className?: string
}) {
  if (variant === 'line') {
    return (
      <div className={`flex items-end gap-0.5 overflow-x-auto scrollbar-none ${className}`}>
        <div role="tablist" aria-label={ariaLabel} className="flex flex-none gap-0.5">
          {options.map((o) => {
            const isActive = o.id === value
            return (
              <button
                key={o.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(o.id)}
                className={`relative flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-t-tag px-2.5 text-body transition-colors duration-(--dur-1) ${
                  isActive ? 'font-semibold text-accent-soft-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-focus' : 'font-medium text-fg-secondary hover:text-fg'
                }`}
              >
                {o.Icon && <o.Icon size={iconsWide ? 18 : 16} className={iconsWide ? `hidden @2xl:block ${isActive ? 'text-accent-strong' : 'text-fg-muted'}` : undefined} />}
                {o.label}
              </button>
            )
          })}
        </div>
        {trailing && <div className="ml-auto flex flex-none">{trailing}</div>}
      </div>
    )
  }
  const segment = variant === 'segment'
  // tabs: обводка ring-control-line — граница элемента в обеих темах (лист
  // s2): подложка на белом теряется. ring, а не border — рамка сдвинула бы ряд.
  const container = segment
    ? `${stretch ? 'flex' : 'inline-flex'} ${square ? 'rounded-tile' : 'rounded-full'} bg-input`
    : 'flex flex-wrap gap-2'
  const inactive = segment
    ? 'font-medium text-fg-muted hover:text-fg-secondary'
    : 'bg-tint/[0.07] font-semibold text-fg-secondary ring-1 ring-control-line hover:text-fg'
  const active = segment
    ? 'font-semibold text-fg'
    : 'bg-accent-soft font-semibold text-accent-soft-fg ring-2 ring-control-line-active'

  return (
    <div role="tablist" aria-label={ariaLabel} className={`${container} ${className}`}>
      {options.map((o) => {
        const isActive = o.id === value
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(o.id)}
            className={`relative flex min-h-11 items-center justify-center gap-1.5 transition-colors duration-(--dur-1) ease-out ${stretch ? 'min-w-min flex-1 px-2' : 'px-4'} ${
              segment ? `${stretch ? '' : 'min-w-27.5'} ${square ? 'rounded-tile' : 'rounded-full'} ${small ? 'text-sm' : 'text-body'}` : 'rounded-tag text-sm'
            } ${isActive ? active : inactive}`}
          >
            {segment && isActive && <span aria-hidden className={`absolute inset-0.75 ${square ? 'rounded-tag' : 'rounded-full'} bg-segment shadow-segment`} />}
            {o.Icon && <o.Icon size={segment ? 18 : 16} className="relative" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
