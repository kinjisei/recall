// ============================================================================
// Единый сегмент-переключатель «выбери один из N» вместо копий по экранам.
// Активный вариант везде — акцент (`accent-soft` / `accent-soft-fg`); отличались только
// форма и hover. Два варианта формы:
//   tabs    — строка кнопок rounded-lg (грамматика, глаголы, читалки) — дефолт;
//   segment — капсула rounded-full с фоном-контейнером (Диалог: Чат/Письмо);
//             `stretch` — поровну на всю ширину, поля 8, а не 16: ячейки и так
//             делят ширину; `small` — длинные подписи 14 (`.seg2` макетов t5-2
//             и d2-2: «Только этот урок / Этот и все следующие» — при 15 на 390
//             вторая переносилась на две строки; на 320 перенос остаётся —
//             лучше двух строк, чем подписи за краем капсулы);
//   line    — вкладки с подчёркиванием 2 px цветом фокуса (разделы карточки
//             ученика, макет d10-2): строка не переносится, лишнее — прокруткой
//             вбок; `trailing` — справа в той же строке («Отчёт ↗»).
// (Выбор значения — уровень, скорость, размер текста в «Настройках» — это не
//  вкладки, а ChoiceGroup: radiogroup, rounded-xl, размер шрифта в самих
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
  trailing,
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
  /** Только line: элемент справа в строке вкладок. */
  trailing?: React.ReactNode
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
                className={`relative flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-t-lg px-2.5 text-body transition-colors duration-(--dur-1) ${
                  isActive ? 'font-semibold text-accent-soft-fg after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-focus' : 'font-medium text-fg-secondary hover:text-fg'
                }`}
              >
                {o.Icon && <o.Icon size={16} />}
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
    ? `${stretch ? 'flex' : 'inline-flex'} rounded-full bg-input`
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
            className={`relative flex min-h-11 items-center justify-center gap-1.5 transition-colors duration-(--dur-1) ease-out ${stretch ? 'flex-1 px-2' : 'px-4'} ${
              segment ? `min-w-27.5 rounded-full ${small ? 'text-sm' : 'text-body'}` : 'rounded-lg text-sm'
            } ${isActive ? active : inactive}`}
          >
            {segment && isActive && <span aria-hidden className="absolute inset-0.75 rounded-full bg-segment shadow-segment" />}
            {o.Icon && <o.Icon size={segment ? 18 : 16} className="relative" />}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
