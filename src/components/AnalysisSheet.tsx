// ============================================================================
// Карточка-разбор выделенного фрагмента (открывается после «зажать + провести»
// по словам в читалке). Показывает общий перевод и найденное по группам
// (фразовые глаголы / выражения / слова); любое — добавить в «Мои слова».
// Разбор — lib/analyze (один запрос AI, лёгкая модель).
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconSpeaker, IconPlus, IconCheck } from './icons'
import { analyzeSelection, type Analysis, type AnalyzedItem, type AnalyzedKind } from '../lib/analyze'
import { addCard } from '../lib/cards'
import { speak } from '../lib/speech'
import { logActivity } from '../lib/activity'
import type { AppLang } from '../types'

const GROUPS: { kind: AnalyzedKind; label: string }[] = [
  { kind: 'phrasal', label: 'Фразовые глаголы' },
  { kind: 'expression', label: 'Выражения' },
  { kind: 'word', label: 'Слова' },
]

export function AnalysisSheet({
  text,
  sentence,
  lang,
  onClose,
}: {
  text: string
  sentence: string
  lang: AppLang
  onClose: () => void
}) {
  const [data, setData] = useState<Analysis | null>(null)
  const [error, setError] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    setData(null)
    setError(false)
    analyzeSelection(text, sentence, lang)
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [text, sentence, lang])

  const add = async (it: AnalyzedItem) => {
    const key = it.base.toLowerCase()
    setAdded((prev) => {
      if (prev.has(key)) return prev
      return new Set(prev).add(key)
    })
    try {
      await addCard({
        front: it.base.toLowerCase(),
        back: it.ru,
        example: sentence,
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />
        <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Разбор</p>
          <p className="mt-0.5 text-[15px] font-medium leading-snug">«{text}»</p>

          {!data && !error && (
            <p className="mt-4 text-sm text-[var(--night-text-40)]">Разбираю фрагмент…</p>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-400">Не удалось разобрать. Попробуй ещё раз.</p>
          )}

          {data && (
            <>
              {data.translation && (
                <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-[var(--night-text-70)]">
                  {data.translation}
                </p>
              )}
              {data.items.length === 0 && (
                <p className="mt-4 text-sm text-[var(--night-text-40)]">
                  Ничего примечательного не нашлось — можно добавить слово обычным тапом.
                </p>
              )}

              {GROUPS.map(({ kind, label }) => {
                const list = data.items.filter((it) => it.kind === kind)
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
                              className="lift flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/[0.08] text-[var(--night-text-70)]"
                            >
                              <IconSpeaker size={16} />
                            </button>
                            <button
                              onClick={() => add(it)}
                              disabled={isAdded}
                              aria-label={isAdded ? 'Добавлено' : 'В мои слова'}
                              className={`lift flex h-10 w-10 flex-none items-center justify-center rounded-full border ${
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

              {data.items.length > 1 && (
                <Button className="mt-4 w-full" onClick={() => data.items.forEach(add)}>
                  <IconPlus size={16} /> Добавить всё в Мои слова
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
