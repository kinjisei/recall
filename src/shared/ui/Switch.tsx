// ============================================================================
// Тумблер «вкл / выкл» (лист s3; макеты t3 — «Повторять», u4 — «Напоминать о
// скором уроке»). Включает настройку сразу, без «Сохранить»; главный сигнал —
// положение ручки, а не только цвет. Дорожка 52 × 32: включён — цвет главной
// кнопки, выключен — подложка input с рамкой control-line; ручка 26, белая.
// Вся строка нажимается, а не только ползунок: палец попадает в подпись чаще.
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
      className={`flex min-h-13 w-full items-center gap-3 text-left disabled:cursor-not-allowed ${className}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-body ${disabled ? 'text-fg-faint' : 'text-fg'}`}>{label}</span>
        {hint && <span className="text-note text-fg-muted">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={`relative h-8 w-13 flex-none rounded-full border transition-colors duration-200 ${
          checked ? 'border-primary bg-primary' : 'border-control-line bg-input'
        } ${disabled ? 'opacity-45' : ''}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-6.5 rounded-full bg-knob shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
