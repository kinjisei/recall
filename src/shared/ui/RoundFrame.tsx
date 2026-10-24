// ============================================================================
// Рамка раунда «Практики» (макет d5; журнал п.76 (17)): одна на все игры.
// Вверху — «× Выйти · Esc», полоска раунда и «4 из 10». Посередине —
// колонка 600 (`--container-exercise`); когда содержимому хватает 1120
// (`AREA.exerciseSides`, правило d0-3), поля по бокам не пустые, но тихие:
// слева — ход раунда кружками («Раунд · Перевод слова», ✓ / × / текущий /
// следующие, «2 верно · 1 с ошибкой»), справа — клавиши раунда. Уже —
// только верх и колонка, как на телефоне. Шапку и меню каркаса на время
// раунда прячет `useRoundMode` (roundKeys).
// ============================================================================
import type { ReactNode } from 'react'
import { useContentAtLeast, usePageWidth } from '../lib/screenWidth'
import { AREA } from './breakpoints'
import { IconCheck, IconClose } from './icons'
import { Kbd } from './Kbd'

/** Клавиша раунда в подсказке справа: `keys` — ['1', '4'] пишется «1 – 4». */
export interface RoundKey {
  keys: string[]
  label: string
  /** Диапазон «1 – 4», а не «1 4». */
  range?: boolean
}

export const KEY_EXIT: RoundKey = { keys: ['Esc'], label: 'выйти из раунда' }

const GRID = 'grid grid-cols-[minmax(0,1fr)_var(--container-exercise)_minmax(0,1fr)] gap-8'

export function RoundFrame({
  title,
  at,
  total,
  results,
  keys = [KEY_EXIT],
  onExit,
  children,
}: {
  /** Название игры: «Раунд · Перевод слова» слева. */
  title: string
  /** Какой вопрос на экране, с 1; null — счёта нет (загрузка, мало слов). */
  at: number | null
  /** Сколько вопросов в раунде; null — без конца (спринт на время). */
  total: number | null
  /** Ответы раунда по порядку: true — верно. */
  results: boolean[]
  keys?: RoundKey[]
  onExit: () => void
  children: ReactNode
}) {
  const wide = useContentAtLeast(AREA.exerciseSides)
  // поля по бокам — шире колонки страницы; без них ширину не трогаем
  usePageWidth(wide ? 'page' : null, AREA.exerciseSides)
  const ok = results.filter(Boolean).length
  const bad = results.length - ok

  const progress =
    at !== null ? (
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {total ? (
          <div
            role="progressbar"
            aria-label="Раунд"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={results.length}
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-input"
          >
            <span className="block h-full rounded-full bg-accent transition-[width] duration-(--dur-2) ease-out" style={{ width: `${(results.length / total) * 100}%` }} />
          </div>
        ) : (
          <span className="flex-1" />
        )}
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-fg-secondary">{total ? `${at} из ${total}` : `верно: ${ok}`}</span>
      </div>
    ) : (
      <span />
    )

  return (
    <div className="flex flex-col">
      <h1 className="sr-only">{title}</h1>
      <header className={wide ? `${GRID} min-h-19 items-center` : 'flex min-h-14 items-center gap-3'}>
        <button
          type="button"
          onClick={onExit}
          className="flex min-h-11 flex-none items-center gap-2 justify-self-start rounded-tile pl-2 pr-3 text-body font-medium text-fg-secondary transition-colors hover:bg-tint/[0.06]"
        >
          <IconClose size={20} aria-hidden />
          Выйти
          <Kbd show="pointer">Esc</Kbd>
        </button>
        {progress}
        {wide && <span />}
      </header>

      <div className={wide ? `${GRID} items-start` : 'mx-auto w-full max-w-exercise'}>
        {wide && (
          <aside aria-label="Ход раунда" className="flex flex-col items-end gap-3 pt-37 text-right text-note text-fg-muted">
            <p>Раунд · {title}</p>
            {total !== null && total <= 30 && (
              <ol className="grid grid-cols-[repeat(5,1.375rem)] gap-2" dir="ltr">
                {Array.from({ length: total }, (_, i) => (
                  <Step key={i} n={i + 1} state={i < results.length ? (results[i] ? 'ok' : 'bad') : i + 1 === at ? 'now' : 'next'} />
                ))}
              </ol>
            )}
            <p>
              {ok} верно · {bad} с ошибкой
            </p>
          </aside>
        )}
        <div className={`@container/round flex min-w-0 flex-col gap-5 ${wide ? 'pt-35' : 'pt-2'}`}>{children}</div>
        {wide && (
          <aside aria-label="Клавиши" className="flex flex-col gap-3 pt-37 text-note text-fg-muted">
            <p>Клавиши</p>
            <ul className="flex flex-col gap-2">
              {keys.map((k) => (
                <li key={k.label} className="flex items-center gap-2">
                  <span aria-hidden className="flex items-center gap-1">
                    {k.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && k.range && '–'}
                        <Kbd outline>{key}</Kbd>
                      </span>
                    ))}
                  </span>
                  <span className="sr-only">{k.keys.join(k.range ? '–' : ' ')}: </span>
                  {k.label}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}

/** Кружок хода раунда (d5): верно — ✓, ошибка — ×, текущий — в кольце фокуса, впереди — номер. */
function Step({ n, state }: { n: number; state: 'ok' | 'bad' | 'now' | 'next' }) {
  const look = {
    ok: 'bg-success-soft text-success-strong',
    bad: 'bg-danger-soft text-danger-strong',
    now: 'text-accent-soft-fg inset-ring-2 inset-ring-focus',
    // номера впереди — fg-muted, а не бледный fg-faint кадра: текст ≥ 4,5 : 1 (ux-audit)
    next: 'text-fg-muted inset-ring inset-ring-line',
  }[state]
  const label = { ok: 'верно', bad: 'с ошибкой', now: 'сейчас', next: 'впереди' }[state]
  return (
    <li aria-label={`${n}: ${label}`} className={`flex size-5.5 items-center justify-center rounded-full text-caption font-semibold tabular-nums ${look}`}>
      {state === 'ok' ? <IconCheck size={12} aria-hidden /> : state === 'bad' ? <IconClose size={12} aria-hidden /> : n}
    </li>
  )
}
