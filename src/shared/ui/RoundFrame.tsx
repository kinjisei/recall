// ============================================================================
// Рамка раунда «Практики» (макет d5; журнал п.76 (17)): одна на все игры.
// Вверху — «× Выйти · Esc», полоска раунда и «4 из 10». Посередине —
// колонка 600 (`--container-exercise`); когда содержимому хватает 1120
// (`AREA.exerciseSides`, правило d0-3), поля по бокам не пустые, но тихие:
// слева — ход раунда кружками («Раунд · Перевод слова», ✓ / × / текущий /
// следующие, «2 верно · 1 с ошибкой»), справа — клавиши раунда. Уже —
// только верх и колонка, как на телефоне. Шапку и меню каркаса на время
// раунда прячет `useRoundMode` (roundKeys).
//
// Задание по материалу (макет u5-4) — та же рамка со своими подписями:
// «‹ Название · Esc» вместо «× Выйти», счёт «5 / 6 · 6 баллов», справа
// «↑ перечитать текст», слева «Упражнения» по 3 в ряд с «3/4» у пар и
// «6 баллов», колонка выше (`dense`); на телефоне — своя шапка
// (`narrowHeader`, u5-1), и колонка тянется до низа экрана: главная кнопка
// упражнения стоит внизу.
// ============================================================================
import type { ReactNode } from 'react'
import { useContentAtLeast, usePageWidth } from '../lib/screenWidth'
import { AREA } from './breakpoints'
import { IconCheck, IconChevronLeft, IconClose } from './icons'
import { Kbd } from './Kbd'

/** Клавиша раунда в подсказке справа: `keys` — ['1', '4'] пишется «1 – 4». */
export interface RoundKey {
  keys: string[]
  label: string
  /** Диапазон «1 – 4», а не «1 4». */
  range?: boolean
  /** Вторая клавиша в той же строке: «Tab по списку, Space выбрать» (u5-4). */
  also?: { keys: string[]; label: string }
}

/** Ответ в ходе раунда: верно / нет, у «Соедини пары» — сколько пар из скольких. */
export type RoundStep = boolean | { got: number; of: number }

const stepOk = (r: RoundStep) => (typeof r === 'boolean' ? r : r.got === r.of)

export const KEY_EXIT: RoundKey = { keys: ['Esc'], label: 'выйти из раунда' }

const GRID = 'grid grid-cols-[minmax(0,1fr)_var(--container-exercise)_minmax(0,1fr)] gap-8'

export function RoundFrame({
  title,
  at,
  total,
  results,
  keys = [KEY_EXIT],
  onExit,
  back,
  count,
  headerEnd,
  trackTitle,
  trackNote,
  dense = false,
  narrowHeader,
  children,
}: {
  /** Название игры: «Раунд · Перевод слова» слева. */
  title: string
  /** Какой вопрос на экране, с 1; null — счёта нет (загрузка, мало слов). */
  at: number | null
  /** Сколько вопросов в раунде; null — без конца (спринт на время). */
  total: number | null
  /** Ответы раунда по порядку: true — верно; у пар — сколько из скольких. */
  results: RoundStep[]
  keys?: RoundKey[]
  onExit: () => void
  /** «‹ Название» вместо «× Выйти» (задание по материалу, u5-4). */
  back?: string
  /** Счёт вместо «4 из 10»: «5 / 6 · 6 баллов». */
  count?: ReactNode
  /** Справа в шапке: «↑ перечитать текст». */
  headerEnd?: ReactNode
  /** Над ходом — вместо «Раунд · {title}». */
  trackTitle?: string
  /** Под ходом — вместо «2 верно · 1 с ошибкой». */
  trackNote?: ReactNode
  /** Ход по 3 в ряд и колонка выше — u5-4. */
  dense?: boolean
  /** Шапка телефона вместо «× Выйти · полоска» (u5-1); колонка — до низа экрана. */
  narrowHeader?: ReactNode
  children: ReactNode
}) {
  const wide = useContentAtLeast(AREA.exerciseSides)
  // поля по бокам — шире колонки страницы; без них ширину не трогаем
  usePageWidth(wide ? 'page' : null, AREA.exerciseSides)
  const ok = results.filter(stepOk).length
  const bad = results.length - ok
  // на телефоне со своей шапкой колонка тянется до низа экрана (за вычетом
  // отступов каркаса в режиме раунда, app/shell/Layout): кнопка — внизу
  const fill = !wide && narrowHeader !== undefined
  const asideTop = dense ? 'pt-12' : 'pt-37'

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
        <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-fg-secondary">{count ?? (total ? `${at} из ${total}` : `верно: ${ok}`)}</span>
      </div>
    ) : (
      <span />
    )

  return (
    <div className={`flex flex-col ${fill ? 'min-h-[calc(100dvh-1.75rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]' : ''}`}>
      <h1 className="sr-only">{title}</h1>
      {fill ? (
        narrowHeader
      ) : (
        <header className={wide ? `${GRID} min-h-19 items-center` : 'flex min-h-14 items-center gap-3'}>
          <button
            type="button"
            onClick={onExit}
            className={`flex flex-none items-center justify-self-start rounded-tile pr-3 text-body font-medium text-fg-secondary transition-colors hover:bg-tint/[0.06] ${
              back ? 'min-h-11 min-w-0 gap-1.5 pl-1.5' : 'min-h-11 gap-2 pl-2'
            }`}
          >
            {back ? <IconChevronLeft size={20} aria-hidden className="flex-none" /> : <IconClose size={20} aria-hidden />}
            {back ? <span className="truncate">{back}</span> : 'Выйти'}
            <Kbd show="pointer">Esc</Kbd>
          </button>
          {progress}
          {wide ? <span className="justify-self-end">{headerEnd}</span> : headerEnd}
        </header>
      )}

      <div className={wide ? `${GRID} items-start` : 'mx-auto flex w-full max-w-exercise flex-1 flex-col'}>
        {wide && (
          <aside aria-label="Ход раунда" className={`flex flex-col items-end gap-3 text-right text-note text-fg-muted ${asideTop}`}>
            <p>{trackTitle ?? `Раунд · ${title}`}</p>
            {total !== null && total <= 30 && (
              <ol className={`grid gap-2 ${dense ? 'grid-cols-[repeat(3,1.375rem)]' : 'grid-cols-[repeat(5,1.375rem)]'}`} dir="ltr">
                {Array.from({ length: total }, (_, i) => {
                  const r = results[i]
                  const state = r === undefined ? (i + 1 === at ? 'now' : 'next') : stepOk(r) ? 'ok' : typeof r === 'object' && r.got > 0 ? r : 'bad'
                  return <Step key={i} n={i + 1} state={state} />
                })}
              </ol>
            )}
            <p>
              {trackNote ?? (
                <>
                  {ok} верно · {bad} с ошибкой
                </>
              )}
            </p>
          </aside>
        )}
        <div className={`@container/round flex min-w-0 flex-col gap-5 ${wide ? (dense ? 'pt-10' : 'pt-35') : 'flex-1 pt-2'}`}>{children}</div>
        {wide && (
          <aside aria-label="Клавиши" className={`flex flex-col gap-3 text-note text-fg-muted ${asideTop}`}>
            <p>Клавиши</p>
            <ul className="flex flex-col gap-2">
              {keys.map((k) => (
                <li key={k.label} className="flex flex-wrap items-center gap-2">
                  <KeyCaps k={k} />
                  {k.label}
                  {k.also && (
                    <>
                      <span aria-hidden className="-ml-2">
                        ,
                      </span>
                      <KeyCaps k={k.also} />
                      {k.also.label}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}

/** Клавиши строки подсказки: «1 – 4» диапазоном или подряд; читалке — текстом. */
function KeyCaps({ k }: { k: Pick<RoundKey, 'keys' | 'range'> }) {
  return (
    <>
      <span aria-hidden className="flex items-center gap-1">
        {k.keys.map((key, i) => (
          <span key={key} className="flex items-center gap-1">
            {i > 0 && k.range && '–'}
            <Kbd outline>{key}</Kbd>
          </span>
        ))}
      </span>
      <span className="sr-only">{k.keys.join(k.range ? '–' : ' ')}: </span>
    </>
  )
}

/**
 * Кружок хода раунда (d5): верно — ✓, ошибка — ×, текущий — в кольце фокуса,
 * впереди — номер; у пар, верных не всех, — «3/4» на жёлтом (u5-4).
 */
function Step({ n, state }: { n: number; state: 'ok' | 'bad' | 'now' | 'next' | { got: number; of: number } }) {
  if (typeof state === 'object') {
    return (
      <li
        aria-label={`${n}: ${state.got} из ${state.of}`}
        className="flex size-5.5 items-center justify-center rounded-full bg-warning-soft text-micro font-semibold tracking-normal tabular-nums text-warning-soft-fg"
      >
        {state.got}/{state.of}
      </li>
    )
  }
  const look = {
    ok: 'bg-success-soft text-success-strong',
    bad: 'bg-danger-soft text-danger-strong',
    now: 'text-accent-soft-fg inset-ring-2 inset-ring-focus',
    // номера впереди — fg-muted, а не бледный кадра: текст ≥ 4,5 : 1 (ux-audit)
    next: 'text-fg-muted inset-ring inset-ring-line',
  }[state]
  const label = { ok: 'верно', bad: 'с ошибкой', now: 'сейчас', next: 'впереди' }[state]
  return (
    <li aria-label={`${n}: ${label}`} className={`flex size-5.5 items-center justify-center rounded-full text-caption font-semibold tabular-nums ${look}`}>
      {state === 'ok' ? <IconCheck size={12} aria-hidden /> : state === 'bad' ? <IconClose size={12} aria-hidden /> : n}
    </li>
  )
}
