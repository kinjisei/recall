// «Аудирование»: слушаешь испанскую фразу — выбираешь её русский перевод.
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { spanishSentences } from '../../data/spanish'
import { Header } from './MatchGame'
import { sample, shuffle } from './util'

const QUESTIONS = 8
const OPTIONS = 4

interface Question {
  es: string
  ru: string
  options: string[]
}

export function ListeningGame({ onBack }: { onBack: () => void }) {
  const [seed, setSeed] = useState(0)
  const questions = useMemo<Question[]>(() => {
    const picked = sample(spanishSentences, QUESTIONS)
    return picked.map((s) => {
      const distractors = sample(
        spanishSentences.filter((x) => x.ru !== s.ru),
        OPTIONS - 1,
      ).map((x) => x.ru)
      return { es: s.es, ru: s.ru, options: shuffle([s.ru, ...distractors]) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[index]

  // Автоозвучка при каждом новом вопросе.
  useEffect(() => {
    if (q) speak(q.es, { lang: 'es' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, seed])

  const choose = (opt: string) => {
    if (picked !== null) return
    setPicked(opt)
    if (opt === q.ru) setCorrect((c) => c + 1)
  }
  const next = () => {
    if (index + 1 >= questions.length) {
      setDone(true)
      void logActivity('practice')
    } else {
      setIndex((i) => i + 1)
      setPicked(null)
    }
  }

  if (done) {
    const percent = Math.round((correct / questions.length) * 100)
    return (
      <div className="flex flex-col gap-4">
        <Header title="🎧 Аудирование" onBack={onBack} />
        <Card className="text-center">
          <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
          <p className="mt-2 text-lg font-bold">
            {correct} из {questions.length} ({percent}%)
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setIndex(0)
              setPicked(null)
              setCorrect(0)
              setDone(false)
              setSeed((s) => s + 1)
            }}
          >
            Ещё раз
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="🎧 Аудирование" onBack={onBack} />
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {index + 1} / {questions.length}
        </span>
        <span>верно: {correct}</span>
      </div>

      <Card className="items-center text-center">
        <p className="text-sm text-slate-400">Что вы услышали?</p>
        <button
          onClick={() => speak(q.es, { lang: 'es' })}
          className="mt-2 rounded-full bg-sky-600 px-6 py-3 text-2xl text-white"
          aria-label="Повторить озвучку"
        >
          🔊
        </button>
        <p className="mt-2 text-xs text-slate-400">нажми, чтобы прослушать снова</p>
        {picked !== null && (
          <p className="mt-2 font-medium text-slate-600 dark:text-slate-300">«{q.es}»</p>
        )}
      </Card>

      <div className="flex flex-col gap-2">
        {q.options.map((opt) => {
          const isAnswer = opt === q.ru
          const isPicked = opt === picked
          let cls = 'border-slate-300 dark:border-slate-600 hover:border-sky-400'
          if (picked !== null) {
            if (isAnswer) cls = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
            else if (isPicked) cls = 'border-red-500 bg-red-50 dark:bg-red-950/40'
            else cls = 'border-slate-200 dark:border-slate-700 opacity-60'
          }
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={picked !== null}
              className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${cls}`}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {picked !== null && (
        <Button onClick={next}>{index + 1 >= questions.length ? 'Завершить' : 'Дальше →'}</Button>
      )}
    </div>
  )
}
