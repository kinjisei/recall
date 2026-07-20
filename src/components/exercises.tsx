// ============================================================================
// Общий движок упражнений (mcq / fill / order) — используется грамматикой
// и материалами преподавателя. Перенесён из features/grammar/GrammarPage.
// onGiven — необязательный колбэк: каким был ответ ученика (для проверки
// учителем в материалах).
// ============================================================================
import { useMemo, useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { normalizeAnswer } from '../lib/text'
import type { GrammarExercise } from '../types'

export interface ExerciseCallbacks {
  onAnswered: (ok: boolean) => void
  onGiven?: (given: string) => void
  onNext: () => void
  isLast: boolean
}

export function ExerciseView({
  exercise,
  ...cb
}: { exercise: GrammarExercise } & ExerciseCallbacks) {
  if (exercise.type === 'mcq') return <McqExercise exercise={exercise} {...cb} />
  if (exercise.type === 'fill') return <FillExercise exercise={exercise} {...cb} />
  return <OrderExercise exercise={exercise} {...cb} />
}

function NextButton({ onNext, isLast }: { onNext: () => void; isLast: boolean }) {
  return <Button onClick={onNext}>{isLast ? 'Завершить' : 'Дальше →'}</Button>
}

export function McqExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
}: { exercise: Extract<GrammarExercise, { type: 'mcq' }> } & ExerciseCallbacks) {
  const [picked, setPicked] = useState<number | null>(null)

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    onAnswered(i === exercise.answer)
    onGiven?.(exercise.options[i] ?? '')
  }

  // короткие варианты (слова) — сеткой 2×2, длинные фразы — столбиком
  const compact = exercise.options.every((o) => o.length <= 16)

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
        {exercise.options.map((opt, i) => {
          const isAnswer = i === exercise.answer
          const isPicked = i === picked
          let cls = 'border-white/[0.10] hover:border-sky-400'
          if (picked !== null) {
            if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            else if (isPicked) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40'
            else cls = 'border-white/[0.08] opacity-60'
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${cls}`}
            >
              {opt}
            </button>
          )
        })}
      </div>
      {picked !== null && <NextButton onNext={onNext} isLast={isLast} />}
    </Card>
  )
}

export function FillExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
}: { exercise: Extract<GrammarExercise, { type: 'fill' }> } & ExerciseCallbacks) {
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState(false)
  const [showHint, setShowHint] = useState(false)

  const ok = normalizeAnswer(value) === normalizeAnswer(exercise.answer)

  const check = () => {
    if (checked || !value.trim()) return
    setChecked(true)
    onAnswered(ok)
    onGiven?.(value.trim())
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <input
        className={`w-full rounded-lg border bg-[var(--night-surface)] px-3 py-2 outline-none dark:bg-slate-900 ${
          checked
            ? ok
              ? 'border-emerald-500'
              : 'border-red-500'
            : 'border-white/[0.10] focus:border-[var(--night-accent-45)] dark:border-white/[0.10]'
        }`}
        placeholder="Ваш ответ…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={checked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {!checked && exercise.hint && (
        <button
          onClick={() => setShowHint((s) => !s)}
          className="self-start text-xs font-semibold text-[var(--night-accent-text)]"
        >
          {showHint ? 'скрыть подсказку' : '💡 подсказка'}
        </button>
      )}
      {!checked && showHint && exercise.hint && (
        <p className="text-sm text-[var(--night-text-40)]">{exercise.hint}</p>
      )}

      {checked && !ok && (
        <p className="text-sm">
          <span className="text-red-500">Верный ответ: </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {exercise.answer}
          </span>
        </p>
      )}
      {checked && ok && (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Верно! ✓
        </p>
      )}

      {checked ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <Button onClick={check} disabled={!value.trim()}>
          Проверить
        </Button>
      )}
    </Card>
  )
}

export function OrderExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
}: { exercise: Extract<GrammarExercise, { type: 'order' }> } & ExerciseCallbacks) {
  // Перемешиваем слова для показа (в данных они часто уже в правильном порядке).
  const shuffled = useMemo(() => {
    const arr = exercise.words.map((w, i) => ({ w, i }))
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [exercise])

  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  const [checked, setChecked] = useState(false)

  const usedIdx = new Set(built.map((b) => b.i))
  const ok =
    built.length === exercise.answer.length &&
    built.every((b, i) => b.w === exercise.answer[i])

  const check = () => {
    if (checked || built.length !== exercise.words.length) return
    setChecked(true)
    onAnswered(ok)
    onGiven?.(built.map((b) => b.w).join(' '))
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>

      {/* Собранное предложение */}
      <div
        className={`min-h-[48px] rounded-lg border-2 border-dashed p-2 ${
          checked
            ? ok
              ? 'border-emerald-500'
              : 'border-red-500'
            : 'border-white/[0.10]'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((b, i) => (
            <button
              key={i}
              onClick={() => !checked && setBuilt((arr) => arr.filter((_, j) => j !== i))}
              disabled={checked}
              className="rounded-lg bg-[var(--night-accent)] px-3 py-1.5 text-sm text-white"
            >
              {b.w}
            </button>
          ))}
          {built.length === 0 && (
            <span className="px-1 py-1 text-sm text-[var(--night-text-40)]">
              нажимайте слова снизу по порядку
            </span>
          )}
        </div>
      </div>

      {/* Банк слов */}
      <div className="flex flex-wrap gap-2">
        {shuffled.map((item) => (
          <button
            key={item.i}
            onClick={() => !checked && setBuilt((arr) => [...arr, item])}
            disabled={checked || usedIdx.has(item.i)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              usedIdx.has(item.i)
                ? 'border-white/[0.08] text-[var(--night-text-25)] dark:border-slate-800 dark:text-[var(--night-text-70)]'
                : 'border-white/[0.10]'
            }`}
          >
            {item.w}
          </button>
        ))}
      </div>

      {checked && !ok && (
        <p className="text-sm">
          <span className="text-red-500">Правильно: </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {exercise.answer.join(' ')}
          </span>
        </p>
      )}
      {checked && ok && (
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Верно! ✓
        </p>
      )}

      {checked ? (
        <NextButton onNext={onNext} isLast={isLast} />
      ) : (
        <div className="flex gap-2">
          <Button
            onClick={check}
            disabled={built.length !== exercise.words.length}
            className="flex-1"
          >
            Проверить
          </Button>
          {built.length > 0 && (
            <Button variant="ghost" onClick={() => setBuilt([])}>
              Сброс
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
