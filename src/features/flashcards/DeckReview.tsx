// ============================================================================
// «Повторение» — режим FSRS внутри хаба «Практика» (features/practice/PracticePage).
// Карточка на весь экран, тап — перевод, свайп вправо «знаю» (good) / влево
// «не знаю» (again). «Не знаю» возвращает карточку в конец текущей очереди.
// Плюс перепроверка слов от преподавателя (плашка → печатание слов по
// переводу) и обучающая подсказка для новичка.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconRefresh, IconBadgeCheck } from '../../components/icons'
import { BackButton } from '../../components/BackButton'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { celebrate } from '../../components/Confetti'
import { getDueCards, reviewCard, type DueCard } from '../../lib/fsrs'
import { countMyWords } from '../../lib/cards'
import { logActivity } from '../../lib/activity'
import { getMyPendingWordChecks } from '../../lib/wordChecks'
import { useLanguage } from '../../context/LanguageContext'
import { GuidedNext } from '../../components/GuidedNext'
import { SwipeCard, SwipeTutorial } from './SwipeCard'
import { WordCheckRunner } from './WordCheckRunner'
import type { Card as CardType, WordCheck } from '../../types'

const TUTORIAL_KEY = 'recall.deck_tutorial_seen'

export function DeckReview({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const [queue, setQueue] = useState<DueCard[]>([])
  // сколько слов вообще: отличать «слов ещё нет» от «на сегодня всё повторено»
  const [totalWords, setTotalWords] = useState<number | null>(null)
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [checks, setChecks] = useState<{ check: WordCheck; cards: CardType[] }[]>([])
  const [activeCheck, setActiveCheck] = useState<{
    check: WordCheck
    cards: CardType[]
  } | null>(null)
  const swiping = useRef(false)
  const handledKey = useRef<string | null>(null)

  // alive: смена языка на середине загрузки не должна подставить чужую очередь
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [lang])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const due = await getDueCards(50, lang)
      if (!aliveRef.current) return
      setQueue(due)
      setIndex(0)
      setFlipped(false)
      // очередь пуста: узнаём, есть ли слова вообще (пустая колода новичка)
      if (due.length === 0) {
        const n = await countMyWords(lang).catch(() => null)
        if (aliveRef.current) setTotalWords(n)
      } else {
        setTotalWords(null)
      }
    } catch (e) {
      if (aliveRef.current) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      }
    } finally {
      if (aliveRef.current) setLoading(false)
    }
  }, [lang])

  const loadChecks = useCallback(() => {
    getMyPendingWordChecks().then(setChecks).catch(() => setChecks([]))
  }, [])

  useEffect(() => {
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
      // карточка остаётся на месте — оценка не сохранилась, показываем ошибку.
      // handledKey сбрасываем, иначе тот же key навсегда блокировал бы повторный
      // свайп (защита от двойной оценки нужна только после УСПЕШНОГО сохранения)
      handledKey.current = null
      setError(e instanceof Error ? e.message : 'Не удалось сохранить оценку')
    } finally {
      swiping.current = false
    }
  }

  // финал очереди — конфетти (по ТЗ «Nocturne»: seal-check + празднование)
  const finished = !loading && !current && reviewedCount > 0
  useEffect(() => {
    if (finished) celebrate()
  }, [finished])

  if (activeCheck) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-medium tracking-tight">Повторение</h1>
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
      <header className="flex min-w-0 items-center gap-3">
        {onBack && <BackButton onClick={onBack} />}
        <h1 className="truncate text-xl font-medium tracking-tight">Повторение</h1>
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
              <p className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                <IconRefresh size={16} /> Перепроверка от преподавателя
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

      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
        </Card>
      )}

      {loading ? (
        <p className="text-[var(--night-text-40)]">Загрузка…</p>
      ) : current ? (
        <>
          {/* прогресс раунда: полоска + счётчик (очередь растёт от «ещё раз») */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-[var(--night-text-40)]">
              <span>
                {index} / {queue.length}
              </span>
              <span>осталось: {queue.length - index}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-[var(--night-accent)] transition-all duration-300"
                style={{ width: `${(index / Math.max(queue.length, 1)) * 100}%` }}
              />
            </div>
          </div>
          <SwipeCard
            key={`${current.card.id}-${index}`}
            card={current.card}
            lang={lang}
            flipped={flipped}
            onFlip={() => setFlipped(true)}
            onSwipe={onSwipe}
          />
          {flipped && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onSwipe('left')}
                className="lift rounded-2xl border border-white/[0.12] py-3.5 text-sm font-medium text-[var(--night-text-70)]"
              >
                Ещё раз
              </button>
              <button
                onClick={() => onSwipe('right')}
                className="lift rounded-2xl border border-[var(--night-accent-45)] bg-[rgba(145,132,217,.18)] py-3.5 text-sm font-medium text-[var(--night-text)]"
              >
                Помню
              </button>
            </div>
          )}
          {showTutorial && <SwipeTutorial onDismiss={dismissTutorial} />}
        </>
      ) : (
        <>
          <Card className="items-center text-center">
            <IconBadgeCheck
              size={44}
              className="animate-pop-in text-[var(--night-accent-text)]"
            />
            <p className="mt-2 font-semibold">
              {reviewedCount > 0
                ? `Готово! Повторено слов: ${reviewedCount}`
                : totalWords === 0
                  ? 'У тебя пока нет слов'
                  : 'Слов к повторению нет'}
            </p>
            <p className="mt-1 text-sm text-[var(--night-text-40)]">
              Добавляй слова в разделе «Учёба» → «Слова» (кнопки «Паки слов» и
              «Своё слово») или тапом по слову в любом тексте.
            </p>
            {totalWords === 0 ? (
              <Button className="mt-4" onClick={() => navigate('/study')}>
                Добавить первые слова
              </Button>
            ) : (
              <Button variant="secondary" className="mt-4" onClick={load}>
                Обновить
              </Button>
            )}
          </Card>
          {/* ведомая сессия: предложить следующий шаг */}
          <GuidedNext step="flashcards" />
        </>
      )}
    </div>
  )
}
