// ============================================================================
// Попап перевода ВЫДЕЛЕННОЙ ФРАЗЫ (зажать+провести по словам в читалке):
// дешёвый перевод всего выделенного + «в колоду». Если выделено достаточно
// (≥5 слов / конец предложения) — кнопка «Разбор предложения» → умный разбор
// (AnalysisSheet). Единый компонент для читалок EN/ES.
// ============================================================================
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { IconPlus, IconCheck } from './icons'
import { AnalysisSheet } from './AnalysisSheet'
import { translatePhrase } from '../lib/phrase'
import { addCard } from '../lib/cards'
import { logActivity } from '../lib/activity'
import type { AppLang } from '../types'

export interface PhrasePick {
  text: string
  sentence: string
  offerAnalysis: boolean
}

export function PhraseSheet({
  text,
  sentence,
  lang,
  offerAnalysis,
  onClose,
}: {
  text: string
  sentence: string
  lang: AppLang
  offerAnalysis: boolean
  onClose: () => void
}) {
  const [tr, setTr] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [analyze, setAnalyze] = useState(false)

  useEffect(() => {
    let alive = true
    setTr(null)
    setFailed(false)
    setAdded(false)
    translatePhrase(text, sentence, lang)
      .then((r) => {
        if (!alive) return
        if (r) setTr(r)
        else setFailed(true)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [text, sentence, lang])

  const add = async () => {
    if (busy || added) return
    setBusy(true)
    try {
      await addCard({
        front: text.toLowerCase(),
        back: tr ?? undefined,
        example: sentence,
        lang,
        source: 'reader',
      })
      setAdded(true)
      void logActivity('reader')
    } catch {
      /* оставим кнопку активной, чтобы повторить */
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
        <div
          className="flex max-h-[85dvh] w-full flex-col rounded-t-3xl bg-[var(--night-surface)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-1 mt-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-600" />
          <div className="min-h-0 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--night-text-40)]">Фраза</p>
            <p className="mt-0.5 text-[15px] font-medium leading-snug">«{text}»</p>

            {tr === null && !failed && (
              <p className="mt-3 text-sm text-[var(--night-text-40)]">Перевожу…</p>
            )}
            {failed && (
              <p className="mt-3 text-sm text-[var(--night-text-40)]">
                Не удалось перевести — можно добавить в колоду как есть.
              </p>
            )}
            {tr && (
              <p className="mt-2 rounded-xl bg-white/[0.04] px-3 py-2 text-sm leading-relaxed text-[var(--night-text-70)]">
                {tr}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                onClick={add}
                loading={busy}
                disabled={added}
              >
                {added ? (
                  <>
                    <IconCheck size={18} /> В колоде
                  </>
                ) : (
                  <>
                    <IconPlus size={18} /> В колоду
                  </>
                )}
              </Button>
              {offerAnalysis && (
                <Button variant="secondary" className="flex-1" onClick={() => setAnalyze(true)}>
                  🔍 Разбор предложения
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {analyze && (
        <AnalysisSheet text={text} sentence={sentence} lang={lang} onClose={() => setAnalyze(false)} />
      )}
    </>,
    document.body,
  )
}
