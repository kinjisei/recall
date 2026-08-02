// ============================================================================
// Общий рендер найденного при разборе: группы «фразовые/выражения/слова»
// (перевод + «в Мои слова») и «грам-структуры» (объяснение + «Открыть урок»),
// плюс «Добавить всё». Используется и в разборе предложения (AnalysisSheet), и
// в разборе всего текста (TextAnalysisSheet).
// ============================================================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { IconSpeaker, IconPlus, IconCheck, IconArrowRight } from './icons'
import { addCard } from '../lib/cards'
import { speak } from '../lib/speech'
import { logActivity } from '../lib/activity'
import type { AnalyzedItem, AnalyzedKind } from '../lib/analyze'
import type { AppLang } from '../types'

const GROUPS: { kind: AnalyzedKind; label: string }[] = [
  { kind: 'phrasal', label: 'Фразовые глаголы' },
  { kind: 'expression', label: 'Выражения' },
  { kind: 'word', label: 'Слова' },
]

export function AnalyzedItemsView({
  items,
  lang,
  example,
  onClose,
}: {
  items: AnalyzedItem[]
  lang: AppLang
  /** Пример для карточки (предложение). Нет — берём «как встречено» (it.text). */
  example?: string
  /** Закрыть родителя перед переходом на урок грамматики. */
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [added, setAdded] = useState<Set<string>>(new Set())

  const add = async (it: AnalyzedItem) => {
    if (it.kind === 'grammar') return // структуры в колоду не добавляем
    const key = it.base.toLowerCase()
    setAdded((prev) => (prev.has(key) ? prev : new Set(prev).add(key)))
    try {
      await addCard({
        front: it.base.toLowerCase(),
        back: it.ru,
        example: example ?? it.text ?? undefined,
        lang,
        source: 'reader',
      })
      void logActivity('reader')
    } catch {
      setAdded((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const addable = items.filter((it) => it.kind !== 'grammar')

  return (
    <>
      {items.length === 0 && (
        <p className="mt-4 text-sm text-[var(--night-text-40)]">
          Ничего примечательного не нашлось.
        </p>
      )}

      {GROUPS.map(({ kind, label }) => {
        const list = items.filter((it) => it.kind === kind)
        if (list.length === 0) return null
        return (
          <div key={kind} className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--night-accent-text)]">
              {label}
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {list.map((it) => {
                const key = it.base.toLowerCase()
                const isAdded = added.has(key)
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{it.base}</p>
                      <p className="truncate text-sm text-[var(--night-text-40)]">{it.ru}</p>
                    </div>
                    <button
                      onClick={() => speak(it.base, { lang })}
                      aria-label="Озвучить"
                      className="lift flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/[0.08] text-[var(--night-text-70)]"
                    >
                      <IconSpeaker size={16} />
                    </button>
                    <button
                      onClick={() => add(it)}
                      disabled={isAdded}
                      aria-label={isAdded ? 'Добавлено' : 'В мои слова'}
                      className={`lift flex h-9 w-9 flex-none items-center justify-center rounded-full border ${
                        isAdded
                          ? 'border-emerald-500/60 text-emerald-400'
                          : 'border-[var(--night-accent-45)] bg-[rgba(145,132,217,.14)] text-[var(--night-accent-100)]'
                      }`}
                    >
                      {isAdded ? <IconCheck size={16} /> : <IconPlus size={16} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {(() => {
        const gr = items.filter((it) => it.kind === 'grammar')
        if (gr.length === 0) return null
        return (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--night-accent-text)]">
              Грам-структуры
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {gr.map((it, i) => (
                <div key={`${it.base}-${i}`} className="rounded-xl border border-white/[0.08] px-3 py-2">
                  <p className="text-[15px] font-medium">{it.base}</p>
                  <p className="mt-0.5 text-sm text-[var(--night-text-40)]">{it.ru}</p>
                  {it.topicId !== undefined && (
                    <button
                      onClick={() => {
                        onClose()
                        navigate(`/grammar?topic=${it.topicId}`)
                      }}
                      className="mt-1.5 inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-[var(--night-accent-text)]"
                    >
                      Открыть урок <IconArrowRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {addable.length > 1 && (
        <Button className="mt-4 w-full py-2.5 text-sm" onClick={() => addable.forEach(add)}>
          <IconPlus size={16} /> Добавить всё в Мои слова
        </Button>
      )}
    </>
  )
}
