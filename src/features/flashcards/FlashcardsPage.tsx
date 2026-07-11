import { useCallback, useEffect, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { addCard } from '../../lib/cards'
import { getDueCards, reviewCard, type DueCard } from '../../lib/fsrs'
import { logActivity } from '../../lib/activity'
import { speak } from '../../lib/speech'
import { useLanguage } from '../../context/LanguageContext'
import { PacksSheet } from './PacksSheet'
import type { AppLang, Rating } from '../../types'

const ratingButtons: { rating: Rating; label: string; className: string }[] = [
  { rating: 'again', label: 'Снова', className: 'bg-red-500 hover:bg-red-400 text-white' },
  { rating: 'hard', label: 'Трудно', className: 'bg-orange-500 hover:bg-orange-400 text-white' },
  { rating: 'good', label: 'Хорошо', className: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
  { rating: 'easy', label: 'Легко', className: 'bg-sky-600 hover:bg-sky-500 text-white' },
]

export function FlashcardsPage() {
  const { lang } = useLanguage()
  const [queue, setQueue] = useState<DueCard[]>([])
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showPacks, setShowPacks] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const due = await getDueCards(50, lang)
      setQueue(due)
      setIndex(0)
      setRevealed(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [lang])

  useEffect(() => {
    setShowPacks(false)
    setReviewedCount(0)
    void load()
  }, [load])

  const current = queue[index]

  const onRate = async (rating: Rating) => {
    if (!current) return
    try {
      await reviewCard(current.card, current.state, rating)
      void logActivity('flashcards')
      setReviewedCount((c) => c + 1)
      setRevealed(false)
      setIndex((i) => i + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить оценку')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎴 Колода</h1>
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
          <Card className="min-h-[220px] flex-col items-center justify-center text-center">
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3">
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{current.card.front}</p>
                <button
                  onClick={() => speak(current.card.front, { lang })}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-lg dark:bg-slate-700"
                  aria-label="Озвучить"
                >
                  🔊
                </button>
              </div>
              {current.card.ipa && (
                <p className="text-slate-400">/{current.card.ipa}/</p>
              )}
              {revealed && (
                <div className="mt-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {current.card.back && (
                    <p className="text-lg text-slate-700 dark:text-slate-200">
                      {current.card.back}
                    </p>
                  )}
                  {current.card.example && (
                    <p className="mt-2 text-sm italic text-slate-500">
                      «{current.card.example}»
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {!revealed ? (
            <Button onClick={() => setRevealed(true)}>Показать ответ</Button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {ratingButtons.map((b) => (
                <button
                  key={b.rating}
                  onClick={() => onRate(b.rating)}
                  className={`rounded-xl py-3 text-sm font-semibold transition-colors ${b.className}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
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
