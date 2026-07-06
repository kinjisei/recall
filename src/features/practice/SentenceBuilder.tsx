// «Собери предложение»: по русскому переводу собери испанскую фразу из слов.
import { useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { spanishSentences } from '../../data/spanish'
import { Header } from './MatchGame'
import { normalize, sample, shuffle } from './util'

const ROUNDS = 8

interface Task {
  ru: string
  es: string
  words: string[]
}

export function SentenceBuilder({ onBack }: { onBack: () => void }) {
  const [seed, setSeed] = useState(0)

  const tasks = useMemo<Task[]>(() => {
    // Берём короткие фразы (до 8 слов) — их приятнее собирать.
    const pool = spanishSentences.filter(
      (s) => s.es.trim().split(/\s+/).length <= 8,
    )
    return sample(pool, ROUNDS).map((s) => ({
      ru: s.ru,
      es: s.es,
      words: s.es.trim().split(/\s+/),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)

  const task = tasks[index]

  const onResult = (ok: boolean) => {
    if (ok) setCorrect((c) => c + 1)
  }
  const next = () => {
    if (index + 1 >= tasks.length) {
      setDone(true)
      void logActivity('practice')
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (done) {
    const percent = Math.round((correct / tasks.length) * 100)
    return (
      <div className="flex flex-col gap-4">
        <Header title="🧱 Собери предложение" onBack={onBack} />
        <Card className="text-center">
          <p className="text-4xl">{percent >= 80 ? '🎉' : percent >= 50 ? '👍' : '💪'}</p>
          <p className="mt-2 text-lg font-bold">
            {correct} из {tasks.length} ({percent}%)
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setIndex(0)
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
      <Header title="🧱 Собери предложение" onBack={onBack} />
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>
          {index + 1} / {tasks.length}
        </span>
        <span>верно: {correct}</span>
      </div>
      <BuildTask key={index} task={task} onResult={onResult} onNext={next} isLast={index + 1 >= tasks.length} />
    </div>
  )
}

function BuildTask({
  task,
  onResult,
  onNext,
  isLast,
}: {
  task: Task
  onResult: (ok: boolean) => void
  onNext: () => void
  isLast: boolean
}) {
  const shuffled = useMemo(
    () => task.words.map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5),
    [task],
  )
  const [built, setBuilt] = useState<{ w: string; i: number }[]>([])
  const [checked, setChecked] = useState(false)

  const used = new Set(built.map((b) => b.i))
  const ok = normalize(built.map((b) => b.w).join(' ')) === normalize(task.es)

  const check = () => {
    if (checked || built.length !== task.words.length) return
    setChecked(true)
    onResult(ok)
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">Переведите на испанский:</p>
      <p className="text-lg font-medium">{task.ru}</p>

      <div
        className={`min-h-[48px] rounded-lg border-2 border-dashed p-2 ${
          checked ? (ok ? 'border-emerald-500' : 'border-red-500') : 'border-slate-300 dark:border-slate-600'
        }`}
      >
        <div className="flex flex-wrap gap-2">
          {built.map((b, i) => (
            <button
              key={i}
              onClick={() => !checked && setBuilt((arr) => arr.filter((_, j) => j !== i))}
              disabled={checked}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm text-white"
            >
              {b.w}
            </button>
          ))}
          {built.length === 0 && (
            <span className="px-1 py-1 text-sm text-slate-400">нажимайте слова снизу по порядку</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {shuffled.map((item) => (
          <button
            key={item.i}
            onClick={() => !checked && setBuilt((arr) => [...arr, item])}
            disabled={checked || used.has(item.i)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              used.has(item.i)
                ? 'border-slate-200 text-slate-300 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {item.w}
          </button>
        ))}
      </div>

      {checked && (
        <div className="flex items-center gap-2 text-sm">
          {ok ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Верно! ✓</span>
          ) : (
            <span>
              <span className="text-red-500">Правильно: </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{task.es}</span>
            </span>
          )}
          <button
            onClick={() => speak(task.es, { lang: 'es' })}
            className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-700"
            aria-label="Озвучить"
          >
            🔊
          </button>
        </div>
      )}

      {checked ? (
        <Button onClick={onNext}>{isLast ? 'Завершить' : 'Дальше →'}</Button>
      ) : (
        <div className="flex gap-2">
          <Button onClick={check} disabled={built.length !== task.words.length} className="flex-1">
            Проверить
          </Button>
          {built.length > 0 && (
            <Button variant="ghost" onClick={() => setBuilt([])}>
              Сброс
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
