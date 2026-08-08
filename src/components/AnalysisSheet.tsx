// ============================================================================
// Карточка-разбор ПРЕДЛОЖЕНИЯ (кнопка «Разбор предложения» в шторке слова).
// Общий перевод + найденное (AnalyzedItemsView). Разбор — lib/analyze.
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { analyzeSelection, type Analysis } from '../lib/analyze'
import { AnalyzedItemsView } from './AnalyzedItemsView'
import type { AppLang } from '../types'

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
  // ⚠️ Храним ТЕКСТ ошибки, а не флаг: сервер объясняет причину («энергия
  // на сегодня кончилась», «нет связи»), а флаг превращал любое объяснение
  // в «попробуй ещё раз» — человек жал вслепую (находка ревью 2В).
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    setError(null)
    analyzeSelection(text, sentence, lang)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Не удалось разобрать. Попробуй ещё раз.'))
    return () => {
      alive = false
    }
  }, [text, sentence, lang])

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
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          {data && (
            <>
              {data.translation && (
                <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-[var(--night-text-70)]">
                  {data.translation}
                </p>
              )}
              <AnalyzedItemsView items={data.items} lang={lang} example={sentence} onClose={onClose} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
