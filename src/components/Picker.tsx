// ============================================================================
// Пикер-снизу: замена нативному <select>, который на Android рисует своё серое
// системное окно, не знающее про тёмную тему. Триггер выглядит как поле, тап по
// нему открывает тёмный список ВНУТРИ приложения (шторка снизу, поверх Sheet).
//
// ⚠️ Только для выбора из МНОГИХ вариантов. Для двух (язык EN/ES) шторка снизу
// избыточна — там сегмент (TabPicker). Это граница, а не вкусовщина: выезжающий
// список из двух пунктов дороже нажатия, чем сегмент, где оба видны сразу.
//
// Список — role=listbox/option, триггер — aria-haspopup: скринридер понимает,
// что это выбор, а не просто кнопка.
// ============================================================================
import { useState } from 'react'
import { IconCaretDown, IconCheck } from './icons'
import { Sheet } from './Sheet'

export interface PickerOption<T extends string> {
  id: T
  label: string
  /** Вторая строка под названием — необязательно (напр. пояснение уровня). */
  hint?: string
}

const TRIGGER =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-left text-sm outline-none focus:border-[var(--night-accent-45)] disabled:opacity-60'

export function Picker<T extends string>({
  value,
  options,
  onChange,
  label,
  triggerClassName = TRIGGER,
  disabled = false,
}: {
  value: T
  options: PickerOption<T>[]
  onChange: (id: T) => void
  /** Заголовок шторки и подпись для скринридера — что выбираем. */
  label: string
  /** Классы триггера — чтобы совпасть со стилем полей на конкретном экране. */
  triggerClassName?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.id === value)

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={triggerClassName}
      >
        <span className="min-w-0 truncate">{current?.label ?? '—'}</span>
        <IconCaretDown size={16} className="flex-none text-[var(--night-text-40)]" />
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)} label={label} maxH="70dvh">
          <p className="px-5 pb-2 pt-1 text-sm font-medium">{label}</p>
          <ul role="listbox" aria-label={label} className="overflow-y-auto px-2 pb-2">
            {options.map((o) => {
              const active = o.id === value
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(o.id)
                      setOpen(false)
                    }}
                    className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                      active
                        ? 'bg-[var(--night-accent-900)] text-[var(--night-accent-100)]'
                        : 'text-[var(--night-text)] hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="min-w-0">
                      {o.label}
                      {o.hint && (
                        <span className="block text-xs text-[var(--night-text-40)]">{o.hint}</span>
                      )}
                    </span>
                    {active && <IconCheck size={16} className="flex-none" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </Sheet>
      )}
    </>
  )
}
