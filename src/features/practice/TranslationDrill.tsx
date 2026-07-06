// «Перевод»: показываем русское слово — выбери правильный испанский перевод.
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { Header, Loading } from './MatchGame'
import { loadWordPool, sample, shuffle, type PoolWord } from './util'

const QUESTIONS = 10
const OPTIONS = 4

interface Question {
  ru: string
  es: string
  options: string[]
}

export function TranslationDrill({ onBack }: { onBack: () => void }) {
  const [pool, setPool] = useState<PoolWord[] | null>(null)

  useEffect(() => {
    let alive = true
    loadWordPool().then((p) => alive && setPool(p))
    return () => {
      alive = false
    }
  }, [])

  if (!pool) return <Loading onBack={onBack} />
  return <Drill pool={pool} onBack={onBack} />
}

function Drill({ pool, onBack }: { pool: PoolWord[]; onBack: () => void }) {
  const [seed, setSeed] = useState(0)
  const questions = useMemo<Question[]>(() => {
    const picked = sample(pool, QUESTIONS)
    return picked.map((w) => {
      const distractors = sample(
        pool.filter((x) => x.es !== w.es),
        OPTIONS - 1,
      ).map((x) => x.es)
      return { ru: w.ru, es: w.es, options: shuffle([w.es, ...distractors]) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, seed])

  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[index]

  const choose = (opt: string) => {
    if (picked !== null) return
    setPicked(opt)
    if (opt === q.es) {
      setCorrect((c) => c + 1)
      speak(q.es, { lang: 'es' })
    }
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
        <Header title="🔤 Перевод" onBack={onBack} />
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
      <Header title="🔤 Перевод" onBack={onBack} />
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {index + 1} / {questions.length}
        </span>
        <span>верно: {correct}</span>
      </div>

      <Card className="items-center text-center">
        <p className="text-sm text-slate-400">Как по-испански:</p>
        <p className="text-2xl font-bold">{q.ru}</p>
      </Card>

      <div className="flex flex-col gap-2">
        {q.options.map((opt) => {
          const isAnswer = opt === q.es
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

      {picked !== null && <Button onClick={next}>
        {index + 1 >= questions.length ? 'Завершить' : 'Дальше →'}
      </Button>}
    </div>
  )
}
