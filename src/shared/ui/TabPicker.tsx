// ============================================================================
// Единый сегмент-переключатель «выбери один из N» вместо копий по экранам.
// Активный вариант везде — акцент (`accent-soft` / `accent-soft-fg`); отличались только
// форма и hover. Два варианта формы:
//   tabs    — строка кнопок rounded-lg (грамматика, глаголы, читалки) — дефолт;
//   segment — капсула rounded-full с фоном-контейнером (Диалог: Чат/Письмо).
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
  className = '',
}: {
  options: TabOption<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'tabs' | 'segment'
  ariaLabel?: string
  /** Варианты делят ширину поровну: «День / Неделя», «Индивидуальный / Группа / Пробный». */
  stretch?: boolean
  className?: string
}) {
  const segment = variant === 'segment'
  // Обводка ring-control-line видна только в светлой теме (в тёмной она
  // прозрачная): подложка на белом теряется. ring, а не border — рамка
  // сдвинула бы ряд вкладок (как в ChoiceGroup).
  const container = segment
    ? `${stretch ? 'flex' : 'inline-flex'} gap-0.5 rounded-full bg-tint/[0.07] p-0.5 ring-1 ring-control-line`
    : 'flex flex-wrap gap-2'
  // неактивный: у капсулы фон даёт контейнер (кнопка прозрачная), у tabs —
  // своя подложка. hover добавлен ко всем (раньше был только у капсулы).
  const inactive = segment
    ? 'text-fg-muted hover:text-fg-secondary'
    : 'bg-tint/[0.07] text-fg-secondary ring-1 ring-control-line hover:text-fg'
  // выбранная вкладка в светлой теме обведена акцентом, выбранная капсула —
  // приподнята тенью; в тёмной — как было
  const active = segment
    ? 'bg-accent-soft text-accent-soft-fg shadow-card'
    : 'bg-accent-soft text-accent-soft-fg ring-2 ring-control-line-active'

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
            className={`flex min-h-11 items-center justify-center gap-1.5 px-4 font-semibold transition-colors ${stretch ? 'flex-1' : ''} ${
              segment ? 'rounded-full text-xs' : 'rounded-lg text-sm'
            } ${isActive ? active : inactive}`}
          >
            {o.Icon && <o.Icon size={segment ? 14 : 16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
