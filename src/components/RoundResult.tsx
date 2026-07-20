// ============================================================================
// Экран результата раунда — единый для всех мини-игр, упражнений грамматики
// и тренажёров. Раньше эта разметка была скопирована в 8 местах, и
// формулировки успели разъехаться («Засчитано» / «Тема засчитана» / ничего).
// ============================================================================
import type { ReactNode } from 'react'
import { Card } from './Card'
import { Button } from './Button'

/** Эмодзи по проценту: 🎉 ≥80, 👍 ≥50, 💪 ниже. */
export function scoreEmoji(percent: number): string {
  return percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'
}

export function RoundResult({
  correct,
  total,
  note,
  restartLabel = 'Ещё раунд',
  onRestart,
  extra,
  children,
}: {
  correct: number
  total: number
  /** Строка под счётом (например, «Раунд засчитан в серию дня»). */
  note?: string
  restartLabel?: string
  onRestart: () => void
  /** Доп. кнопка(и) рядом с «Ещё раз» (например, «К теории»). */
  extra?: ReactNode
  /** Доп. блок между заметкой и кнопкой (например, список «Повтори»). */
  children?: ReactNode
}) {
  const percent = total ? Math.round((correct / total) * 100) : 0
  return (
    <Card className="flex flex-col gap-3 text-center">
      <p className="text-4xl">{scoreEmoji(percent)}</p>
      <p className="text-lg font-bold">
        {correct} из {total} верно ({percent}%)
      </p>
      {note && <p className="-mt-1 text-sm text-[var(--night-text-40)]">{note}</p>}
      {children}
      <div className="mt-1 flex justify-center gap-3">
        <Button variant={extra ? 'secondary' : 'primary'} onClick={onRestart}>
          {restartLabel}
        </Button>
        {extra}
      </div>
    </Card>
  )
}

/** Строка прогресса раунда: «N / M» слева, «верно: K» справа. */
export function RoundProgress({
  index,
  total,
  correct,
  progressLabel,
}: {
  index: number
  total: number
  correct: number
  /** Префикс перед счётчиком, например «Упражнение». */
  progressLabel?: string
}) {
  return (
    <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
      <span>
        {progressLabel ? `${progressLabel} ` : ''}
        {index} / {total}
      </span>
      <span>верно: {correct}</span>
    </div>
  )
}
