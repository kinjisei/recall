// ============================================================================
// «Match» — два столбца: слово и его ЗНАЧЕНИЕ.
//   EN: значение — английское определение (Free Dictionary → Gemini),
//       так слово запоминается через смысл, а не через русский перевод;
//   ES: значение — русский перевод (испанских толковых определений для
//       начинающего нет смысла показывать).
// Ошибка по слову из колоды возвращает карточку на повтор (FSRS «again»).
// ============================================================================
import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { getDefinitions } from '../../lib/definitions'
import { loadGamePool, type GamePool, type PoolItem } from '../../lib/wordPool'
import { markWrong, pickWords, shuffle } from './gameUtils'
import { GameHeader, GameLoading, EmptyPool } from './GameShell'
import type { AppLang } from '../../types'

const PAIRS = 6

interface Pair {
  id: number
  item: PoolItem
  meaning: string
}

export function MatchMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [pool, setPool] = useState<GamePool | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    loadGamePool(lang, PAIRS * 4)
      .then((p) => alive && setPool(p))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [lang])

  if (error) return <EmptyPool title="🧩 Значения" onBack={onBack} />
  if (!pool) return <GameLoading title="🧩 Значения" onBack={onBack} />
  if (pool.items.length < PAIRS) return <EmptyPool title="🧩 Значения" onBack={onBack} />
  return <MatchRound pool={pool} lang={lang} onBack={onBack} />
}

function MatchRound({
  pool,
  lang,
  onBack,
}: {
  pool: GamePool
  lang: AppLang
  onBack: () => void
}) {
  const [seed, setSeed] = useState(0)
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [wrong, setWrong] = useState<number | null>(null)
  const [mistakes, setMistakes] = useState(0)

  // Набираем раунд: для английского ждём определения (часть слов может их
  // не иметь — тогда берём следующие из пула).
  useEffect(() => {
    let alive = true
    setPairs(null)
    setSelected(null)
    setMatched(new Set())
    setMistakes(0)

    const build = async () => {
      if (lang === 'es') {
        const picked = pickWords(pool, PAIRS)
        return picked.map((item, id) => ({ id, item, meaning: item.translation }))
      }
      // берём с запасом — у части слов определения не найдётся;
      // перевод передаём как подсказку по части речи (см. lib/definitions)
      const candidates = pickWords(pool, PAIRS * 3)
      const defs = await getDefinitions(
        candidates.map((c) => ({ word: c.term, translation: c.translation })),
      )
      const out: Pair[] = []
      for (const item of candidates) {
        const meaning = defs[item.term.toLowerCase()]
        if (!meaning) continue
        out.push({ id: out.length, item, meaning })
        if (out.length === PAIRS) break
      }
      // если определений совсем мало — доигрываем на переводах
      if (out.length < PAIRS) {
        for (const item of candidates) {
          if (out.some((p) => p.item.term === item.term)) continue
          out.push({ id: out.length, item, meaning: item.translation })
          if (out.length === PAIRS) break
        }
      }
      return out
    }

    build().then((p) => alive && setPairs(p))
    return () => {
      alive = false
    }
  }, [pool, lang, seed])

  const left = useMemo(() => (pairs ? shuffle(pairs) : []), [pairs])
  const right = useMemo(() => (pairs ? shuffle(pairs) : []), [pairs])

  const complete = pairs !== null && pairs.length > 0 && matched.size === pairs.length
  useEffect(() => {
    if (complete) void logActivity('practice')
  }, [complete])

  if (!pairs) return <GameLoading title="🧩 Значения" onBack={onBack} />

  const pickRight = (id: number) => {
    if (selected === null || matched.has(id)) return
    if (id === selected) {
      setMatched((m) => new Set(m).add(id))
    } else {
      // ошибка: слово, которое пользователь ВЫБРАЛ слева, он не знает
      const picked = pairs.find((p) => p.id === selected)
      if (picked) markWrong(picked.item)
      setMistakes((n) => n + 1)
      setWrong(id)
      setTimeout(() => setWrong(null), 400)
    }
    setSelected(null)
  }

  if (complete) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title="🧩 Значения" onBack={onBack} />
        <Card className="text-center">
          <p className="text-4xl">{mistakes === 0 ? '🎉' : '👍'}</p>
          <p className="mt-2 font-semibold">
            {mistakes === 0 ? 'Все пары с первого раза!' : `Готово, ошибок: ${mistakes}`}
          </p>
          {mistakes > 0 && (
            <p className="mt-1 text-sm text-[var(--night-text-40)]">
              Слова с ошибками вернутся в ближайшее повторение.
            </p>
          )}
          <Button className="mt-4" onClick={() => setSeed((s) => s + 1)}>
            Ещё раунд
          </Button>
        </Card>
      </div>
    )
  }

  const cellBase = 'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors'

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title="🧩 Значения" onBack={onBack} />
      <p className="text-sm text-[var(--night-text-40)]">
        {lang === 'en'
          ? 'Нажми слово слева, затем его значение справа — по-английски.'
          : 'Нажми слово слева, затем его перевод справа.'}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-2">
          {left.map((p) => {
            const done = matched.has(p.id)
            const sel = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (done) return
                  setSelected(p.id)
                  speak(p.item.term, { lang })
                }}
                disabled={done}
                className={`${cellBase} font-medium ${
                  done
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : sel
                      ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)]'
                      : 'border-white/[0.10]'
                }`}
              >
                {p.item.term}
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((p) => {
            const done = matched.has(p.id)
            const isWrong = wrong === p.id
            return (
              <button
                key={p.id}
                onClick={() => pickRight(p.id)}
                disabled={done}
                className={`${cellBase} leading-snug ${
                  done
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : isWrong
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40'
                      : 'border-white/[0.10]'
                }`}
              >
                {p.meaning}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-center text-sm text-[var(--night-text-40)]">
        Найдено: {matched.size} / {pairs.length}
      </p>
    </div>
  )
}
