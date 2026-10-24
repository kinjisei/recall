// Куски онбординга репетитора (макет t10): полоски шагов, вопрос, вариант
// ответа, «Назад» компьютера и чипы «Откуда ты о нас знаешь?». Размеры — из
// кадров макета; цвета — токенами (новая палитра придёт с Ф2.17).
import type { ReactNode } from 'react'
import { setSelfReportedSource } from '../../../lib/analytics'
import { BackLink } from '../../../shared/ui/BackButton'
import { IconCheck } from '../../../shared/ui/icons'

/**
 * Полоски шагов без текста (журнал п.71): заполнены отвеченные. Сегмент
 * заполняется слева направо за 320 мс; «Назад» — пустеет так же. При
 * «Уменьшить движение» переход гасит общее правило index.css — сразу полный.
 */
export function StepBars({ filled, step }: { filled: number; step: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={step + 1}
      aria-label={`Шаг ${step + 1} из 3`}
      data-filled={filled}
      className="flex flex-1 gap-1.5 pr-13 lg:ml-auto lg:max-w-60 lg:pr-0"
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)]"
            style={{ width: i < filled ? '100%' : '0%' }}
          />
        </span>
      ))}
    </div>
  )
}

/** Вопрос шага: на телефоне — сверху, на компьютере — над вариантами. */
export function Question({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mt-7 flex flex-col gap-2.5 px-1 lg:mt-0 lg:px-0">
      <h1 className="text-3xl font-bold leading-[1.18] tracking-[-0.02em] lg:text-4xl lg:leading-[1.15]">{title}</h1>
      {desc && (
        <p className="text-body font-semibold leading-[1.45] text-fg-secondary lg:text-base lg:font-normal lg:leading-normal">
          {desc}
        </p>
      )}
    </div>
  )
}

/**
 * Вариант ответа: карточка 64 px. Нажатие подсвечивает его за 120 мс — и
 * сразу следующий шаг (выбор ведёт дальше, «Дальше» не нужна).
 */
export function Choice({
  on,
  onPick,
  onPreview,
  radio = false,
  center = false,
  children,
}: {
  on: boolean
  onPick: () => void
  /** Компьютер: наведение и фокус показывают тариф варианта справа. */
  onPreview?: (on: boolean) => void
  /** Кружок выбора слева (язык). */
  radio?: boolean
  center?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      onMouseEnter={() => onPreview?.(true)}
      onMouseLeave={() => onPreview?.(false)}
      onFocus={() => onPreview?.(true)}
      onBlur={() => onPreview?.(false)}
      className={`flex min-h-16 items-center gap-3.5 rounded-control-lg px-4.5 text-left text-lg font-semibold transition-[background-color,box-shadow,color] duration-[120ms] ${
        center ? 'justify-center tabular-nums' : ''
      } ${on ? 'bg-accent-soft text-accent-soft-fg inset-ring-2 inset-ring-focus' : 'bg-surface text-fg shadow-card inset-ring inset-ring-line'}`}
    >
      {radio && (
        <span
          aria-hidden
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
            on ? 'bg-accent text-accent-fg' : 'inset-ring-2 inset-ring-fg-faint'
          }`}
        >
          {on && <IconCheck size={16} />}
        </span>
      )}
      {children}
    </button>
  )
}

/** «‹ Назад» над вопросом — на компьютере; на телефоне «Назад» — стрелка у полосок. Сама ссылка — общий `BackLink`. */
export function StepBack({ onClick }: { onClick: () => void }) {
  return (
    <div className="-my-0.5 mb-4 hidden self-start lg:block">
      <BackLink onClick={onClick} label="Назад" />
    </div>
  )
}

/** «От коллеги» вместо «От преподавателя»; репетиторов владелец находит и звонком. */
const HEARD = ['Инстаграм', 'TikTok', 'Телеграм', 'От коллеги', 'Звонок от Recall', 'Поиск', 'Другое']

/**
 * «Откуда ты о нас знаешь?» — маленьким, необязательно, ниже всего (журнал
 * п.71). Чип рисуется 36 px, как в макете, а нажимается по 44 px: прозрачный
 * запас сверху и снизу, ряды наезжают запасами, а не чипами.
 */
export function HeardChips({ value, onPick }: { value: string | null; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-1.5 text-sm font-semibold text-fg-secondary">
        Откуда ты о нас знаешь?
        <small className="text-xs font-normal text-fg-muted">· необязательно</small>
      </p>
      <div className="flex flex-wrap gap-x-1.5 gap-y-1.5">
        {HEARD.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={value === h}
            onClick={() => {
              onPick(h)
              setSelfReportedSource(h)
            }}
            className="-my-1 flex h-11 items-center"
          >
            <span
              className={`flex h-9 items-center rounded-full px-3 text-sm ${
                value === h
                  ? 'bg-accent-soft font-semibold text-accent-soft-fg inset-ring-2 inset-ring-focus'
                  : 'font-medium text-fg-secondary inset-ring inset-ring-line'
              }`}
            >
              {h}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
