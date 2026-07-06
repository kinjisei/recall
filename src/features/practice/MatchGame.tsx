// «Подбери пару»: сопоставь испанское слово с русским переводом.
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { loadWordPool, sample, shuffle, type PoolWord } from './util'

const PAIRS = 6

interface Item {
  id: number
  word: PoolWord
}

export function MatchGame({ onBack }: { onBack: () => void }) {
  const [pool, setPool] = useState<PoolWord[] | null>(null)

  useEffect(() => {
    let alive = true
    loadWordPool().then((p) => alive && setPool(p))
    return () => {
      alive = false
    }
  }, [])

  if (!pool) return <Loading onBack={onBack} />
  return <MatchRound pool={pool} onBack={onBack} />
}

function MatchRound({ pool, onBack }: { pool: PoolWord[]; onBack: () => void }) {
  const [seed, setSeed] = useState(0)
  const round = useMemo<Item[]>(
    () => sample(pool, PAIRS).map((word, id) => ({ id, word })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool, seed],
  )
  const left = useMemo(() => shuffle(round), [round])
  const right = useMemo(() => shuffle(round), [round])

  const [selected, setSelected] = useState<number | null>(null)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<number | null>(null)

  const complete = matched.size === round.length
  useEffect(() => {
    if (complete) void logActivity('practice')
  }, [complete])

  const pickRight = (id: number) => {
    if (selected === null || matched.has(id)) return
    if (id === selected) {
      setMatched((m) => new Set(m).add(id))
      setSelected(null)
    } else {
      setWrong(id)
      setTimeout(() => setWrong(null), 400)
      setSelected(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Header title="🧩 Подбери пару" onBack={onBack} />

      {complete ? (
        <Card className="text-center">
          <p className="text-4xl">🎉</p>
          <p className="mt-2 font-semibold">Все пары найдены!</p>
          <Button className="mt-4" onClick={() => {
            setMatched(new Set())
            setSelected(null)
            setSeed((s) => s + 1)
          }}>
            Ещё раунд
          </Button>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Нажми слово слева, затем его перевод справа.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              {left.map((it) => {
                const done = matched.has(it.id)
                const sel = selected === it.id
                return (
                  <button
                    key={it.id}
                    onClick={() => {
                      if (done) return
                      setSelected(it.id)
                      speak(it.word.es, { lang: 'es' })
                    }}
                    disabled={done}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      done
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : sel
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                          : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {it.word.es}
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-2">
              {right.map((it) => {
                const done = matched.has(it.id)
                const isWrong = wrong === it.id
                return (
                  <button
                    key={it.id}
                    onClick={() => pickRight(it.id)}
                    disabled={done}
                    className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      done
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : isWrong
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/40'
                          : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {it.word.ru}
                  </button>
                )
              })}
            </div>
          </div>
          <p className="text-center text-sm text-slate-400">
            Найдено: {matched.size} / {round.length}
          </p>
        </>
      )}
    </div>
  )
}

export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
        ← Назад
      </Button>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}

export function Loading({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Header title="Практика" onBack={onBack} />
      <p className="text-slate-500">Загрузка…</p>
    </div>
  )
}
