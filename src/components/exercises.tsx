// ============================================================================
// Общий движок упражнений (mcq / fill / order) — используется грамматикой
// и материалами преподавателя. Перенесён из features/grammar/GrammarPage.
// onGiven — необязательный колбэк: каким был ответ ученика (для проверки
// учителем в материалах).
//
// ⚠️ САМОКОРРЕКЦИЯ. Ошибся — сперва показываем, ГДЕ ошибка, и даём вторую
// попытку; правильный ответ появляется только после неё или по кнопке
// «показать ответ». Готовый ответ, выданный сразу, закрывает работу: человек
// сверяет две строки и идёт дальше, не найдя ошибку сам. Правило и подсказки —
// в lib/selfCorrect, ОДНО место на все три типа упражнений.
//
// ⚠️ Балл — по ПЕРВОЙ попытке: onAnswered и onGiven вызываются ровно один раз.
// Иначе «8 из 10» перестаёт значить «знает восемь», и преподаватель планирует
// урок по завышенной цифре.
// ============================================================================
import { useMemo, useState } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { answerMatches, normalizeAnswer } from '../lib/text'
import { mcqHint, mistakeHint, orderHint, shouldReveal } from '../lib/selfCorrect'
import type { GrammarExercise } from '../types'

/** Подсказка о месте ошибки — одинаковая на всех типах упражнений. */
function HintLine({ text }: { text: string }) {
  return (
    <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      {text} <span className="text-[var(--night-text-40)]">Попробуй ещё раз.</span>
    </p>
  )
}

/** «Показать ответ» — выход для того, кто застрял; не прячем его. */
function RevealButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="self-start text-sm font-medium text-[var(--night-accent-text)]"
    >
      Показать ответ
    </button>
  )
}

/** Итог после верного ответа. Со второй попытки — так и пишем. */
function CorrectLine({ attempts }: { attempts: number }) {
  return (
    <p className="animate-answer-pop text-sm font-semibold text-emerald-400">
      {attempts > 1 ? 'Верно — со второй попытки ✓' : 'Верно! ✓'}
    </p>
  )
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

// correctAnswerText переехал в lib/text.ts — им пользуются и разбор работ,
// и предпросмотр материала; правило «как выглядит верный ответ» должно быть одно.
export { correctAnswerText } from '../lib/text'

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
  // Все неверные варианты, которые человек уже перебрал.
  const [wrong, setWrong] = useState<number[]>([])
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const done = solved || revealed
  const attempts = wrong.length + (solved ? 1 : 0)

  const choose = (i: number) => {
    if (done || wrong.includes(i)) return
    const ok = i === exercise.answer
    // ⚠️ Балл — по первой попытке: колбэки срабатывают один раз.
    if (attempts === 0) {
      onAnswered(ok)
      onGiven?.(exercise.options[i] ?? '')
    }
    if (ok) {
      setSolved(true)
      return
    }
    const next = [...wrong, i]
    setWrong(next)
    // после второй ошибки прятать ответ уже незачем — иначе это не обучение,
    // а угадайка по кругу
    if (shouldReveal(next.length)) setRevealed(true)
  }

  // короткие варианты (слова) — сеткой 2×2, длинные фразы — столбиком
  const compact = exercise.options.every((o) => o.length <= 16)
  const left = exercise.options.length - wrong.length

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
        {exercise.options.map((opt, i) => {
          const isAnswer = i === exercise.answer
          const isWrong = wrong.includes(i)
          let cls = 'border-white/[0.10] hover:border-[var(--night-accent-45)]'
          // ⚠️ Правильный вариант подсвечиваем ТОЛЬКО когда всё кончено. Пока
          // идёт вторая попытка, зелёная рамка была бы тем же готовым ответом.
          if (isWrong) cls = 'border-red-500 bg-red-950/40 opacity-60'
          else if (done) {
            if (isAnswer) cls = 'border-emerald-500 bg-emerald-950/40'
            else cls = 'border-white/[0.08] opacity-60'
          }
          // «клевок» только когда человек нашёл ответ сам
          const pop = solved && isAnswer ? ' animate-answer-pop' : ''
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={done || isWrong}
              className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${cls}${pop}`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {!done && wrong.length > 0 && <HintLine text={mcqHint(left)} />}
      {!done && wrong.length > 0 && <RevealButton onClick={() => setRevealed(true)} />}
      {solved && <CorrectLine attempts={attempts} />}
      {done && <NextButton onNext={onNext} isLast={isLast} />}
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
  const [attempts, setAttempts] = useState(0)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const done = solved || revealed

  // варианты через «/» («was/were») принимаются любым из значений
  const ok = answerMatches(value, exercise.answer)

  const check = () => {
    if (done || !value.trim()) return
    const n = attempts + 1
    setAttempts(n)
    // ⚠️ Балл — по первой попытке (см. шапку файла).
    if (attempts === 0) {
      onAnswered(ok)
      onGiven?.(value.trim())
    }
    if (ok) {
      setSolved(true)
      return
    }
    // Первая ошибка — говорим ГДЕ, ответ придержим. Вторая — показываем.
    if (shouldReveal(n)) setRevealed(true)
    else setHint(mistakeHint(value, exercise.answer))
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-medium">{exercise.prompt}</p>
      <input
        className={`w-full rounded-lg border bg-[var(--night-input)] px-3 py-2 outline-none ${
          done
            ? solved
              ? 'border-emerald-500'
              : 'border-red-500'
            : hint
              ? 'border-amber-500'
              : 'border-white/[0.10] focus:border-[var(--night-accent-45)]'
        }`}
        placeholder="Твой ответ…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setHint(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && check()}
        disabled={done}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Подсказка автора задания — как была, до первой проверки. */}
      {!done && attempts === 0 && exercise.hint && (
        <button
          onClick={() => setShowHint((s) => !s)}
          className="self-start text-xs font-semibold text-[var(--night-accent-text)]"
        >
          {showHint ? 'скрыть подсказку' : 'подсказка'}
        </button>
      )}
      {!done && attempts === 0 && showHint && exercise.hint && (
        <p className="text-sm text-[var(--night-text-40)]">{exercise.hint}</p>
      )}

      {!done && hint && <HintLine text={hint} />}
      {!done && attempts > 0 && <RevealButton onClick={() => setRevealed(true)} />}

      {done && !solved && (
        <p className="text-sm">
          <span className="text-red-500">Верный ответ: </span>
          <span className="font-semibold text-emerald-400">{exercise.answer}</span>
        </p>
      )}
      {solved && <CorrectLine attempts={attempts} />}

      {done ? (
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
      // Fisher–Yates: i и j всегда валидные индексы arr — элементы точно есть
      const tmp = arr[i]!
      arr[i] = arr[j]!
      arr[j] = tmp
    }
    return arr
  }, [exercise])

  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  const [attempts, setAttempts] = useState(0)
  const [solved, setSolved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const checked = solved || revealed

  const usedIdx = new Set(built.map((b) => b.i))
  // сравниваем нормализованно: расхождение регистра/диакритики в данных
  // не должно превращать верный порядок в «неверно»
  const ok =
    built.length === exercise.answer.length &&
    built.every((b, i) => normalizeAnswer(b.w) === normalizeAnswer(exercise.answer[i] ?? ''))

  const check = () => {
    if (checked || built.length !== exercise.words.length) return
    const n = attempts + 1
    setAttempts(n)
    // ⚠️ Балл — по первой попытке (см. шапку файла).
    if (attempts === 0) {
      onAnswered(ok)
      onGiven?.(built.map((b) => b.w).join(' '))
    }
    if (ok) {
      setSolved(true)
      return
    }
    if (shouldReveal(n)) setRevealed(true)
    else setHint(orderHint(built.map((b) => b.w), exercise.answer))
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
              нажимай слова снизу по порядку
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
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              usedIdx.has(item.i)
                ? 'border-white/[0.06] text-[var(--night-text-40)]' // использованное слово — приглушено
                : 'border-white/[0.10] active:scale-[0.97]'
            }`}
          >
            {item.w}
          </button>
        ))}
      </div>

      {!checked && hint && <HintLine text={hint} />}
      {!checked && attempts > 0 && <RevealButton onClick={() => setRevealed(true)} />}

      {revealed && !solved && (
        <p className="text-sm">
          <span className="text-red-500">Правильно: </span>
          <span className="font-semibold text-emerald-400">{exercise.answer.join(' ')}</span>
        </p>
      )}
      {solved && <CorrectLine attempts={attempts} />}

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
            <Button
              variant="ghost"
              onClick={() => {
                setBuilt([])
                setHint(null)
              }}
            >
              Сброс
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
