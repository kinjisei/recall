// ============================================================================
// «Повторение» — режим FSRS внутри хаба «Слова» (features/words/WordsPage).
// Карточка на весь экран, тап — перевод, свайп вправо «знаю» (good) / влево
// «не знаю» (again). «Не знаю» возвращает карточку в конец текущей очереди.
// Плюс перепроверка слов от преподавателя (плашка → печатание слов по
// переводу) и обучающая подсказка для новичка.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { addCard } from '../../lib/cards'
import { getDueCards, reviewCard, type DueCard } from '../../lib/fsrs'
import { logActivity } from '../../lib/activity'
import { getMyPendingWordChecks } from '../../lib/wordChecks'
import { useLanguage } from '../../context/LanguageContext'
import { GuidedNext } from '../../components/GuidedNext'
import { PacksSheet } from './PacksSheet'
import { SwipeCard, SwipeTutorial } from './SwipeCard'
import { WordCheckRunner } from './WordCheckRunner'
import type { AppLang, Card as CardType, WordCheck } from '../../types'

const TUTORIAL_KEY = 'recall.deck_tutorial_seen'

export function DeckReview({ onBack }: { onBack?: () => void }) {
  const { lang } = useLanguage()
  const [queue, setQueue] = useState<DueCard[]>([])
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showPacks, setShowPacks] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [checks, setChecks] = useState<{ check: WordCheck; cards: CardType[] }[]>([])
  const [activeCheck, setActiveCheck] = useState<{
    check: WordCheck
    cards: CardType[]
  } | null>(null)
  const swiping = useRef(false)
  const handledKey = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const due = await getDueCards(50, lang)
      setQueue(due)
      setIndex(0)
      setFlipped(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [lang])

  const loadChecks = useCallback(() => {
    getMyPendingWordChecks().then(setChecks).catch(() => setChecks([]))
  }, [])

  useEffect(() => {
    setShowPacks(false)
    setReviewedCount(0)
    void load()
    loadChecks()
  }, [load, loadChecks])

  const current = queue[index]

  // обучающая подсказка — один раз, когда впервые появилась карточка
  useEffect(() => {
    if (current && !localStorage.getItem(TUTORIAL_KEY)) setShowTutorial(true)
  }, [current])

  const dismissTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, '1')
    setShowTutorial(false)
  }

  const onSwipe = async (dir: 'left' | 'right') => {
    // guard: свайп-анимация держит кнопки видимыми ~220мс; повторный клик/свайп
    // или отложенный таймаут анимации ставил двойную оценку и пропускал карточку.
    // swiping — от параллельных вызовов; handledKey — от повторной обработки
    // той же позиции (если запрос завершился быстрее анимации).
    const key = `${current?.card.id}-${index}`
    if (!current || swiping.current || handledKey.current === key) return
    swiping.current = true
    handledKey.current = key
    const card = current.card
    const state = current.state
    const rating = dir === 'right' ? 'good' : 'again'
    setError(null)
    try {
      // сохраняем ДО сдвига очереди — при ошибке карточка не потеряется
      const newState = await reviewCard(card, state, rating)
      void logActivity('flashcards')
      setFlipped(false)
      setIndex((i) => i + 1)
      setReviewedCount((c) => c + 1)
      if (rating === 'again') {
        // «не знаю» — карточка вернётся в конец текущей сессии
        setQueue((q) => [...q, { card, state: newState }])
      }
    } catch (e) {
      // карточка остаётся на месте — оценка не сохранилась, показываем ошибку
      setError(e instanceof Error ? e.message : 'Не удалось сохранить оценку')
    } finally {
      swiping.current = false
    }
  }

  if (activeCheck) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">🔁 Повторение</h1>
        <WordCheckRunner
          check={activeCheck.check}
          cards={activeCheck.cards}
          lang={lang}
          onDone={() => {
            setActiveCheck(null)
            loadChecks()
            void load()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {onBack && (
            <Button variant="ghost" className="px-2 py-1 text-sm" onClick={onBack}>
              ←
            </Button>
          )}
          <h1 className="truncate text-xl font-bold">🔁 Повторение</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => {
              setShowPacks((s) => !s)
              setShowAdd(false)
            }}
          >
            {showPacks ? 'Закрыть' : '📦 Паки'}
          </Button>
          <Button
            variant="secondary"
            className="px-3 py-2 text-sm"
            onClick={() => {
              setShowAdd((s) => !s)
              setShowPacks(false)
            }}
          >
            {showAdd ? 'Закрыть' : '+ Слово'}
          </Button>
        </div>
      </header>

      {/* Плашка перепроверки от преподавателя */}
      {checks.map(({ check, cards }) => (
        <button
          key={check.id}
          onClick={() => setActiveCheck({ check, cards })}
          className="text-left"
        >
          <Card className="flex items-center justify-between border-amber-300 bg-amber-50 transition-transform active:scale-[0.99] dark:border-amber-700 dark:bg-amber-950/30">
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                🔁 Перепроверка от преподавателя
              </p>
              <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                Напиши по памяти: слов — {cards.length}
              </p>
            </div>
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-sm font-bold text-amber-950">
              {cards.length}
            </span>
          </Card>
        </button>
      ))}

      {showAdd && <AddCardForm lang={lang} onAdded={load} />}
      {showPacks && <PacksSheet lang={lang} onAdded={load} />}

      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-slate-500">Загрузка…</p>
      ) : current ? (
        <>
          <p className="text-center text-sm text-slate-500">
            Осталось: {queue.length - index}
          </p>
          <SwipeCard
            key={`${current.card.id}-${index}`}
            card={current.card}
            lang={lang}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onSwipe={onSwipe}
          />
          {flipped && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSwipe('left')}
                className="rounded-xl bg-red-500 py-3 text-sm font-semibold text-white hover:bg-red-400"
              >
                ✗ Не знаю
              </button>
              <button
                onClick={() => onSwipe('right')}
                className="rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                ✓ Знаю
              </button>
            </div>
          )}
          {showTutorial && <SwipeTutorial onDismiss={dismissTutorial} />}
        </>
      ) : (
        <>
          <Card className="text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-2 font-semibold">
              {reviewedCount > 0
                ? `Готово! Повторено карточек: ${reviewedCount}`
                : 'Карточек к повторению нет'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Добавь слова кнопкой «📦 Паки», «+ Слово» или из раздела «Ввод».
            </p>
            <Button variant="secondary" className="mt-4" onClick={load}>
              Обновить
            </Button>
          </Card>
          {/* ведомая сессия: предложить следующий шаг */}
          <GuidedNext step="flashcards" />
        </>
      )}
    </div>
  )
}

function AddCardForm({ lang, onAdded }: { lang: AppLang; onAdded: () => void }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [example, setExample] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900'

  const submit = async () => {
    if (!front.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      await addCard({
        front: front.trim(),
        back: back.trim() || undefined,
        example: example.trim() || undefined,
        lang,
        source: 'manual',
      })
      setFront('')
      setBack('')
      setExample('')
      setMsg('Добавлено ✓')
      onAdded()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <input
        className={inputClass}
        placeholder={lang === 'es' ? 'Слово / фраза (исп.)' : 'Слово / фраза (англ.)'}
        value={front}
        onChange={(e) => setFront(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Перевод / значение"
        value={back}
        onChange={(e) => setBack(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Пример в контексте (необязательно)"
        value={example}
        onChange={(e) => setExample(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy || !front.trim()}>
          {busy ? 'Добавляю…' : 'Добавить в колоду'}
        </Button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </Card>
  )
}
