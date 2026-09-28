// ============================================================================
// Единый сегмент-переключатель «выбери один из N» вместо копий по экранам.
// Активный вариант везде — акцент (`accent-soft` / `accent-soft-fg`); отличались только
// форма и hover. Два варианта формы:
//   tabs    — строка кнопок rounded-lg (грамматика, глаголы, читалки) — дефолт;
//   segment — капсула rounded-full с фоном-контейнером (Диалог: Чат/Письмо).
// (Чип-переключатели в «Настройках» — отдельный паттерн: rounded-xl во всю
//  ширину + размер шрифта в самих кнопках; сюда не сводятся.)
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
  className = '',
}: {
  options: TabOption<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'tabs' | 'segment'
  ariaLabel?: string
  className?: string
}) {
  const segment = variant === 'segment'
  const container = segment
    ? 'inline-flex gap-0.5 rounded-full bg-tint/[0.07] p-0.5'
    : 'flex flex-wrap gap-2'
  // неактивный: у капсулы фон даёт контейнер (кнопка прозрачная), у tabs —
  // своя подложка. hover добавлен ко всем (раньше был только у капсулы).
  const inactive = segment
    ? 'text-fg-muted hover:text-fg-secondary'
    : 'bg-tint/[0.07] text-fg-secondary hover:text-fg'

  return (
    <div role="tablist" aria-label={ariaLabel} className={`${container} ${className}`}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`flex min-h-11 items-center justify-center gap-1.5 px-4 font-semibold transition-colors ${
              segment ? 'rounded-full text-xs' : 'rounded-lg text-sm'
            } ${active ? 'bg-accent-soft text-accent-soft-fg' : inactive}`}
          >
            {o.Icon && <o.Icon size={segment ? 14 : 16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
