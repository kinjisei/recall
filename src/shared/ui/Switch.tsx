// ============================================================================
// Тумблер «вкл / выкл» (опись интерфейса §6.1; макет t3 — «Повторять», дальше
// u4 — «Напоминать о скором уроке»). Вся строка нажимается, а не только
// ползунок: палец попадает в подпись чаще, чем в 48 px дорожки.
// role="switch" — скринридер говорит «включено / выключено», а не «флажок».
// ============================================================================
import type { ReactNode } from 'react'

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  className = '',
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  /** Вторая строка под подписью: «Не повторяется — разовый урок». */
  hint?: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex min-h-11 w-full items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-fg">{label}</span>
        {hint && <span className="text-note text-fg-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-tint/[0.16] ring-1 ring-control-line'
        }`}
      >
        <span
          className={`size-6 rounded-full shadow-card transition-transform duration-200 motion-reduce:transition-none ${
            checked ? 'translate-x-5 bg-accent-fg' : 'translate-x-0 bg-fg-muted'
          }`}
        />
      </span>
    </button>
  )
}
