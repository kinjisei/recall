// ============================================================================
// Выбор одного варианта из нескольких, все видны сразу: уровень, скорость
// озвучки, размер текста в Настройках, тариф на «Как оплатить». Семантика —
// radiogroup: скринридер говорит «выбрано», а не «вкладка» (вкладки — TabPicker).
//
// Два вида:
//   chips — чипы листа s3 («Длительность»): высота 44, радиус полный, рамка
//           control-line (граница элемента ≥ 3:1 в обеих темах); выбранный
//           отличается не только цветом — галочка, рамка accent и мягкая
//           подложка; нажатый — дымка; выключенный — рамка line, текст
//           fg-faint. Рамка — ring, а не border: border прибавил бы чипу 2 px
//           и сдвинул ряд уровней;
//   cards — карточки столбиком: кружок выбора, подпись, пояснение и правый
//           слот (цена). Выбор, где у варианта есть что объяснить (макет t9,
//           тарифы). Выбранная обведена акцентом в обеих темах: без рамки в
//           тёмной теме её отличала бы только подложка;
//   segment — короткие варианты одной полосой на подложке поля (язык и
//           уровень квеста, макет d10-4): высота 44, радиус 12, выбранный —
//           белая «таблетка» с тенью сегмента и жирным текстом; подпись в
//           два знака («B1») — кнопка уже, но не меньше 44;
//   tiles   — плитки на подложке поля внутри карточки (сценарий квеста,
//           d10-4): кружок выбора и подпись; выбранная — мягкий акцент с
//           рамкой цвета фокуса; две колонки — от 384 px ширины выбора.
// ============================================================================
import type { ReactNode } from 'react'
import { IconCheck } from './icons'

export interface ChoiceOption<T extends string> {
  id: T
  label: string
  /** Классы подписи варианта (напр. размер шрифта у «Текст в чтении»). */
  className?: string
  /** Вторая строка карточки (только вид cards). */
  hint?: string
  /** Правый слот карточки — цена, счётчик (только вид cards). */
  trailing?: ReactNode
  /** Вариант виден, но не выбирается (только вид chips). */
  disabled?: boolean
}

export function ChoiceGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  stretch = false,
  variant = 'chips',
  className = '',
}: {
  options: ChoiceOption<T>[]
  value: T | null
  onChange: (id: T) => void
  /** Что выбираем — для скринридера. */
  label: string
  /** Варианты делят ширину поровну (скорость, размер); иначе — по содержимому. */
  stretch?: boolean
  variant?: 'chips' | 'cards' | 'segment' | 'tiles'
  className?: string
}) {
  if (variant === 'segment') {
    return (
      <div role="radiogroup" aria-label={label} className={`inline-flex h-11 self-start rounded-xl bg-input ${className}`}>
        {options.map((o) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`relative min-w-11 rounded-xl text-body tabular-nums ${o.label.length > 2 ? 'px-4' : 'px-2.5'} transition-colors duration-(--dur-1) ease-out ${
                on ? 'font-semibold text-fg' : 'font-medium text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {/* «таблетка» — внутри кнопки 44, а не кнопка 38 на подложке: цель касания — вся высота */}
              {on && <span aria-hidden className="absolute inset-0.75 rounded-lg bg-segment shadow-segment" />}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (variant === 'tiles') {
    // две колонки — от 384 px ширины самого выбора: на телефоне «Собеседование»
    // в половину карточки не влезало
    return (
      <div className={`@container ${className}`}>
        <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 @sm:grid-cols-2">
          {options.map((o) => {
            const on = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(o.id)}
                className={`flex min-h-11 items-center gap-3 rounded-control-sm px-3.5 py-2 text-left text-body font-semibold transition-colors ${
                  on ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : 'bg-input text-fg active:bg-ghost-press'
                } ${o.className ?? ''}`}
              >
                <span aria-hidden className={`size-5 flex-none rounded-full bg-surface ${on ? 'inset-ring-6 inset-ring-primary' : 'inset-ring-2 inset-ring-fg-faint'}`} />
                <span className="min-w-0">{o.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (variant === 'cards') {
    return (
      <div role="radiogroup" aria-label={label} className={`flex flex-col gap-2 ${className}`}>
        {options.map((o) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-card transition-colors ${
                on ? 'border-accent-line bg-accent-soft' : 'border-tint/[0.08] bg-surface hover:bg-tint/[0.04]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                  on ? 'border-accent' : 'border-fg-faint'
                }`}
              >
                {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`font-medium ${on ? 'text-accent-soft-fg' : 'text-fg'} ${o.className ?? ''}`}>{o.label}</span>
                {o.hint && <span className="text-note text-fg-muted">{o.hint}</span>}
              </span>
              {o.trailing && <span className="flex-none text-right">{o.trailing}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-2 ${stretch ? '' : 'flex-wrap'} ${className}`}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.id)}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full font-medium tabular-nums transition-colors duration-(--dur-1) ease-out ${
              stretch ? 'flex-1 px-3' : on ? 'pl-3 pr-4' : 'px-4'
            } ${o.className ?? 'text-body'} ${
              on
                ? 'bg-accent-soft text-accent-soft-fg ring-1 ring-accent'
                : o.disabled
                  ? 'cursor-not-allowed text-fg-faint ring-1 ring-line'
                  : 'text-fg ring-1 ring-control-line active:bg-ghost-press data-press:bg-ghost-press'
            }`}
          >
            {on && <IconCheck size={18} className="flex-none" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
