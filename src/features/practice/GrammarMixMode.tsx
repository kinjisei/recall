// ============================================================================
// Грамматические мини-игры: раунд из 8 случайных упражнений из уроков не выше
// уровня пользователя (ES — placement/localStorage, EN — профиль; уровень
// неизвестен — берём A1–A2, чтобы не пугать новичка).
// kind делит игры по типу задания: mcq — «Выбери форму», fill — «Впиши слово»,
// order — «Собери предложение»; без kind — микс всех типов.
// Ошибка кладёт упражнение в банк «Мои ошибки», верный ответ — убирает.
// ============================================================================
import { useEffect, useState } from 'react'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { ExerciseView } from '../../components/exercises'
import { useExerciseReview } from '../../components/useExerciseReview'
import { logActivity } from '../../lib/activity'
import { addMistake, removeMistake } from '../../lib/mistakes'
import { getUserLevel } from '../../lib/level'
import { shuffle } from '../../lib/wordPool'
import { GameHeader } from '../words/GameShell'
import type { AppLang, GrammarExercise, GrammarTopic } from '../../types'
import { Loading } from '../../shared/ui/Loading'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { LoadError } from '../../shared/ui/LoadError'

const ROUND = 8
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export type GrammarGameKind = 'mcq' | 'fill' | 'order'

const TITLES: Record<GrammarGameKind | 'mix', string> = {
  mcq: 'Выбери форму',
  fill: 'Впиши слово',
  order: 'Собери предложение',
  mix: 'Микс упражнений',
}

interface Item {
  topicId: number
  topicTitle: string
  ex: number
  exercise: GrammarExercise
}

function buildRound(
  topics: GrammarTopic[],
  level: string | null,
  kind?: GrammarGameKind,
): Item[] {
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
  const filtered = kind ? all.filter((i) => i.exercise.type === kind) : all
  return shuffle(filtered).slice(0, ROUND)
}

export function GrammarMixMode({
  lang,
  kind,
  onBack,
}: {
  lang: AppLang
  kind?: GrammarGameKind
  onBack: () => void
}) {
  const title = TITLES[kind ?? 'mix']
  // ленивый кусок данных: без сети и не скачан — плашка, а не вечная заглушка (Ф1.13)
  const { data: topics, error: topicsError, reload: reloadTopics } = useAsyncData<GrammarTopic[]>(
    () => (lang === 'es' ? import('../../data/spanish/grammar') : import('../../data/english/grammar')).then((m) => m.grammarTopics),
    [lang],
    'Упражнения не загрузились',
  )
  const [level, setLevel] = useState<string | null | undefined>(undefined)
  const [items, setItems] = useState<Item[] | null>(null)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const review = useExerciseReview()

  useEffect(() => {
    let alive = true
    getUserLevel(lang).then((l) => alive && setLevel(l))
    return () => {
      alive = false
    }
  }, [lang])

  useEffect(() => {
    if (topics && level !== undefined && !items) setItems(buildRound(topics, level, kind))
  }, [topics, level, items, kind])

  useEffect(() => {
    if (done) void logActivity('grammar')
  }, [done])

  if (!items) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={title} onBack={onBack} />
        {topicsError ? <LoadError message={topicsError} onRetry={reloadTopics} /> : <Loading label="Готовим раунд" />}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={title} onBack={onBack} />
        <Card className="text-center">
          <p className="font-semibold">Уроков для этого уровня пока нет</p>
          <p className="mt-1 text-sm text-fg-muted">
            Загляни во вкладку «Учёба» → «Грамматика».
          </p>
        </Card>
      </div>
    )
  }

  const current = items[index]

  // items.length > 0 гарантирован проверкой выше; index всегда в границах
  // [0, items.length-1] (next() увеличивает его только пока index+1 < items.length)
  // — подстраховка для noUncheckedIndexedAccess.
  if (!current) return null

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
        <GameHeader title={title} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={items.length}
          review={review.results}
          lang={lang}
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
            review.reset()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <GameHeader title={title} onBack={onBack} />
      <RoundProgress index={index + 1} total={items.length} correct={correct} progressLabel="Упражнение" />
      <p className="text-sm text-fg-muted">Тема: {current.topicTitle}</p>
      <ExerciseView
        key={`${current.topicId}-${current.ex}-${index}`}
        exercise={current.exercise}
        {...review.handlers(current.exercise, onAnswered)}
        onNext={next}
        isLast={index + 1 >= items.length}
      />
      <Button variant="ghost" className="self-center px-3 py-1 text-sm" onClick={onBack}>
        Завершить досрочно
      </Button>
    </div>
  )
}
