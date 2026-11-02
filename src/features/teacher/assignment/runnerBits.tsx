// ============================================================================
// Шапка задания по материалу (макет u5). Телефон (u5-1): «‹ Название», ниже
// «↑ перечитать текст» и счёт «3 / 6 · 2 балла» (после проверки пар — «+3»),
// под ними полоска. Компьютер (u5-4): те же счёт и «перечитать текст» в
// рамке раунда (shared/ui/RoundFrame), справа — клавиши упражнения.
// ============================================================================
import type { ReactNode } from 'react'
import { IconArrowUp, IconChevronLeft } from '../../../shared/ui/icons'
import { KEY_EXIT, type RoundKey } from '../../../shared/ui/RoundFrame'
import { points } from '../../../lib/assignmentScore'
import type { AppLang, MaterialExercise } from '../../../types'

/** «↑ перечитать текст» — таблеткой (u5). */
export function ReadAgain({ onClick }: { onClick: () => void }) {
  return (
    // цель касания 44, таблетка — 36, как в макете
    <button type="button" onClick={onClick} className="group flex h-11 flex-none items-center">
      <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent-soft pr-3 pl-2 text-sm font-semibold whitespace-nowrap text-accent-soft-fg transition-colors group-hover:bg-accent-soft-press">
        <IconArrowUp size={16} aria-hidden />
        перечитать текст
      </span>
    </button>
  )
}

/** «3 / 6 · 5 баллов» и «+3» за только что проверенные пары. */
export function ScoreCount({ at, total, score, plus }: { at: number; total: number; score: number; plus?: number }) {
  return (
    <span className="flex items-center gap-1.5">
      {at} / {total} · {points(score)}
      {plus ? <span className="rounded-full bg-success-soft px-2 py-0.5 text-note text-success-strong">+{plus}</span> : null}
    </span>
  )
}

/** Шапка телефона (u5-1): назад к заданиям, название, перечитать, счёт, полоска. */
export function PhoneTop({
  title,
  lang,
  onBack,
  onRead,
  count,
  done,
  total,
}: {
  title: string
  lang: AppLang
  onBack: () => void
  onRead: () => void
  count: ReactNode
  /** Сколько упражнений позади — полоска. */
  done: number
  total: number
}) {
  return (
    <header className="flex flex-col">
      <div className="-mx-2 flex h-12 items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="К заданиям"
          className="flex size-11 flex-none items-center justify-center rounded-control-sm text-accent-strong transition-colors hover:bg-tint/[0.06]"
        >
          <IconChevronLeft size={24} aria-hidden />
        </button>
        <b lang={lang} className="min-w-0 flex-1 truncate text-base font-semibold text-fg">
          {title}
        </b>
      </div>
      <div className="flex h-11 items-center gap-2.5">
        <ReadAgain onClick={onRead} />
        <span className="ml-auto text-sm font-semibold whitespace-nowrap tabular-nums text-fg-secondary">{count}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Задание"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <span className="block h-full rounded-full bg-primary transition-[width] duration-(--dur-2) ease-out" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </header>
  )
}

const ENTER: RoundKey = { keys: ['Enter'], label: 'проверить, дальше' }
const EXIT: RoundKey = { ...KEY_EXIT, label: 'выйти' }

/** Клавиши справа в рамке (u5-4) — под упражнение на экране. */
export function keysFor(ex: MaterialExercise): RoundKey[] {
  if (ex.type === 'match') {
    const rights = ex.pairs.length + (ex.extra?.length ?? 0)
    return [
      { keys: ['1', String(ex.pairs.length)], range: true, label: 'слово' },
      { keys: ['A', String.fromCharCode(64 + rights)], range: true, label: ex.format === 'definition' ? 'объяснение' : 'перевод' },
      { keys: ['Tab'], label: 'по списку', also: { keys: ['Space'], label: 'выбрать' } },
      { keys: ['Backspace'], label: 'разъединить выбранное' },
      ENTER,
      EXIT,
    ]
  }
  if (ex.type === 'mcq') {
    return [{ keys: ['1', String(ex.options.length)], range: true, label: ex.format === 'tfng' ? 'ответ' : 'вариант' }, { keys: ['Enter'], label: 'дальше' }, EXIT]
  }
  return [ENTER, EXIT]
}
