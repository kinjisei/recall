import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { getDefaultDeck, addCardsBulk } from '../../lib/cards'
import { spanishTopics, wordsByTopic } from '../../data/spanish'

/**
 * Паки испанских слов по темам (перенесены из приложения spanish).
 * Кнопка добавляет всю тему в испанскую колоду; дубликаты пропускаются.
 */
export function PacksSheet({ onAdded }: { onAdded: () => void }) {
  const [busyTopic, setBusyTopic] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, string>>({})

  const addTopic = async (topicId: number) => {
    setBusyTopic(topicId)
    try {
      const deck = await getDefaultDeck('es')
      const words = wordsByTopic(topicId)
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

  const levels = ['A1', 'A2']

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        Готовые наборы испанских слов по темам. Добавленные слова появятся в
        колоде как новые карточки (дубликаты пропускаются).
      </p>
      {levels.map((level) => (
        <div key={level}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Уровень {level}
          </p>
          <div className="flex flex-col gap-2">
            {spanishTopics
              .filter((t) => t.level === level)
              .map((t) => {
                const count = wordsByTopic(t.id).length
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
        </div>
      ))}
    </Card>
  )
}
