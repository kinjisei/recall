// ============================================================================
// Placement-тест (испанский): определяет уровень A1–B2 по коротким вопросам.
// Результат сохраняется в localStorage (см. lib/esLevel) и используется в
// «Диалоге» и как ориентир на дашборде. Правильность по ходу НЕ показываем —
// это оценка, а не упражнение.
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ArrowLeftIcon, SparkleIcon } from '@phosphor-icons/react'
import { setEsLevel } from '../../lib/esLevel'
import type { CEFRLevel, PlacementQuestion } from '../../types'

const LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2']
const PER_LEVEL = 5
const PASS = 0.6

function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Считает уровень: высший, где доля верных >= 60% и все нижние тоже пройдены. */
function scoreLevel(
  questions: PlacementQuestion[],
  answers: Record<number, number>,
): CEFRLevel {
  let result: CEFRLevel = 'A1'
  for (const level of LEVELS) {
    const qs = questions.filter((q) => q.level === level)
    if (qs.length === 0) continue
    const correct = qs.filter((q) => answers[q.id] === q.answer).length
    if (correct / qs.length >= PASS) result = level
    else break
  }
  return result
}

export function PlacementTest() {
  const navigate = useNavigate()
  const [all, setAll] = useState<PlacementQuestion[] | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let alive = true
    import('../../data/spanish/placement').then((m) => {
      if (alive) setAll(m.placementQuestions)
    })
    return () => {
      alive = false
    }
  }, [])

  // По 5 случайных вопросов на уровень.
  const questions = useMemo(() => {
    if (!all) return []
    const picked: PlacementQuestion[] = []
    for (const level of LEVELS) {
      picked.push(...shuffle(all.filter((q) => q.level === level)).slice(0, PER_LEVEL))
    }
    return picked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, started])

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [done, setDone] = useState(false)

  const back = () => navigate('/')

  if (!all) {
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      </div>
    )
  }

  // Интро
  if (!started) {
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-sky-600/30">
            <SparkleIcon size={30} weight="fill" />
          </div>
          <h1 className="text-2xl font-bold">Тест уровня испанского</h1>
          <p className="max-w-sm text-[var(--night-text-40)]">
            {LEVELS.length * PER_LEVEL} коротких вопросов от простого к сложному.
            Определим твой уровень (A1–B2) — он подстроит «Диалог» под тебя.
          </p>
        </div>
        <Button onClick={() => setStarted(true)}>Начать тест</Button>
      </div>
    )
  }

  // Результат
  if (done) {
    const level = scoreLevel(questions, answers)
    return (
      <div className="flex flex-col gap-4">
        <TopBack onBack={back} />
        <Card className="items-center text-center">
          <p className="text-sm text-[var(--night-text-40)]">Твой уровень</p>
          <p className="my-2 text-5xl font-bold text-[var(--night-accent-text)]">{level}</p>
          <p className="text-sm text-[var(--night-text-40)]">
            {level === 'A1'
              ? 'Начинаем с самых основ — это нормально!'
              : level === 'B2'
                ? 'Отличный уровень — будем поддерживать и расширять.'
                : 'Хорошая база — есть куда расти.'}
          </p>
        </Card>
        <Button
          onClick={() => {
            setEsLevel(level)
            navigate('/')
          }}
        >
          Сохранить уровень
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAnswers({})
            setIndex(0)
            setDone(false)
            setStarted(false)
          }}
        >
          Пройти заново
        </Button>
      </div>
    )
  }

  // Вопрос
  const q = questions[index]
  const total = questions.length
  const choose = (optIndex: number) => {
    setAnswers((a) => ({ ...a, [q.id]: optIndex }))
    if (index + 1 >= total) setDone(true)
    else setIndex((i) => i + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <TopBack onBack={back} />

      {/* Прогресс */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-[var(--night-text-40)]">
          <span>Вопрос {index + 1} из {total}</span>
          <span>{q.level}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-brand-gradient transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <Card key={index} className="flex animate-fade-in flex-col gap-3">
        <p className="text-lg font-medium">{q.prompt}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => choose(i)}
              className="rounded-xl border border-white/[0.10] px-4 py-2.5 text-left transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-white/[0.10] dark:hover:bg-sky-950/40"
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function TopBack({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex w-fit items-center gap-1 text-sm font-medium text-[var(--night-text-40)] hover:text-[var(--night-text-70)] dark:text-[var(--night-text-40)] dark:hover:text-slate-200"
    >
      <ArrowLeftIcon size={16} /> На главную
    </button>
  )
}
