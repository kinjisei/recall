// ============================================================================
// Единый сегмент-переключатель «выбери один из N» вместо копий по экранам.
// Активный вариант везде — акцент (`--night-accent-900/100`); отличались только
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
    ? 'inline-flex gap-0.5 rounded-full bg-white/[0.07] p-0.5'
    : 'flex flex-wrap gap-2'
  // неактивный: у капсулы фон даёт контейнер (кнопка прозрачная), у tabs —
  // своя подложка. hover добавлен ко всем (раньше был только у капсулы).
  const inactive = segment
    ? 'text-[var(--night-text-40)] hover:text-[var(--night-text-70)]'
    : 'bg-white/[0.07] text-[var(--night-text-70)] hover:text-[var(--night-text)]'

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
            className={`flex min-h-[44px] items-center justify-center gap-1.5 px-4 font-semibold transition-colors ${
              segment ? 'rounded-full text-xs' : 'rounded-lg text-sm'
            } ${active ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]' : inactive}`}
          >
            {o.Icon && <o.Icon size={segment ? 14 : 16} />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
