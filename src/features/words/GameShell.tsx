// Общие кусочки интерфейса мини-игр: шапка со «← Назад», загрузка,
// заглушка «мало слов» и универсальный движок вопросов с 4 вариантами.
import { useEffect, useState } from 'react'
import { SpeakerHighIcon, TrayIcon } from '@phosphor-icons/react'
import { BackHeader } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { markWrong } from './gameUtils'
import type { PoolItem } from '../../lib/wordPool'
import type { AppLang } from '../../types'

export function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <BackHeader onBack={onBack} title={title} />
}

export function GameLoading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <p className="text-[var(--night-text-40)]">Готовлю раунд…</p>
    </div>
  )
}

export function EmptyPool({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <Card className="items-center text-center">
        <TrayIcon size={40} className="text-[var(--night-text-25)]" />
        <p className="mt-2 font-semibold">Пока мало слов для игры</p>
        <p className="mt-1 text-sm text-[var(--night-text-40)]">
          Добавь слова кнопкой «Паки» в шапке раздела «Практика» или тапая по словам в «Учёбе».
        </p>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Универсальный раунд «вопрос + 4 варианта» (Пропуск, Перевод, Аудирование).
// ---------------------------------------------------------------------------

export interface Question {
  /** Текст задания; для аудирования пустой — вместо него кнопка «слушать». */
  prompt: string
  options: string[]
  answer: number
  item: PoolItem
  /** Что произносить вслух (аудирование). */
  say?: string
}

export function QuizRunner({
  title,
  hint,
  questions,
  lang,
  onBack,
  onRestart,
}: {
  title: string
  hint: string
  questions: Question[]
  lang: AppLang
  onBack: () => void
  onRestart: () => void
}) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)

  const q = questions[index]
  const done = index >= questions.length

  // аудирование: произносим слово при появлении вопроса
  useEffect(() => {
    if (q?.say) speak(q.say, { lang })
  }, [q, lang])

  useEffect(() => {
    if (done) void logActivity('practice')
  }, [done])

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={title} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={questions.length}
          note={
            correct < questions.length
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : undefined
          }
          onRestart={() => {
            setIndex(0)
            setPicked(null)
            setCorrect(0)
            onRestart()
          }}
        />
      </div>
    )
  }

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    if (i === q.answer) setCorrect((c) => c + 1)
    else markWrong(q.item)
  }

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <RoundProgress index={index + 1} total={questions.length} correct={correct} />

      <Card className="flex flex-col gap-3">
        {q.say ? (
          <button
            onClick={() => speak(q.say!, { lang })}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--night-accent-900)] text-[var(--night-accent-100)]"
            aria-label="Прослушать ещё раз"
          >
            <SpeakerHighIcon size={32} weight="fill" />
          </button>
        ) : (
          <p className="text-lg leading-relaxed">{q.prompt}</p>
        )}
        {q.say && q.prompt && <p className="text-center text-sm text-[var(--night-text-40)]">{q.prompt}</p>}

        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer
            const isPicked = picked === i
            const cls =
              picked === null
                ? 'border-white/[0.10]'
                : isAnswer
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : isPicked
                    ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                    : 'border-white/[0.08] opacity-60 dark:border-white/[0.08]'
            return (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={picked !== null}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${cls}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {picked !== null && (
          <Button
            onClick={() => {
              setIndex((i) => i + 1)
              setPicked(null)
            }}
          >
            {index + 1 >= questions.length ? 'Итоги' : 'Дальше →'}
          </Button>
        )}
      </Card>

      {picked === null && <p className="text-center text-sm text-[var(--night-text-40)]">{hint}</p>}
    </div>
  )
}
