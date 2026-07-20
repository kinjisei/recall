// ============================================================================
// «Микс упражнений» — быстрый раунд грамматики: 8 случайных упражнений из
// уроков не выше уровня пользователя (ES — уровень из placement/localStorage,
// EN — из профиля; уровень неизвестен — берём A1–A2, чтобы не пугать новичка).
// Ошибка кладёт упражнение в банк «Мои ошибки», верный ответ — убирает.
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { ExerciseView } from '../../components/exercises'
import { logActivity } from '../../lib/activity'
import { addMistake, removeMistake } from '../../lib/mistakes'
import { getUserLevel } from '../../lib/level'
import { shuffle } from '../../lib/wordPool'
import { GameHeader } from '../words/GameShell'
import type { AppLang, GrammarExercise, GrammarTopic } from '../../types'

const ROUND = 8
const TITLE = 'Микс упражнений'
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

interface Item {
  topicId: number
  topicTitle: string
  ex: number
  exercise: GrammarExercise
}

function buildRound(topics: GrammarTopic[], level: string | null): Item[] {
  // не выше уровня пользователя; без уровня — только базовые A1–A2
  const cap = CEFR.indexOf(level ?? 'A2')
  const usable = topics.filter((t) => {
    const li = CEFR.indexOf(t.level)
    return li >= 0 && li <= (cap >= 0 ? cap : 1)
  })
  const all: Item[] = usable.flatMap((t) =>
    t.exercises.map((exercise, ex) => ({
      topicId: t.id,
      topicTitle: t.title,
      ex,
      exercise,
    })),
  )
  return shuffle(all).slice(0, ROUND)
}

export function GrammarMixMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [topics, setTopics] = useState<GrammarTopic[] | null>(null)
  const [level, setLevel] = useState<string | null | undefined>(undefined)
  const [items, setItems] = useState<Item[] | null>(null)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    const mod =
      lang === 'es' ? import('../../data/spanish/grammar') : import('../../data/english/grammar')
    mod.then((m) => alive && setTopics(m.grammarTopics))
    getUserLevel(lang).then((l) => alive && setLevel(l))
    return () => {
      alive = false
    }
  }, [lang])

  useEffect(() => {
    if (topics && level !== undefined && !items) setItems(buildRound(topics, level))
  }, [topics, level, items])

  useEffect(() => {
    if (done) void logActivity('grammar')
  }, [done])

  if (!items) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <p className="text-[var(--night-text-40)]">Готовлю раунд…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <Card className="text-center">
          <p className="font-semibold">Уроков для этого уровня пока нет</p>
          <p className="mt-1 text-sm text-[var(--night-text-40)]">
            Загляни во вкладку «Учёба» → «Грамматика».
          </p>
        </Card>
      </div>
    )
  }

  const current = items[index]

  const onAnswered = (ok: boolean) => {
    const ref = { topicId: current.topicId, ex: current.ex }
    if (ok) {
      setCorrect((c) => c + 1)
      removeMistake(lang, ref)
    } else {
      addMistake(lang, ref)
    }
  }

  const next = () => {
    if (index + 1 >= items.length) setDone(true)
    else setIndex((i) => i + 1)
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={items.length}
          note={
            correct < items.length
              ? 'Упражнения с ошибками ждут в «Моих ошибках».'
              : 'Раунд засчитан в серию дня.'
          }
          restartLabel="Ещё раунд"
          onRestart={() => {
            setItems(null)
            setIndex(0)
            setCorrect(0)
            setDone(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <GameHeader title={TITLE} onBack={onBack} />
      <RoundProgress index={index + 1} total={items.length} correct={correct} progressLabel="Упражнение" />
      <p className="text-sm text-[var(--night-text-40)]">Тема: {current.topicTitle}</p>
      <ExerciseView
        key={`${current.topicId}-${current.ex}-${index}`}
        exercise={current.exercise}
        onAnswered={onAnswered}
        onNext={next}
        isLast={index + 1 >= items.length}
      />
      <Button variant="ghost" className="self-center px-3 py-1 text-sm" onClick={onBack}>
        Завершить досрочно
      </Button>
    </div>
  )
}
