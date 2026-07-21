// ============================================================================
// «Match» — два столбца: слово и его ЗНАЧЕНИЕ.
//   EN: значение — английское определение (Free Dictionary → Gemini),
//       так слово запоминается через смысл, а не через русский перевод;
//   ES: значение — русский перевод (испанских толковых определений для
//       начинающего нет смысла показывать).
// Ошибка по слову из колоды возвращает карточку на повтор (FSRS «again»).
// ============================================================================
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { ScoreGlyph } from '../../components/RoundResult'
import { Button } from '../../components/Button'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { getDefinitions } from '../../lib/definitions'
import { getUserLevel } from '../../lib/level'
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

  if (error) return <EmptyPool title="Значения" onBack={onBack} />
  if (!pool) return <GameLoading title="Значения" onBack={onBack} />
  if (pool.items.length < PAIRS) return <EmptyPool title="Значения" onBack={onBack} />
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
      // уровень ученика: новичку — сверхпростые определения (см. lib/definitions)
      const level = await getUserLevel('en')
      const defs = await getDefinitions(
        candidates.map((c) => ({ word: c.term, translation: c.translation })),
        level,
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

  if (!pairs) return <GameLoading title="Значения" onBack={onBack} />

  const pickRight = (id: number) => {
    if (selected === null || matched.has(id)) return
    if (id === selected) {
      setMatched((m) => new Set(m).add(id))
    } else {
      // ошибка: слово, которое пользователь ВЫБРАЛ слева, он не знает
      const picked = pairs.find((p) => p.id === selected)
      if (picked) markWrong(picked.item, lang)
      setMistakes((n) => n + 1)
      setWrong(id)
      setTimeout(() => setWrong(null), 400)
    }
    setSelected(null)
  }

  if (complete) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title="Значения" onBack={onBack} />
        <Card className="flex flex-col items-center text-center">
          <ScoreGlyph percent={mistakes === 0 ? 100 : 65} />
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
      <GameHeader title="Значения" onBack={onBack} />
      <p className="text-sm text-[var(--night-text-40)]">
        {lang === 'en'
          ? 'Нажми слово слева, затем его значение справа — по-английски.'
          : 'Нажми слово слева, затем его перевод справа.'}
      </p>

      {/* Одна сетка на оба столбца: слово и значение стоят в ОДНОМ ряду,
          поэтому короткое слово растягивается по высоте длинного значения
          и пары не разъезжаются по вертикали. */}
      <div className="grid grid-cols-[minmax(28%,34%)_1fr] gap-x-2.5 gap-y-2">
        {left.map((l, row) => {
          const r = right[row]
          const lDone = matched.has(l.id)
          const rDone = matched.has(r.id)
          const sel = selected === l.id
          const isWrong = wrong === r.id
          const doneCls =
            'border-emerald-500/60 bg-emerald-500/12 text-emerald-300'
          return (
            <Fragment key={l.id}>
              <button
                onClick={() => {
                  if (lDone) return
                  setSelected(l.id)
                  speak(l.item.term, { lang })
                }}
                disabled={lDone}
                className={`${cellBase} flex items-center font-medium ${
                  lDone
                    ? doneCls
                    : sel
                      ? 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)]'
                      : 'border-white/[0.10]'
                }`}
              >
                <span className="break-words">{l.item.term}</span>
              </button>
              <button
                onClick={() => pickRight(r.id)}
                disabled={rDone}
                className={`${cellBase} flex items-center text-[13px] leading-snug ${
                  rDone
                    ? doneCls
                    : isWrong
                      ? 'border-red-500/70 bg-red-500/12'
                      : 'border-white/[0.10]'
                }`}
              >
                <span>{r.meaning}</span>
              </button>
            </Fragment>
          )
        })}
      </div>

      <p className="text-center text-sm text-[var(--night-text-40)]">
        Найдено: {matched.size} / {pairs.length}
      </p>
    </div>
  )
}
