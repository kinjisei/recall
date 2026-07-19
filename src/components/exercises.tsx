// ============================================================================
// Общий движок упражнений (mcq / fill / order) — используется грамматикой
// и материалами преподавателя. Перенесён из features/grammar/GrammarPage.
// onGiven — необязательный колбэк: каким был ответ ученика (для проверки
// учителем в материалах).
// ============================================================================
import { useMemo, useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import type { GrammarExercise } from '../types'

/** Нормализация ответа: без регистра, диакритики и лишних пробелов. */
export function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

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

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <div className="flex flex-col gap-2">
        {exercise.options.map((opt, i) => {
          const isAnswer = i === exercise.answer
          const isPicked = i === picked
          let cls = 'border-slate-300 dark:border-slate-600 hover:border-sky-400'
          if (picked !== null) {
            if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            else if (isPicked) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40'
            else cls = 'border-slate-200 dark:border-slate-700 opacity-60'
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

  const ok = normalize(value) === normalize(exercise.answer)

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
        className={`w-full rounded-lg border bg-white px-3 py-2 outline-none dark:bg-slate-900 ${
          checked
            ? ok
              ? 'border-emerald-500'
              : 'border-red-500'
            : 'border-slate-300 focus:border-sky-500 dark:border-slate-600'
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
          className="self-start text-xs font-semibold text-sky-600 dark:text-sky-400"
        >
          {showHint ? 'скрыть подсказку' : '💡 подсказка'}
        </button>
      )}
      {!checked && showHint && exercise.hint && (
        <p className="text-sm text-slate-500">{exercise.hint}</p>
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
            : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((b, i) => (
            <button
              key={i}
              onClick={() => !checked && setBuilt((arr) => arr.filter((_, j) => j !== i))}
              disabled={checked}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white"
            >
              {b.w}
            </button>
          ))}
          {built.length === 0 && (
            <span className="px-1 py-1 text-sm text-slate-400">
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
                ? 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 dark:border-slate-600'
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
