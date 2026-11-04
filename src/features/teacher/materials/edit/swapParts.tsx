// ============================================================================
// Куски замены через AI (макет d17, PLAN.md Ф2.25-4б): строка «AI пишет»
// вместо упражнения (d17-2), плашка «Замены кончились» (d17-3в), остаток
// замен — карточкой у «Сохранить» в мастере (d17-1…d17-3) и тихой строкой в
// библиотеке (журнал п.76 (25)).
//
// Тексты — без «бесплатно» и «без ограничений» (решение владельца 04.11,
// п.76 (22)): у замены есть лимит, честно — остаток и что генерацию она не
// тратит. «Сложных» — по месту: только если в материале есть сложный вид.
// ============================================================================
import type { ReactNode } from 'react'
import { STRONG_PER_DAY, SWAPS_PER_DAY } from '../../../../domains/materials'
import { IconSparkle } from '../../../../shared/ui/icons'
import { ExerciseHead } from '../detailParts'
import type { SwapBudget } from './useSwapBudget'

/** Полоса скелетона на подложке упражнения (d17-2 `.sk`). */
const Bar = ({ className }: { className: string }) => <span className={`animate-skeleton block h-3.5 rounded-tag bg-surface ${className}`} />

/**
 * Упражнение, которое пишет AI (d17-2): шапка с видом и выключенными
 * действиями, «✦ AI пишет…» и две полосы — не крутилка: строка держит место,
 * список не прыгает, когда ответ пришёл.
 */
export function SwapSkeleton({ n, label, isNew, actions }: { n: number; label: string; isNew: boolean; actions?: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-2 rounded-control bg-input py-3 pl-3.5 pr-3 @lg:grid-cols-[minmax(0,1fr)_auto]" data-exercise={n} data-swapping>
      <ExerciseHead n={n} label={isNew ? `${label} · новое` : label} />
      {actions && <span className="order-last -mb-1.5 -ml-2 flex flex-wrap gap-0.5 @lg:order-none @lg:col-start-2 @lg:row-start-1 @lg:mb-0 @lg:ml-0">{actions}</span>}
      <span className="flex flex-col gap-2.5 @lg:col-span-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-accent-soft-fg">
          <IconSparkle size={14} aria-hidden className="flex-none" />
          {isNew ? 'AI пишет новое упражнение' : 'AI пишет новый вопрос того же формата'}
        </span>
        <Bar className="w-5/6" />
        <Bar className="w-2/5" />
      </span>
    </div>
  )
}

/**
 * «Замены кончились — снова завтра с 00:00» (d17-3в). Кончились только
 * сложные — то же про них, остальные виды можно: сколько ещё.
 */
export function SwapsOut({ strongOnly, left }: { strongOnly: boolean; left: number }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-control bg-input px-3.5 py-3" data-swaps-out>
      <b className="text-sm font-semibold text-fg">{strongOnly ? 'Сложные замены кончились — снова завтра с 00:00' : 'Замены кончились — снова завтра с 00:00'}</b>
      <span className="text-sm text-fg-secondary">
        {strongOnly ? `Это каверзные True / False и «Собери предложение»; остальные виды можно заменить — ещё ${left} сегодня` : '«Изменить» и «Напишу сам» работают и сейчас'}
      </span>
    </div>
  )
}

/** «Замен через AI сегодня: 23 из 25 · сложных 4 из 5»; не знаем — так и сказано, с «Повторить» (Ф1.13), а не «0». */
export function SwapCount({ budget, strong }: { budget: SwapBudget; strong: boolean }) {
  const c = budget.counters
  if (!c) {
    return budget.error ? (
      <>
        Не удалось узнать, сколько замен осталось ·{' '}
        <button type="button" onClick={budget.reload} className="font-semibold text-accent-strong underline underline-offset-2">
          Повторить
        </button>
      </>
    ) : (
      <>Замен через AI сегодня: …</>
    )
  }
  return (
    <>
      Замен через AI сегодня:{' '}
      <b className="font-semibold text-fg">
        {c.left} из {SWAPS_PER_DAY}
      </b>
      {strong && (
        <>
          {' '}
          · сложных{' '}
          <b className="font-semibold text-fg">
            {c.strongLeft} из {STRONG_PER_DAY}
          </b>
        </>
      )}
    </>
  )
}

/** Карточка остатка у «Сохранить» в мастере (d17-1…d17-3 — над строкой о генерациях). */
export function SwapCard({ budget, strong }: { budget: SwapBudget; strong: boolean }) {
  return (
    <p className="rounded-control-sm bg-input px-3 py-2.5 text-sm leading-snug text-fg-secondary tabular-nums" data-swap-count>
      <SwapCount budget={budget} strong={strong} />
      <br />
      «↻ Заменить» и «+ Упражнение → Составит AI» генерацию не тратят
    </p>
  )
}

/** Тихая строка остатка в библиотеке — под «+ Упражнение» (кадра нет, журнал п.76 (25)). */
export function SwapLine({ budget, strong }: { budget: SwapBudget; strong: boolean }) {
  return (
    <p className="text-note text-fg-muted tabular-nums" data-swap-count>
      <SwapCount budget={budget} strong={strong} />
      {(budget.counters || !budget.error) && ' · генерацию не тратят'}
    </p>
  )
}
