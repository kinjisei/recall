// ============================================================================
// Общий движок упражнений (mcq / fill / order) — используется грамматикой
// и материалами преподавателя. Перенесён из features/grammar/GrammarPage.
// onGiven — необязательный колбэк: каким был ответ ученика (для проверки
// учителем в материалах).
//
// Вид — детали упражнения по макету d5 (shared/ui/roundParts): варианты с
// номером клавиши и состоянием, поле и фишки в том же языке, итог «Верно! /
// Не совсем» и главная кнопка внизу. В уроке и материале упражнение — в
// карточке; в раунде «Практики» (`bare`) — без неё, в рамке раунда
// (Ф2.17-4д-4б).
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
import { useMemo, useState, type ReactNode } from 'react'
import { Card } from '../shared/ui/Card'
import { Button } from '../shared/ui/Button'
import { useRoundKeys } from '../shared/ui/roundKeys'
import { MistakeHint, RevealAnswer, RoundBuild, RoundFeedback, RoundFooter, RoundHint, RoundOption, RoundPrompt, type OptionState } from '../shared/ui/roundParts'
import { answerMatches, normalizeAnswer } from '../lib/text'
import { mcqHint, mistakeHint, orderHint, shouldReveal } from '../lib/selfCorrect'
import type { GrammarExercise } from '../types'

export interface ExerciseCallbacks {
  onAnswered: (ok: boolean) => void
  onGiven?: (given: string) => void
  onNext: () => void
  isLast: boolean
  /** Без карточки — внутри рамки раунда «Практики» (d5). */
  bare?: boolean
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

/** Карточка в уроке и материале, без неё — в раунде «Практики». */
function Shell({ bare, children }: { bare?: boolean; children: ReactNode }) {
  return bare ? <div className="flex flex-col gap-3">{children}</div> : <Card className="flex flex-col gap-3">{children}</Card>
}

function NextButton({ onNext, isLast }: { onNext: () => void; isLast: boolean }) {
  return (
    <Button className="flex-none @xl/round:px-5.5!" onClick={onNext}>
      {isLast ? 'Завершить' : 'Дальше'}
    </Button>
  )
}

/** Итог верного ответа. Со второй попытки — так и пишем. */
function Solved({ attempts }: { attempts: number }) {
  return <RoundFeedback ok title={attempts > 1 ? 'Верно — со второй попытки!' : 'Верно!'} />
}

export function McqExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
  bare,
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
  // 1–4 — вариант, Enter — «Дальше» (shared/ui/roundKeys)
  useRoundKeys({ pick: (i) => i < exercise.options.length && choose(i), enter: () => done && onNext() })

  // короткие варианты (слова) — сеткой 2×2, длинные фразы — столбиком
  const compact = exercise.options.every((o) => o.length <= 16)
  const left = exercise.options.length - wrong.length
  // ⚠️ Правильный вариант подсвечиваем ТОЛЬКО когда всё кончено. Пока идёт
  // вторая попытка, зелёная рамка была бы тем же готовым ответом.
  const stateOf = (i: number): OptionState => {
    if (wrong.includes(i)) return 'bad'
    if (!done) return 'idle'
    return i === exercise.answer ? 'ok' : 'off'
  }

  return (
    <Shell bare={bare}>
      <RoundPrompt text={exercise.prompt} />
      <div className={`mt-2 ${compact ? 'grid grid-cols-2 gap-2.5' : 'flex flex-col gap-2.5'}`}>
        {exercise.options.map((opt, i) => (
          <RoundOption
            key={i}
            n={i + 1}
            state={stateOf(i)}
            mark={i === exercise.answer ? (solved ? 'Верно' : 'Правильно') : 'Твой ответ'}
            // «клевок» только когда человек нашёл ответ сам
            pop={solved && i === exercise.answer}
            disabled={done || wrong.includes(i)}
            onClick={() => choose(i)}
          >
            {opt}
          </RoundOption>
        ))}
      </div>

      {!done && wrong.length > 0 && <MistakeHint text={mcqHint(left)} />}
      {!done && wrong.length > 0 && <RevealAnswer onClick={() => setRevealed(true)} />}
      <RoundFooter>
        {solved ? <Solved attempts={attempts} /> : revealed ? <RoundFeedback ok={false} /> : <RoundHint>Выбери вариант</RoundHint>}
        {done && <NextButton onNext={onNext} isLast={isLast} />}
      </RoundFooter>
    </Shell>
  )
}

export function FillExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
  bare,
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
  // Enter в поле — «Проверить» (само поле); после ответа поле закрыто — «Дальше»
  useRoundKeys({ enter: () => done && onNext() })

  return (
    <Shell bare={bare}>
      <RoundPrompt text={exercise.prompt} />
      {/* поле — как вариант d5: поверхность и черта, итог — зелёным или красным */}
      <input
        className={`mt-2 min-h-14 w-full rounded-control px-4 text-lg text-fg outline-none placeholder:text-fg-muted @xl/round:min-h-15 ${
          done
            ? solved
              ? 'bg-success-soft inset-ring-2 inset-ring-success'
              : 'bg-danger-soft inset-ring-2 inset-ring-danger'
            : hint
              ? 'bg-surface inset-ring-2 inset-ring-warning'
              : 'bg-surface shadow-card inset-ring inset-ring-line focus:inset-ring-2 focus:inset-ring-focus'
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
        <button type="button" onClick={() => setShowHint((s) => !s)} className="min-h-11 self-start text-sm font-semibold text-accent-strong">
          {showHint ? 'скрыть подсказку' : 'подсказка'}
        </button>
      )}
      {!done && attempts === 0 && showHint && exercise.hint && <p className="text-sm text-fg-muted">{exercise.hint}</p>}

      {!done && hint && <MistakeHint text={hint} />}
      {!done && attempts > 0 && <RevealAnswer onClick={() => setRevealed(true)} />}

      <RoundFooter>
        {solved ? (
          <Solved attempts={attempts} />
        ) : revealed ? (
          <RoundFeedback ok={false}>Верный ответ: {exercise.answer}</RoundFeedback>
        ) : (
          <RoundHint>Впиши ответ и нажми Enter или «Проверить»</RoundHint>
        )}
        {done ? (
          <NextButton onNext={onNext} isLast={isLast} />
        ) : (
          <Button className="flex-none @xl/round:px-5.5!" onClick={check} disabled={!value.trim()}>
            Проверить
          </Button>
        )}
      </RoundFooter>
    </Shell>
  )
}

export function OrderExercise({
  exercise,
  onAnswered,
  onGiven,
  onNext,
  isLast,
  bare,
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
  useRoundKeys({ enter: () => (checked ? onNext() : check()) })

  return (
    <Shell bare={bare}>
      <RoundPrompt text={exercise.prompt} />
      <RoundBuild
        built={built}
        bank={shuffled}
        result={checked ? ok : null}
        onTake={(item) => setBuilt((arr) => [...arr, item])}
        onDrop={(i) => setBuilt((arr) => arr.filter((_, j) => j !== i))}
      />

      {!checked && hint && <MistakeHint text={hint} />}
      {!checked && attempts > 0 && <RevealAnswer onClick={() => setRevealed(true)} />}

      <RoundFooter>
        {solved ? (
          <Solved attempts={attempts} />
        ) : revealed ? (
          <RoundFeedback ok={false}>Правильно: {exercise.answer.join(' ')}</RoundFeedback>
        ) : (
          <RoundHint>Собери предложение и нажми «Проверить»</RoundHint>
        )}
        {checked ? (
          <NextButton onNext={onNext} isLast={isLast} />
        ) : (
          <div className="flex flex-none gap-2">
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
            <Button onClick={check} disabled={built.length !== exercise.words.length} className="flex-1 @xl/round:px-5.5!">
              Проверить
            </Button>
          </div>
        )}
      </RoundFooter>
    </Shell>
  )
}
