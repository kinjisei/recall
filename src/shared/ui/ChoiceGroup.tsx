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
//   cards — карточки столбиком (`.rad` макетов t5-2 и t9 — «списать или
//           нет», тарифы): кружок 22, подпись 16 полужирным, пояснение и
//           правый слот (цена); поле 14, радиус 16, черта line. Выбранная —
//           мягкий акцент и рамка цвета фокуса 2 px в обеих темах (без рамки
//           в тёмной её отличала бы только подложка), кружок — толстое кольцо
//           цвета главной кнопки;
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
  /** Вторая строка варианта (виды cards и tiles). */
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
  filled = false,
  pill = false,
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
  /** Только cards: невыбранная — на подложке поля, без черты (тарифы «Как оплатить» на компьютере, d13-3). */
  filled?: boolean
  /** Только segment: капсула (`.seg3` макетов d14, u4 — скорость озвучки, размер текста); со stretch — на всю ширину поровну. */
  pill?: boolean
  className?: string
}) {
  if (variant === 'segment') {
    return (
      <div
        role="radiogroup"
        aria-label={label}
        className={`h-11 bg-input ${pill ? 'rounded-full' : 'rounded-tile'} ${stretch ? 'flex w-full' : 'inline-flex self-start'} ${className}`}
      >
        {options.map((o) => {
          const on = o.id === value
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={`relative min-w-11 text-body tabular-nums ${pill ? 'rounded-full' : 'rounded-tile'} ${stretch ? 'flex-1' : ''} ${o.label.length > 2 ? 'px-4' : 'px-2.5'} transition-colors duration-(--dur-1) ease-out ${
                on ? 'font-semibold text-fg' : 'font-medium text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {/* «таблетка» — внутри кнопки 44, а не кнопка 38 на подложке: цель касания — вся высота */}
              {on && <span aria-hidden className={`absolute inset-0.75 bg-segment shadow-segment ${pill ? 'rounded-full' : 'rounded-tag'}`} />}
              <span className={`relative whitespace-nowrap ${o.className ?? ''}`}>{o.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  if (variant === 'tiles') {
    // две колонки — от 384 px ширины самого выбора: на телефоне «Собеседование»
    // в половину карточки не влезало; со второй строкой — всегда одна (d9-2:
    // «Task 2 · эссе · от 250 слов · 40 минут» в половину не влезает)
    const withHints = options.some((o) => o.hint)
    return (
      <div className={`@container ${className}`}>
        <div role="radiogroup" aria-label={label} className={`grid grid-cols-1 gap-2 ${withHints ? '' : '@sm:grid-cols-2'}`}>
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
                <span className="flex min-w-0 flex-col leading-snug">
                  {o.label}
                  {o.hint && <small className={`text-note font-normal ${on ? '' : 'text-fg-secondary'}`}>{o.hint}</small>}
                </span>
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
              className={`flex items-start gap-3 rounded-control p-3.5 text-left transition-colors duration-(--dur-1) ease-out ${
                on ? 'bg-accent-soft inset-ring-2 inset-ring-focus' : filled ? 'bg-input active:bg-row-press' : 'inset-ring inset-ring-line active:bg-row-press'
              }`}
            >
              {/* кружок как у плиток: выбранный — толстое кольцо цвета главной кнопки */}
              <span aria-hidden className={`mt-px size-5.5 flex-none rounded-full bg-surface ${on ? 'inset-ring-6 inset-ring-primary' : 'inset-ring-2 inset-ring-fg-faint'}`} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-base font-semibold ${on ? 'text-accent-soft-fg' : 'text-fg'} ${o.className ?? ''}`}>{o.label}</span>
                {o.hint && <span className={`mt-0.5 text-note ${on ? 'text-accent-soft-fg' : 'text-fg-secondary'}`}>{o.hint}</span>}
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
