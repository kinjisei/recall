// ============================================================================
// «Спринт» — 60 секунд: показываем слово и перевод (в половине случаев —
// чужой), нужно быстро ответить «верно / неверно». Ошибка по слову из колоды
// возвращает карточку на повтор (markWrong), как и в остальных играх.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconTimer, IconClose } from '../../components/icons'
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

/** Пары для спринта: половина верных, половина с чужим (но правдоподобным) переводом. */
function buildPairs(items: PoolItem[]): Pair[] {
  // дедуп по слову: колода и пак могли дать дубликат → раньше выпадало «quit = quit»
  const seen = new Set<string>()
  const usable = items.filter((i) => {
    if (!i.term || !i.translation) return false
    const k = i.term.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return shuffle(usable).map((item, idx) => {
    const isTrue = idx % 2 === 0
    if (isTrue) return { item, shown: item.translation, isTrue: true }
    // ложная пара: чужой перевод, ЗАВЕДОМО отличный; предпочитаем ту же тему
    const pool = usable.filter(
      (o) => o.translation !== item.translation && o.term !== item.term,
    )
    if (pool.length === 0) return { item, shown: item.translation, isTrue: true }
    const sameTopic = pool.filter((o) => item.topic != null && o.topic === item.topic)
    const src = sameTopic.length > 0 ? sameTopic : pool
    const other = src[Math.floor(Math.random() * src.length)]
    return { item, shown: other.translation, isTrue: false }
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
    // раскладка «по всему экрану»: таймер и слово сверху, кнопки прижаты к низу
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-4">
      <GameHeader title={TITLE} onBack={onBack} />

      <div className="flex items-center justify-between text-sm text-[var(--night-text-40)]">
        <span className="flex items-center gap-1.5">
          <IconTimer size={16} />
          <span className={timeLeft <= 10 ? 'font-bold text-red-400' : ''}>{timeLeft} с</span>
        </span>
        <span>верно: {correct} / {total}</span>
      </div>

      <Card
        className={`items-center gap-2 py-12 text-center transition-colors ${
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

      <div className="flex-1" />

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => answer(false)}
          className="lift flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-white/[0.12] font-medium text-[var(--night-text-70)]"
        >
          <IconClose size={20} /> Неверно
        </button>
        <button
          onClick={() => answer(true)}
          className="lift flex min-h-16 items-center justify-center gap-2 rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.18)] font-medium text-[var(--night-text)]"
        >
          <IconCheck size={20} /> Верно
        </button>
      </div>
    </div>
  )
}
