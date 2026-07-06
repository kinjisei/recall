import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getDefaultDeck, addCardsBulk } from '../../lib/cards'
import type { SpanishTopic, SpanishWord } from '../../types'

const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const

interface Loaded {
  topics: SpanishTopic[]
  wordsByTopic: Map<number, SpanishWord[]>
}

/**
 * Паки испанских слов по темам (перенесены из приложения spanish, ~281 тема).
 * Данные грузятся лениво; темы сгруппированы по уровням, секции сворачиваются,
 * есть поиск. Кнопка добавляет тему в испанскую колоду; дубликаты пропускаются.
 */
export function PacksSheet({ onAdded }: { onAdded: () => void }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [query, setQuery] = useState('')
  const [openLevel, setOpenLevel] = useState<string | null>('A1')
  const [busyTopic, setBusyTopic] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, string>>({})

  useEffect(() => {
    let alive = true
    import('../../data/spanish/words').then((m) => {
      if (!alive) return
      const map = new Map<number, SpanishWord[]>()
      for (const w of m.allWords) {
        const arr = map.get(w.topic_id)
        if (arr) arr.push(w)
        else map.set(w.topic_id, [w])
      }
      setData({ topics: m.allTopics, wordsByTopic: map })
    })
    return () => {
      alive = false
    }
  }, [])

  const addTopic = async (topicId: number) => {
    if (!data) return
    setBusyTopic(topicId)
    try {
      const deck = await getDefaultDeck('es')
      const words = data.wordsByTopic.get(topicId) ?? []
      const added = await addCardsBulk(
        deck.id,
        words.map((w) => ({
          front: w.spanish,
          back: w.russian,
          example: w.example_es,
        })),
      )
      setResults((r) => ({
        ...r,
        [topicId]: added > 0 ? `+${added} ✓` : 'уже в колоде',
      }))
      if (added > 0) onAdded()
    } catch (e) {
      setResults((r) => ({
        ...r,
        [topicId]: e instanceof Error ? e.message : 'Ошибка',
      }))
    } finally {
      setBusyTopic(null)
    }
  }

  // Поиск по названию темы (без учёта регистра). При поиске раскрываем все уровни.
  const q = query.trim().toLowerCase()
  const byLevel = useMemo(() => {
    const groups: Record<string, SpanishTopic[]> = { A1: [], A2: [], B1: [], B2: [] }
    if (!data) return groups
    for (const t of data.topics) {
      const level = LEVELS.includes(t.level as (typeof LEVELS)[number]) ? t.level : 'A1'
      if (q && !t.name.toLowerCase().includes(q)) continue
      groups[level]?.push(t)
    }
    return groups
  }, [data, q])

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-slate-500">Загружаю словарь…</p>
      </Card>
    )
  }

  const totalTopics = data.topics.length
  const totalWords = [...data.wordsByTopic.values()].reduce((n, a) => n + a.length, 0)

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        Готовые наборы испанских слов по темам ({totalTopics} тем, {totalWords} слов).
        Добавленные слова появятся в колоде как новые карточки (дубликаты
        пропускаются).
      </p>

      <input
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900"
        placeholder="🔍 Поиск темы…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {LEVELS.map((level) => {
        const topics = byLevel[level] ?? []
        if (topics.length === 0) return null
        const isOpen = q.length > 0 || openLevel === level
        return (
          <div key={level}>
            <button
              onClick={() => setOpenLevel((cur) => (cur === level ? null : level))}
              className="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-left dark:bg-slate-800"
            >
              <span className="text-sm font-bold">
                Уровень {level}{' '}
                <span className="font-normal text-slate-400">
                  · {topics.length} тем
                </span>
              </span>
              <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {topics.map((t) => {
                  const count = data.wordsByTopic.get(t.id)?.length ?? 0
                  const note = results[t.id]
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="text-xs text-slate-400">{count} слов</p>
                      </div>
                      {note ? (
                        <span className="shrink-0 text-sm text-emerald-600 dark:text-emerald-400">
                          {note}
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          className="shrink-0 px-3 py-1.5 text-sm"
                          onClick={() => addTopic(t.id)}
                          disabled={busyTopic !== null}
                        >
                          {busyTopic === t.id ? 'Добавляю…' : '+ Добавить'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
