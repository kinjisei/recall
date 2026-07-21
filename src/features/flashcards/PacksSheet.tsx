import { useEffect, useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getDefaultDeck, addCardsBulk } from '../../lib/cards'
import type { AppLang, WordTopic } from '../../types'

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

/** Слово пака в общем виде — уже как будущая карточка. */
interface PackWord {
  front: string
  back: string
  example?: string
}

interface Loaded {
  topics: WordTopic[]
  wordsByTopic: Map<number, PackWord[]>
}

/** Ленивая загрузка словаря нужного языка (каждый — отдельный чанк). */
async function loadPacks(lang: AppLang): Promise<Loaded> {
  const map = new Map<number, PackWord[]>()
  let topics: WordTopic[]
  if (lang === 'es') {
    const m = await import('../../data/spanish/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.spanish, back: w.russian, example: w.example_es })
      map.set(w.topic_id, arr)
    }
  } else {
    const m = await import('../../data/english/words')
    topics = m.allTopics
    for (const w of m.allWords) {
      const arr = map.get(w.topic_id) ?? []
      arr.push({ front: w.english, back: w.russian, example: w.example_en })
      map.set(w.topic_id, arr)
    }
  }
  return { topics, wordsByTopic: map }
}

/**
 * Паки слов по темам: испанский (~281 тема из приложения spanish) и
 * английский (авторские паки B1–C1). Данные грузятся лениво; темы сгруппированы
 * по уровням, секции сворачиваются, есть поиск. Кнопка добавляет тему в колоду
 * текущего языка; дубликаты пропускаются.
 */
export function PacksSheet({ lang, onAdded }: { lang: AppLang; onAdded: () => void }) {
  const [data, setData] = useState<Loaded | null>(null)
  const [query, setQuery] = useState('')
  const [openLevel, setOpenLevel] = useState<string | null>(null)
  const [busyTopic, setBusyTopic] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, string>>({})

  useEffect(() => {
    let alive = true
    setData(null)
    setResults({})
    loadPacks(lang).then((loaded) => {
      if (!alive) return
      setData(loaded)
      setOpenLevel(loaded.topics[0]?.level ?? null)
    })
    return () => {
      alive = false
    }
  }, [lang])

  const addTopic = async (topicId: number) => {
    if (!data) return
    setBusyTopic(topicId)
    try {
      const deck = await getDefaultDeck(lang)
      const words = data.wordsByTopic.get(topicId) ?? []
      const added = await addCardsBulk(
        deck.id,
        words.map((w) => ({ front: w.front, back: w.back, example: w.example })),
      )
      setResults((r) => ({
        ...r,
        [topicId]: added > 0 ? `+${added} ✓` : 'уже в моих словах',
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
    const groups: Record<string, WordTopic[]> = {}
    if (!data) return groups
    for (const t of data.topics) {
      if (q && !t.name.toLowerCase().includes(q)) continue
      ;(groups[t.level] ??= []).push(t)
    }
    return groups
  }, [data, q])

  if (!data) {
    return (
      <Card>
        <p className="text-sm text-[var(--night-text-40)]">Загружаю словарь…</p>
      </Card>
    )
  }

  const totalTopics = data.topics.length
  const totalWords = [...data.wordsByTopic.values()].reduce((n, a) => n + a.length, 0)

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-[var(--night-text-40)]">
        Готовые наборы {lang === 'es' ? 'испанских' : 'английских'} слов по темам
        ({totalTopics} тем, {totalWords} слов). Добавленные слова появятся в колоде
        как новые карточки (дубликаты пропускаются).
      </p>

      <input
        className="w-full rounded-lg border border-white/[0.10] bg-[var(--night-input)] px-3 py-2 text-sm outline-none focus:border-[var(--night-accent-45)]"
        placeholder="Поиск темы…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {LEVEL_ORDER.map((level) => {
        const topics = byLevel[level] ?? []
        if (topics.length === 0) return null
        const isOpen = q.length > 0 || openLevel === level
        return (
          <div key={level}>
            <button
              onClick={() => setOpenLevel((cur) => (cur === level ? null : level))}
              className="flex w-full items-center justify-between rounded-lg bg-white/[0.06] px-3 py-2 text-left dark:bg-[var(--night-surface)]"
            >
              <span className="text-sm font-bold">
                Уровень {level}{' '}
                <span className="font-normal text-[var(--night-text-40)]">
                  · {topics.length} тем
                </span>
              </span>
              <span className="text-[var(--night-text-40)]">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {topics.map((t) => {
                  const count = data.wordsByTopic.get(t.id)?.length ?? 0
                  const note = results[t.id]
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] px-3 py-2 dark:border-white/[0.08]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="text-xs text-[var(--night-text-40)]">{count} слов</p>
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
