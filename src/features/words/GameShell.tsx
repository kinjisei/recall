// Общие кусочки интерфейса мини-игр: шапка со «← Назад», загрузка,
// заглушка «мало слов» и универсальный движок вопросов с 4 вариантами.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSpeaker, IconTray } from '../../shared/ui/icons'
import { BackHeader } from '../../shared/ui/BackButton'
import { Card } from '../../shared/ui/Card'
import { Button } from '../../shared/ui/Button'
import { useRoundKeys } from '../../shared/ui/roundKeys'
import { RoundResult, RoundProgress } from '../../components/RoundResult'
import type { ReviewItem } from '../../components/RoundReview'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { markWrong } from './gameUtils'
import type { PoolItem } from '../../lib/wordPool'
import type { AppLang } from '../../types'
import { Loading } from '../../shared/ui/Loading'

export function GameHeader({ title, onBack }: { title: string; onBack: () => void }) {
  // morph: если сюда пришли тапом по плитке «Практики», заголовок и плитка —
  // один элемент перехода, и экран вырастает из неё (shared/lib/morph.ts)
  return <BackHeader onBack={onBack} title={title} morph />
}

export function GameLoading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <Loading label="Готовим раунд" />
    </div>
  )
}

export function EmptyPool({ title, onBack }: { title: string; onBack: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <Card className="items-center text-center">
        <IconTray size={40} className="text-fg-faint" />
        <p className="mt-2 font-semibold">Пока мало слов для игры</p>
        <p className="mt-1 text-sm text-fg-muted">
          Возьми готовый набор по уровню — или тапни по незнакомому слову в
          любом тексте.
        </p>
        {/* Кнопка ведёт ТУДА, ЧТО ОБЕЩАЕТ. Такая же была в пустой колоде и
            уже починена; эта осталась второй копией того же класса — вела на
            корень «Учёбы», где до слов ещё два тапа. */}
        <Button className="mt-4" onClick={() => navigate('/study?view=words&sheet=packs')}>
          Добавить первые слова
        </Button>
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
  // ответы раунда для «Посмотреть результаты» (разбор с «Почему?»)
  const [results, setResults] = useState<ReviewItem[]>([])

  const q = questions[index]
  const done = index >= questions.length

  // аудирование: произносим слово при появлении вопроса
  useEffect(() => {
    if (q?.say) speak(q.say, { lang })
  }, [q, lang])

  useEffect(() => {
    if (done) void logActivity('practice')
  }, [done])

  const choose = (i: number) => {
    if (!q || picked !== null || i >= q.options.length) return
    setPicked(i)
    const ok = i === q.answer
    setResults((r) => [
      ...r,
      {
        prompt: q.prompt || q.say || '',
        given: q.options[i] ?? '',
        correct: q.options[q.answer] ?? '',
        ok,
      },
    ])
    if (ok) setCorrect((c) => c + 1)
    else markWrong(q.item, lang)
  }
  const advance = () => {
    setIndex((i) => i + 1)
    setPicked(null)
  }
  // 1–4 — вариант, Enter — «Дальше»; Esc — выход, его держит «Практика»
  // (shared/ui/roundKeys)
  useRoundKeys({ pick: choose, enter: () => picked !== null && advance() }, !done)

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={title} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={questions.length}
          review={results}
          lang={lang}
          note={
            correct < questions.length
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : undefined
          }
          onRestart={() => {
            setIndex(0)
            setPicked(null)
            setCorrect(0)
            setResults([])
            onRestart()
          }}
        />
      </div>
    )
  }

  // index < questions.length гарантирован веткой done выше — но компилятор
  // не связывает done и q, поэтому явный guard (в рантайме не сработает)
  if (!q) return null

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={title} onBack={onBack} />
      <RoundProgress index={index + 1} total={questions.length} correct={correct} />

      <Card className="flex flex-col gap-3">
        {q.say ? (
          <button
            onClick={() => speak(q.say!, { lang })}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg"
            aria-label="Прослушать ещё раз"
          >
            <IconSpeaker size={32} />
          </button>
        ) : (
          <p className="text-lg leading-relaxed">{q.prompt}</p>
        )}
        {q.say && q.prompt && <p className="text-center text-sm text-fg-muted">{q.prompt}</p>}

        <div className="grid gap-2">
          {q.options.map((opt, i) => {
            const isAnswer = i === q.answer
            const isPicked = picked === i
            const cls =
              picked === null
                ? 'border-white/[0.10] active:scale-[0.98]'
                : isAnswer
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : isPicked
                    ? 'border-red-500 bg-red-500/15 text-red-300'
                    : 'border-white/[0.08] opacity-60'
            // празднуем только собственный верный ответ (см. exercises.tsx)
            const pop = isPicked && isAnswer ? ' animate-answer-pop' : ''
            return (
              <button
                key={i}
                data-key={i + 1}
                onClick={() => choose(i)}
                disabled={picked !== null}
                className={`rounded-xl border px-3 py-2.5 text-left transition-[transform,background-color,border-color,color] duration-150 ${cls}${pop}`}
              >
                {opt}
              </button>
            )
          })}
        </div>

        {picked !== null && (
          <Button onClick={advance}>
            {index + 1 >= questions.length ? 'Итоги' : 'Дальше →'}
          </Button>
        )}
      </Card>

      {picked === null && <p className="text-center text-sm text-fg-muted">{hint}</p>}
    </div>
  )
}
