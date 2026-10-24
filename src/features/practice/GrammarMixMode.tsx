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
import { RoundResult } from '../../components/RoundResult'
import { ExerciseView } from '../../components/exercises'
import { useExerciseReview } from '../../components/useExerciseReview'
import { logActivity } from '../../lib/activity'
import { addMistake, removeMistake } from '../../lib/mistakes'
import { getUserLevel } from '../../lib/level'
import { shuffle } from '../../lib/wordPool'
import { KEY_EXIT, RoundFrame, type RoundKey } from '../../shared/ui/RoundFrame'
import type { AppLang, GrammarExercise, GrammarTopic } from '../../types'
import { Loading } from '../../shared/ui/Loading'
import { useAsyncData } from '../../shared/lib/useAsyncData'
import { LoadError } from '../../shared/ui/LoadError'

const ROUND = 8
const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export type GrammarGameKind = 'mcq' | 'fill' | 'order'

/** Клавиши раунда сбоку (d5): у «Выбери форму» — варианты 1–4. */
const KEYS: Record<GrammarGameKind | 'mix', RoundKey[]> = {
  mcq: [{ keys: ['1', '4'], range: true, label: 'выбрать' }, { keys: ['Enter'], label: 'дальше' }, KEY_EXIT],
  fill: [{ keys: ['Enter'], label: 'проверить, дальше' }, KEY_EXIT],
  order: [{ keys: ['Enter'], label: 'проверить, дальше' }, KEY_EXIT],
  mix: [{ keys: ['Enter'], label: 'проверить, дальше' }, KEY_EXIT],
}

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

  const keys = KEYS[kind ?? 'mix']
  const answers = review.results.map((r) => r.ok)
  if (!items) {
    return (
      <RoundFrame title={title} at={null} total={null} results={[]} keys={keys} onExit={onBack}>
        {topicsError ? <LoadError message={topicsError} onRetry={reloadTopics} /> : <Loading label="Готовим раунд" />}
      </RoundFrame>
    )
  }

  if (items.length === 0) {
    return (
      <RoundFrame title={title} at={null} total={null} results={[]} keys={keys} onExit={onBack}>
        <Card className="text-center">
          <p className="font-semibold">Уроков для этого уровня пока нет</p>
          <p className="mt-1 text-sm text-fg-muted">
            Загляни во вкладку «Учёба» → «Грамматика».
          </p>
        </Card>
      </RoundFrame>
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
      <RoundFrame title={title} at={items.length} total={items.length} results={answers} keys={keys} onExit={onBack}>
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
      </RoundFrame>
    )
  }

  return (
    <RoundFrame title={title} at={index + 1} total={items.length} results={answers} keys={keys} onExit={onBack}>
      <p className="text-sm text-fg-muted">Тема: {current.topicTitle}</p>
      <ExerciseView
        key={`${current.topicId}-${current.ex}-${index}`}
        exercise={current.exercise}
        {...review.handlers(current.exercise, onAnswered)}
        onNext={next}
        isLast={index + 1 >= items.length}
      />
    </RoundFrame>
  )
}
