// ============================================================================
// Карточка-разбор ПРЕДЛОЖЕНИЯ (кнопка «Разбор предложения» в шторке слова).
// Общий перевод + найденное (AnalyzedItemsView). Разбор — lib/analyze.
// ============================================================================
import { useEffect, useState } from 'react'
import { Sheet } from '../shared/ui/Sheet'
import { analyzeSelection, type Analysis } from '../lib/analyze'
import { AnalyzedItemsView } from './AnalyzedItemsView'
import type { AppLang } from '../types'
import { Thinking } from '../shared/ui/Thinking'
import { ErrorText } from '../shared/ui/ErrorText'
import { SheetHeader } from '../shared/ui/SheetHeader'

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

  return (
    <Sheet onClose={onClose} maxH="85dvh" labelledBy="analysis-title">
        <SheetHeader id="analysis-title" title="Разбор предложения" />
        <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-1">
          <p className="text-body font-medium leading-snug">«{text}»</p>

          {!data && !error && (
            <Thinking label="Разбираю фрагмент" className="mt-4 text-sm" />
          )}
          {error && <ErrorText className="mt-4">{error}</ErrorText>}

          {data && (
            <>
              {data.translation && (
                <p className="mt-2 rounded-xl bg-tint/[0.04] px-3 py-2 text-sm leading-relaxed text-fg-secondary">
                  {data.translation}
                </p>
              )}
              <AnalyzedItemsView items={data.items} lang={lang} example={sentence} onClose={onClose} />
            </>
          )}
        </div>
    </Sheet>
  )
}
