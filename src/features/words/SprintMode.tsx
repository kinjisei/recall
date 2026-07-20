// ============================================================================
// «Спринт» — 60 секунд: показываем слово и перевод (в половине случаев —
// чужой), нужно быстро ответить «верно / неверно». Ошибка по слову из колоды
// возвращает карточку на повтор (markWrong), как и в остальных играх.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, XIcon, TimerIcon } from '@phosphor-icons/react'
import { Card } from '../../components/Card'
import { RoundResult } from '../../components/RoundResult'
import { logActivity } from '../../lib/activity'
import { loadGamePool, type PoolItem } from '../../lib/wordPool'
import { markWrong, shuffle } from './gameUtils'
import { EmptyPool, GameHeader, GameLoading } from './GameShell'
import type { AppLang } from '../../types'

const SECONDS = 60
const TITLE = 'Спринт'

interface Pair {
  item: PoolItem
  shown: string
  isTrue: boolean
}

/** Пары для спринта: половина верных, половина с чужим переводом. */
function buildPairs(items: PoolItem[]): Pair[] {
  const usable = items.filter((i) => i.term && i.translation)
  return shuffle(usable).map((item, idx) => {
    const isTrue = idx % 2 === 0
    let shown = item.translation
    if (!isTrue) {
      const other = usable[(idx + 1 + Math.floor(Math.random() * (usable.length - 1))) % usable.length]
      shown = other.translation === item.translation ? other.term : other.translation
    }
    return { item, shown, isTrue }
  })
}

export function SprintMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [items, setItems] = useState<PoolItem[] | null>(null)
  const [empty, setEmpty] = useState(false)
  const [seed, setSeed] = useState(0)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SECONDS)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    loadGamePool(lang, 40)
      .then((p) => {
        if (!alive) return
        if (p.items.filter((i) => i.term && i.translation).length < 6) setEmpty(true)
        else setItems(p.items)
      })
      .catch(() => alive && setEmpty(true))
    return () => {
      alive = false
    }
  }, [lang])

  const pairs = useMemo(
    () => (items ? buildPairs(items) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, seed],
  )

  const running = items !== null && timeLeft > 0

  // таймер: тикаем, пока раунд идёт
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const done = items !== null && timeLeft <= 0
  useEffect(() => {
    if (done && total > 0) void logActivity('practice')
  }, [done, total])

  if (empty) return <EmptyPool title={TITLE} onBack={onBack} />
  if (!items) return <GameLoading title={TITLE} onBack={onBack} />

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <GameHeader title={TITLE} onBack={onBack} />
        <RoundResult
          correct={correct}
          total={total}
          note={
            total > correct
              ? 'Слова с ошибками вернутся в ближайшее повторение.'
              : total > 0
                ? 'Без единой ошибки!'
                : undefined
          }
          restartLabel="Ещё спринт"
          onRestart={() => {
            setSeed((s) => s + 1)
            setIndex(0)
            setCorrect(0)
            setTotal(0)
            setTimeLeft(SECONDS)
          }}
        />
      </div>
    )
  }

  const pair = pairs[index % pairs.length]

  const answer = (saidTrue: boolean) => {
    const ok = saidTrue === pair.isTrue
    setTotal((t) => t + 1)
    if (ok) setCorrect((c) => c + 1)
    else markWrong(pair.item)
    navigator.vibrate?.(ok ? 8 : [15, 30, 15])
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(ok ? 'ok' : 'bad')
    flashTimer.current = setTimeout(() => setFlash(null), 250)
    setIndex((i) => i + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <GameHeader title={TITLE} onBack={onBack} />

      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <span className="flex items-center gap-1.5">
          <TimerIcon size={16} />
          <span className={timeLeft <= 10 ? 'font-bold text-red-400' : ''}>{timeLeft} с</span>
        </span>
        <span>верно: {correct} / {total}</span>
      </div>

      <Card
        className={`items-center gap-2 py-10 text-center transition-colors ${
          flash === 'ok'
            ? 'border-emerald-500/60'
            : flash === 'bad'
              ? 'border-red-500/60'
              : ''
        }`}
      >
        <p className="text-3xl font-bold">{pair.item.term}</p>
        <p className="text-xl text-[var(--night-text-70)]">= {pair.shown} ?</p>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => answer(false)}
          className="lift flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.12] py-3.5 font-medium text-[var(--night-text-70)]"
        >
          <XIcon size={20} /> Неверно
        </button>
        <button
          onClick={() => answer(true)}
          className="lift flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.18)] py-3.5 font-medium text-[var(--night-text)]"
        >
          <CheckIcon size={20} /> Верно
        </button>
      </div>
    </div>
  )
}
