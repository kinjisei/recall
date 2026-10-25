// ============================================================================
// «Спринт» — 60 секунд: показываем слово и перевод (в половине случаев —
// чужой), нужно быстро ответить «верно / неверно». Ошибка по слову из колоды
// возвращает карточку на повтор (markWrong), как и в остальных играх.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconCheck, IconTimer, IconClose } from '../../shared/ui/icons'
import { RoundResult } from '../../components/RoundResult'
import type { ReviewItem } from '../../components/RoundReview'
import { logActivity } from '../../lib/activity'
import {
  loadGamePool,
  pickDistractors,
  recordShown,
  withoutRecent,
  type PoolItem,
} from '../../lib/wordPool'
import { markWrong, shuffle } from './gameUtils'
import { EmptyPool, GameLoading } from './GameShell'
import { useRoundKeys } from '../../shared/ui/roundKeys'
import { KEY_EXIT, RoundFrame, type RoundKey } from '../../shared/ui/RoundFrame'
import { OPTION_LOOK, OPTION_SIZE, RoundPrompt, RoundTask } from '../../shared/ui/roundParts'
import type { AppLang } from '../../types'

const SECONDS = 60
const TITLE = 'Спринт'
const KEYS: RoundKey[] = [{ keys: ['1'], label: 'неверно' }, { keys: ['2'], label: 'верно' }, KEY_EXIT]

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
    // ложная пара: ПОХОЖИЙ чужой перевод (та же тема/часть речи/длина) —
    // случайный «крокодил» рядом с «боссом» выдавал ответ без знания слова
    const pool = usable.filter(
      (o) => o.translation !== item.translation && o.term !== item.term,
    )
    if (pool.length === 0) return { item, shown: item.translation, isTrue: true }
    const [similar] = pickDistractors(item, pool, 1, (o) => o.translation)
    // pool.length > 0 проверено строкой выше — pool[0] точно есть
    return { item, shown: similar ?? pool[0]!.translation, isTrue: false }
  })
}

export function SprintMode({ lang, onBack }: { lang: AppLang; onBack: () => void }) {
  const [items, setItems] = useState<PoolItem[] | null>(null)
  const [empty, setEmpty] = useState(false)
  const [seed, setSeed] = useState(0)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<ReviewItem[]>([])
  const [timeLeft, setTimeLeft] = useState(SECONDS)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    loadGamePool(lang, 40)
      .then((p) => {
        if (!alive) return
        const usable = p.items.filter((i) => i.term && i.translation)
        if (usable.length < 6) setEmpty(true)
        // анти-повтор: недавно игранные слова пропускаем, пока пул позволяет
        else setItems(withoutRecent(lang, usable, 20))
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

  // клавиши (d5 — клавиши раунда сбоку): 1 — «Неверно», 2 — «Верно»;
  // ответ берётся из ref — он объявлен ниже, после ранних return
  const answerRef = useRef<(saidTrue: boolean) => void>(() => {})
  useRoundKeys({ pick: (i) => i < 2 && answerRef.current(i === 1) }, running)

  if (empty) return <EmptyPool title={TITLE} onBack={onBack} />
  if (!items) return <GameLoading title={TITLE} onBack={onBack} />

  if (done) {
    return (
      <RoundFrame title={TITLE} at={null} total={null} results={results.map((r) => r.ok)} onExit={onBack}>
        <RoundResult
          correct={correct}
          total={total}
          review={results}
          lang={lang}
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
            setResults([])
            setTimeLeft(SECONDS)
          }}
        />
      </RoundFrame>
    )
  }

  const pair = pairs[index % pairs.length]
  // pairs строится из items (проверенных на usable.length >= 6 выше) — почти
  // всегда непустой; defensive guard на случай, если дедуп buildPairs всё
  // же схлопнул пул до пустого
  if (!pair) return null

  const answer = (saidTrue: boolean) => {
    const ok = saidTrue === pair.isTrue
    setTotal((t) => t + 1)
    setResults((r) => [
      ...r,
      {
        prompt: `«${pair.item.term}» = «${pair.shown}»?`,
        given: saidTrue ? 'Верно' : 'Неверно',
        correct: `${pair.isTrue ? 'Верно' : 'Неверно'} — «${pair.item.term}» = «${pair.item.translation}»`,
        ok,
      },
    ])
    if (ok) setCorrect((c) => c + 1)
    else markWrong(pair.item, lang)
    recordShown(lang, [pair.item.term]) // показанное — в историю анти-повтора
    navigator.vibrate?.(ok ? 8 : [15, 30, 15])
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setFlash(ok ? 'ok' : 'bad')
    flashTimer.current = setTimeout(() => setFlash(null), 250)
    setIndex((i) => i + 1)
  }
  answerRef.current = answer

  // кнопки ответа — варианты d5 с клавишами 1 и 2 (номер рисует index.css)
  const button = (n: number, label: string, Icon: typeof IconCheck, saidTrue: boolean) => (
    <button
      type="button"
      data-key={n}
      data-state="idle"
      onClick={() => answer(saidTrue)}
      className={`${OPTION_SIZE} ${OPTION_LOOK.idle} min-h-16 justify-center gap-2 @xl/round:min-h-16`}
    >
      <Icon size={20} aria-hidden />
      {label}
    </button>
  )

  return (
    // рамка раунда без полоски: спринт на время; на телефоне — «по всему
    // экрану»: слово сверху, кнопки прижаты к низу
    <RoundFrame title={TITLE} at={null} total={null} results={results.map((r) => r.ok)} keys={KEYS} onExit={onBack}>
      <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-5 @xl/round:min-h-0">
        <div className="flex items-center justify-between gap-3">
          <RoundTask>Верно ли перевод?</RoundTask>
          <span
            className={`flex flex-none items-center gap-1.5 rounded-full bg-input px-3 py-1 text-sm font-semibold tabular-nums ${
              timeLeft <= 10 ? 'text-danger-strong' : 'text-fg-secondary'
            }`}
          >
            <IconTimer size={16} aria-hidden />
            {timeLeft} с
          </span>
        </div>

        {/* ответ подсвечивает пару на миг: верно — зелёным с «клевком», ошибка — красным */}
        <div
          className={`-mx-3 rounded-card px-3 py-4 transition-shadow duration-150 ${
            flash === 'ok' ? 'animate-answer-pop inset-ring-2 inset-ring-success' : flash === 'bad' ? 'inset-ring-2 inset-ring-danger' : ''
          }`}
        >
          <RoundPrompt text={pair.item.term} sub={<>= {pair.shown} ?</>} />
        </div>
        <p className="text-sm text-fg-muted">
          верно: {correct} / {total}
        </p>

        <div className="flex-1 @xl/round:hidden" />

        <div className="grid grid-cols-2 gap-2.5">
          {button(1, 'Неверно', IconClose, false)}
          {button(2, 'Верно', IconCheck, true)}
        </div>
      </div>
    </RoundFrame>
  )
}
