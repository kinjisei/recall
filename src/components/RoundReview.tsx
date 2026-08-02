// ============================================================================
// Разбор результатов раунда практики: список вопросов раунда — что ввёл ученик,
// верный ответ, ✓/✗. У неверных — кнопка «Почему?» (дешёвый AI по запросу,
// lib/explain). Общий для всех режимов; открывается из RoundResult.
// ============================================================================
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { IconCheck, IconClose } from './icons'
import { explainMistake } from '../lib/explain'
import type { AppLang } from '../types'

export interface ReviewItem {
  /** Текст вопроса/задания. */
  prompt: string
  /** Что ответил ученик. */
  given: string
  /** Верный ответ. */
  correct: string
  ok: boolean
}

export function RoundReview({
  items,
  lang,
  onClose,
}: {
  items: ReviewItem[]
  lang: AppLang
  onClose: () => void
}) {
  const [why, setWhy] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  const explain = async (i: number, it: ReviewItem) => {
    if (why[i] || loading[i]) return
    setLoading((l) => ({ ...l, [i]: true }))
    try {
      const t = await explainMistake(it.prompt, it.given, it.correct, lang)
      setWhy((w) => ({ ...w, [i]: t }))
    } catch {
      setWhy((w) => ({ ...w, [i]: 'Не удалось объяснить. Попробуй ещё раз.' }))
    } finally {
      setLoading((l) => ({ ...l, [i]: false }))
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
          <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Результаты</p>
          <div className="mt-2 flex flex-col gap-2">
            {items.map((it, i) => (
              <div
                key={i}
                className={`rounded-xl border px-3 py-2 ${it.ok ? 'border-emerald-500/30' : 'border-red-500/30'}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 flex-none ${it.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {it.ok ? <IconCheck size={16} /> : <IconClose size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {it.prompt && <p className="text-sm font-medium">{it.prompt}</p>}
                    {!it.ok && (
                      <p className="text-sm text-[var(--night-text-40)]">
                        Твой ответ: <span className="text-red-300">{it.given}</span>
                      </p>
                    )}
                    <p className="text-sm text-[var(--night-text-40)]">
                      {it.ok ? 'Верно: ' : 'Правильно: '}
                      <span className="text-emerald-300">{it.correct}</span>
                    </p>
                    {!it.ok &&
                      (why[i] ? (
                        <p className="mt-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-sm leading-relaxed text-[var(--night-text-70)]">
                          {why[i]}
                        </p>
                      ) : loading[i] ? (
                        <p className="mt-1 text-sm text-[var(--night-text-40)]">Думаю…</p>
                      ) : (
                        <button
                          onClick={() => explain(i, it)}
                          className="mt-1 text-sm font-semibold text-[var(--night-accent-text)]"
                        >
                          Почему?
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
